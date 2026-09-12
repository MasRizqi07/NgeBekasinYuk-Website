// NgeBekasinYuk Escrow Ledger Service
// Enforces server-authoritative financial invariants with database-level concurrency protection (HP2-P0-04).

import { prisma } from "@/server/db/prisma";
import { assertValidMoney, Money } from "@/domain/money";
import { buildIdempotencyKey } from "@/domain/id";

export class EscrowDomainError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EscrowDomainError";
    this.code = code;
  }
}

export interface EscrowReleaseResult {
  success: boolean;
  isDuplicate: boolean;
  escrowAccountId: string;
  releasedAmount: Money;
  sellerWalletId: string;
  sellerNewBalance: Money;
  idempotencyKey: string;
}

export interface EscrowRefundResult {
  success: boolean;
  isDuplicate: boolean;
  escrowAccountId: string;
  refundedAmount: Money;
  idempotencyKey: string;
}

export class EscrowLedgerService {
  /**
   * Idempotently releases escrow funds to the seller's wallet with concurrency protection.
   * Uses conditional database mutations inside an atomic transaction to prevent race conditions.
   */
  static async releaseEscrow(params: {
    orderId: string;
    actorId: string;
    actorRole: "BUYER" | "ADMIN" | "SYSTEM";
    overrideDispute?: boolean;
    customIdempotencyKey?: string;
  }): Promise<EscrowReleaseResult> {
    const { orderId, actorId, actorRole, overrideDispute = false, customIdempotencyKey } = params;

    const idempotencyKey =
      customIdempotencyKey ||
      buildIdempotencyKey("ESCROW_RELEASE", orderId, "SELLER_PAYOUT");

    // Fetch initial order and escrow records
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        escrowAccount: true,
        seller: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!order) {
      throw new EscrowDomainError("ORDER_NOT_FOUND", `Order ${orderId} not found`);
    }

    const escrow = order.escrowAccount;
    if (!escrow) {
      throw new EscrowDomainError("ESCROW_NOT_FOUND", `Escrow account for order ${orderId} not found`);
    }

    // Role check: seller cannot release their own escrow
    if (actorRole !== "ADMIN" && actorRole !== "SYSTEM" && actorId === order.sellerId) {
      throw new EscrowDomainError(
        "FORBIDDEN_SELF_RELEASE",
        "Seller is forbidden from releasing their own escrow funds"
      );
    }

    // Dispute check
    if (escrow.status === "FROZEN_DISPUTE" && !overrideDispute) {
      throw new EscrowDomainError(
        "ESCROW_FROZEN_DISPUTE",
        "Cannot release escrow: funds are currently frozen pending dispute resolution"
      );
    }

    // Ensure seller has a wallet record
    let sellerWallet = order.seller.wallet;
    if (!sellerWallet) {
      sellerWallet = await prisma.wallet.create({
        data: {
          userId: order.sellerId,
          activeBalance: 0,
          heldBalance: 0,
        },
      });
    }

    const releaseAmount = order.itemPrice;
    assertValidMoney(releaseAmount, "releaseAmount");

