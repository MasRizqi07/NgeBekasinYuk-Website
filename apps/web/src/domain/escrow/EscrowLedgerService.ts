// NgeBekasinYuk Escrow Ledger Service
// Enforces server-authoritative financial invariants and double-entry immutable ledger entries.

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
   * Idempotently releases escrow funds to the seller's wallet.
   * Atomically debits the escrow account, marks isReleased = true, credits seller wallet, and records immutable ledger entries.
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

    // Fetch order with escrow account and seller wallet
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

    // INVARIANT 1: Cannot release escrow if already refunded
    if (escrow.isRefunded) {
      throw new EscrowDomainError(
        "ESCROW_ALREADY_REFUNDED",
        `Cannot release escrow: funds were already refunded to buyer`
      );
    }

    // INVARIANT 2: Idempotency check - if already released with this idempotency key, return safely without double payout
    if (escrow.isReleased) {
      const existingLedger = await prisma.escrowLedgerEntry.findUnique({
        where: { idempotencyKey },
      });

      if (existingLedger) {
        const wallet = order.seller.wallet;
        return {
          success: true,
          isDuplicate: true,
          escrowAccountId: escrow.id,
          releasedAmount: escrow.amount,
          sellerWalletId: wallet ? wallet.id : "",
          sellerNewBalance: wallet ? wallet.activeBalance : 0,
          idempotencyKey,
        };
      }

      throw new EscrowDomainError(
        "ESCROW_ALREADY_RELEASED",
        `Escrow has already been released under a different transaction`
      );
    }

    // INVARIANT 3: Dispute freeze protection
    if (escrow.status === "FROZEN_DISPUTE" && !overrideDispute) {
      throw new EscrowDomainError(
        "ESCROW_FROZEN_DISPUTE",
        `Cannot release escrow: funds are currently frozen pending dispute resolution`
      );
    }

    // INVARIANT 4: Seller cannot release their own escrow
    if (actorRole !== "ADMIN" && actorRole !== "SYSTEM" && actorId === order.sellerId) {
      throw new EscrowDomainError(
        "FORBIDDEN_SELF_RELEASE",
        `Seller is forbidden from releasing their own escrow funds`
      );
    }

    // Ensure seller has a wallet
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

    const releaseAmount = order.itemPrice; // Seller receives canonical item price
    assertValidMoney(releaseAmount, "releaseAmount");

    // ATOMIC DATABASE TRANSACTION
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark escrow account as released
      const updatedEscrow = await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: {
          isReleased: true,
          status: "RELEASED",
          releasedAt: new Date(),
          idempotencyKey,
        },
      });

      // 2. Write immutable Escrow Ledger Entry (DEBIT)
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

      // 3. Update seller Wallet active balance and deduct from held balance
      const newActive = sellerWallet.activeBalance + releaseAmount;
      const newHeld = Math.max(0, sellerWallet.heldBalance - releaseAmount);

      const updatedWallet = await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: {
          activeBalance: newActive,
          heldBalance: newHeld,
        },
      });

      // 4. Write immutable Wallet Ledger Entry (CREDIT)
      const walletLedgerKey = `WLE-${idempotencyKey}`;
      await tx.walletLedgerEntry.create({
        data: {
          walletId: sellerWallet.id,
          type: "ESCROW_RELEASE",
          direction: "CREDIT",
          amount: releaseAmount,
          balanceAfter: newActive,
          referenceType: "ORDER",
          referenceId: order.id,
          idempotencyKey: walletLedgerKey,
          description: `Pelepasan dana penjualan order #${order.orderNumber}`,
        },
      });

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
        updatedEscrow,
        updatedWallet,
      };
    });

    return {
      success: true,
      isDuplicate: false,
      escrowAccountId: escrow.id,
      releasedAmount: releaseAmount,
      sellerWalletId: result.updatedWallet.id,
      sellerNewBalance: result.updatedWallet.activeBalance,
      idempotencyKey,
    };
  }

  /**
   * Idempotently refunds escrow funds to the buyer.
   * Ensures mutual exclusion: cannot refund if already released.
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

    // INVARIANT: Cannot refund if already released
    if (escrow.isReleased) {
      throw new EscrowDomainError(
        "ESCROW_ALREADY_RELEASED",
        `Cannot refund escrow: funds have already been released to the seller`
      );
    }

    // Idempotency check
    if (escrow.isRefunded) {
      const existingLedger = await prisma.escrowLedgerEntry.findUnique({
        where: { idempotencyKey },
      });

      if (existingLedger) {
        return {
          success: true,
          isDuplicate: true,
          escrowAccountId: escrow.id,
          refundedAmount: escrow.amount,
          idempotencyKey,
        };
      }

      throw new EscrowDomainError(
        "ESCROW_ALREADY_REFUNDED",
        `Escrow has already been refunded under a different transaction`
      );
    }

    const refundAmount = escrow.amount;
    assertValidMoney(refundAmount, "refundAmount");

    // ATOMIC TRANSACTION
    await prisma.$transaction(async (tx) => {
      // 1. Mark escrow account as refunded
      await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: {
          isRefunded: true,
          status: "REFUNDED",
          refundedAt: new Date(),
          idempotencyKey,
        },
      });

      // 2. Write immutable Escrow Ledger Entry (DEBIT)
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

      // 3. Clear seller held balance if allocated
      if (order.seller.wallet && order.seller.wallet.heldBalance > 0) {
        await tx.wallet.update({
          where: { id: order.seller.wallet.id },
          data: {
            heldBalance: Math.max(0, order.seller.wallet.heldBalance - order.itemPrice),
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
    });

    return {
      success: true,
      isDuplicate: false,
      escrowAccountId: escrow.id,
      refundedAmount: refundAmount,
      idempotencyKey,
    };
  }
}