    // ATOMIC DATABASE TRANSACTION WITH CONCURRENCY CLAIM
    return await prisma.$transaction(async (tx) => {
      // 1. Decisive Invariant Check & Claim: Conditionally mark as released only if not already released or refunded
      const claim = await tx.escrowAccount.updateMany({
        where: {
          id: escrow.id,
          isReleased: false,
          isRefunded: false,
        },
        data: {
          isReleased: true,
          status: "RELEASED",
          releasedAt: new Date(),
          idempotencyKey,
        },
      });

      if (claim.count === 0) {
        // Concurrently claimed or already processed. Re-read inside transaction to ascertain reason.
        const current = await tx.escrowAccount.findUnique({ where: { id: escrow.id } });

        if (current?.isRefunded) {
          throw new EscrowDomainError(
            "ESCROW_ALREADY_REFUNDED",
            "Cannot release escrow: funds were already refunded to buyer"
          );
        }

        if (current?.isReleased) {
          // Check if this is an idempotent duplicate call with the same idempotency key
          const existingLedger = await tx.escrowLedgerEntry.findUnique({
            where: { idempotencyKey },
          });

          if (existingLedger) {
            const w = await tx.wallet.findUnique({ where: { id: sellerWallet.id } });
            return {
              success: true,
              isDuplicate: true,
              escrowAccountId: escrow.id,
              releasedAmount: releaseAmount,
              sellerWalletId: sellerWallet.id,
              sellerNewBalance: w ? w.activeBalance : 0,
              idempotencyKey,
            };
          }

          throw new EscrowDomainError(
            "ESCROW_ALREADY_RELEASED",
            "Escrow has already been released under a different transaction"
          );
        }

        throw new EscrowDomainError("CONCURRENT_MODIFICATION", "Escrow account was modified concurrently");
      }

      // 2. Write immutable Escrow Ledger Entry (DEBIT)
      const existingReleaseLedger = await tx.escrowLedgerEntry.findUnique({
        where: { idempotencyKey },
      });
      if (!existingReleaseLedger) {
        await tx.escrowLedgerEntry.create({
          data: {
            escrowAccountId: escrow.id,
            type: "RELEASE_SELLER",
            direction: "DEBIT",
            amount: releaseAmount,
            previousBalance: escrow.amount,
            newBalance: Math.max(0, escrow.amount - releaseAmount),
            referenceId: order.orderNumber,
            idempotencyKey,
            notes: `Escrow released to seller wallet by actor ${actorId} (${actorRole})`,
          },
        });
      }

      // 3. Atomically increment seller active balance and decrement held balance
      const updatedWallet = await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: {
          activeBalance: { increment: releaseAmount },
          heldBalance: { decrement: releaseAmount },
        },
      });

      // 4. Write immutable Wallet Ledger Entry (CREDIT)
      const walletLedgerKey = `WLE-${idempotencyKey}`;
      const existingWalletLedger = await tx.walletLedgerEntry.findUnique({
        where: { idempotencyKey: walletLedgerKey },
      });
      if (!existingWalletLedger) {
        await tx.walletLedgerEntry.create({
          data: {
            walletId: sellerWallet.id,
            type: "ESCROW_RELEASE",
            direction: "CREDIT",
            amount: releaseAmount,
            balanceAfter: updatedWallet.activeBalance,
            referenceType: "ORDER",
            referenceId: order.id,
            idempotencyKey: walletLedgerKey,
            description: `Pelepasan dana penjualan order #${order.orderNumber}`,
          },
        });
      }

      // 5. Update Order status to COMPLETED if not already
      if (order.status !== "COMPLETED") {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: "COMPLETED",
            actorId,
            actorRole,
            reason: "Dana escrow berhasil dilepaskan ke dompet penjual",
          },
        });
      }

      // 6. Append security audit log
      const actorUser = await tx.user.findUnique({ where: { id: actorId }, select: { id: true } });
      await tx.auditLog.create({
        data: {
          userId: actorUser?.id,
          action: "ESCROW_RELEASE",
          targetType: "EscrowAccount",
          targetId: escrow.id,
          details: JSON.stringify({
            actorId,
            orderNumber: order.orderNumber,
            amount: releaseAmount,
            sellerId: order.sellerId,
            actorRole,
            idempotencyKey,
          }),
        },
      });

      return {
        success: true,
        isDuplicate: false,
        escrowAccountId: escrow.id,
        releasedAmount: releaseAmount,
        sellerWalletId: updatedWallet.id,
        sellerNewBalance: updatedWallet.activeBalance,
        idempotencyKey,
      };
    });
  }

  /**
   * Idempotently refunds escrow funds to the buyer with database-level concurrency protection.
   * Guarantees mutual exclusion: cannot refund if already released.
   */
  static async refundEscrow(params: {
    orderId: string;
    actorId: string;
    actorRole: "ADMIN" | "SYSTEM";
    reason: string;
    customIdempotencyKey?: string;
  }): Promise<EscrowRefundResult> {
    const { orderId, actorId, actorRole, reason, customIdempotencyKey } = params;

    const idempotencyKey =
      customIdempotencyKey ||
      buildIdempotencyKey("ESCROW_REFUND", orderId, "BUYER_REFUND");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        escrowAccount: true,
        seller: { include: { wallet: true } },
      },
    });

    if (!order) {
      throw new EscrowDomainError("ORDER_NOT_FOUND", `Order ${orderId} not found`);
    }

    const escrow = order.escrowAccount;
    if (!escrow) {
      throw new EscrowDomainError("ESCROW_NOT_FOUND", `Escrow account for order ${orderId} not found`);
    }

    const refundAmount = escrow.amount;
    assertValidMoney(refundAmount, "refundAmount");

    // ATOMIC DATABASE TRANSACTION WITH CONCURRENCY CLAIM
    return await prisma.$transaction(async (tx) => {
      // 1. Decisive Invariant Claim: Mark as refunded only if not already released or refunded
      const claim = await tx.escrowAccount.updateMany({
        where: {
          id: escrow.id,
          isReleased: false,
          isRefunded: false,
        },
        data: {
          isRefunded: true,
          status: "REFUNDED",
          refundedAt: new Date(),
          idempotencyKey,
        },
      });

      if (claim.count === 0) {
        // Concurrently claimed or already processed
        const current = await tx.escrowAccount.findUnique({ where: { id: escrow.id } });

        if (current?.isReleased) {
          throw new EscrowDomainError(
            "ESCROW_ALREADY_RELEASED",
            "Cannot refund escrow: funds have already been released to the seller"
          );
        }

        if (current?.isRefunded) {
          const existingLedger = await tx.escrowLedgerEntry.findUnique({
            where: { idempotencyKey },
          });

          if (existingLedger) {
            return {
              success: true,
              isDuplicate: true,
              escrowAccountId: escrow.id,
              refundedAmount: refundAmount,
              idempotencyKey,
            };
          }

          throw new EscrowDomainError(
            "ESCROW_ALREADY_REFUNDED",
            "Escrow has already been refunded under a different transaction"
          );
        }

        throw new EscrowDomainError("CONCURRENT_MODIFICATION", "Escrow account was modified concurrently");
      }

      // 2. Write immutable Escrow Ledger Entry (DEBIT)
      const existingRefundLedger = await tx.escrowLedgerEntry.findUnique({
        where: { idempotencyKey },
      });
      if (!existingRefundLedger) {
        await tx.escrowLedgerEntry.create({
          data: {
            escrowAccountId: escrow.id,
            type: "REFUND_BUYER",
            direction: "DEBIT",
            amount: refundAmount,
            previousBalance: escrow.amount,
            newBalance: 0,
            referenceId: order.orderNumber,
            idempotencyKey,
            notes: `Escrow refunded to buyer: ${reason}`,
          },
        });
      }

      // 3. Clear seller held balance if allocated
      if (order.seller.wallet && order.seller.wallet.heldBalance > 0) {
        await tx.wallet.update({
          where: { id: order.seller.wallet.id },
          data: {
            heldBalance: { decrement: Math.min(order.seller.wallet.heldBalance, order.itemPrice) },
          },
        });
      }

      // 4. Update order to REFUNDED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "REFUNDED",
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "REFUNDED",
          actorId,
          actorRole,
          reason: `Pengembalian dana 100% ke pembeli: ${reason}`,
        },
      });

      // 5. Append security audit log
      const actorUser = await tx.user.findUnique({ where: { id: actorId }, select: { id: true } });
      await tx.auditLog.create({
        data: {
          userId: actorUser?.id,
          action: "ESCROW_REFUND",
          targetType: "EscrowAccount",
          targetId: escrow.id,
          details: JSON.stringify({
            actorId,
            orderNumber: order.orderNumber,
            amount: refundAmount,
            buyerId: order.buyerId,
            reason,
            actorRole,
            idempotencyKey,
          }),
        },
      });

      return {
        success: true,
        isDuplicate: false,
        escrowAccountId: escrow.id,
        refundedAmount: refundAmount,
        idempotencyKey,
      };
    });
  }
}
