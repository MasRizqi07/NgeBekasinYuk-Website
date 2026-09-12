// NgeBekasinYuk Payment Provider Abstraction
// Honest development/simulation provider decoupled from production payment gateway.

import { prisma } from "@/server/db/prisma";
import { assertValidMoney, Money } from "@/domain/money";
import { buildIdempotencyKey } from "@/domain/id";

export interface CreatePaymentParams {
  orderId: string;
  amount: Money;
  paymentMethod: "BCA_VA" | "MANDIRI_VA" | "BRI_VA" | "BNI_VA" | "QRIS";
}

export interface PaymentAttemptResponse {
  paymentAttemptId: string;
  orderId: string;
  paymentMethod: string;
  amount: Money;
  status: "PENDING" | "SETTLED" | "EXPIRED" | "FAILED";
  vaNumber?: string;
  qrString?: string;
  expiresAt: Date;
  isSimulation: boolean;
  providerName: string;
}

export interface WebhookResult {
  success: boolean;
  isDuplicate: boolean;
  orderId: string;
  amount: Money;
  status: string;
  message: string;
}

export interface PaymentProvider {
  createPayment(params: CreatePaymentParams): Promise<PaymentAttemptResponse>;
  simulateWebhook(params: {
    paymentAttemptId: string;
    orderId: string;
    amount: Money;
  }): Promise<WebhookResult>;
}

export class DemoPaymentProvider implements PaymentProvider {
  /**
   * Creates a simulated payment attempt with realistic VA number or QRIS string.
   * Explicitly labeled as simulation.
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentAttemptResponse> {
    const { orderId, amount, paymentMethod } = params;
    assertValidMoney(amount, "payment amount");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== "PENDING_PAYMENT") {
      throw new Error(`Cannot create payment attempt for order in status ${order.status}`);
    }

    // Payment expires in 2 hours
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const idempotencyKey = buildIdempotencyKey("PAY_ATTEMPT", orderId, paymentMethod);

    let vaNumber: string | undefined;
    let qrString: string | undefined;

    if (paymentMethod === "QRIS") {
      qrString = `00020101021226540014ID.LINKAJA.WWW01189360091800000000005204581253033605802ID5913NgeBekasinYuk6007Jakarta61051219062070703A016304${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      const bankPrefixes: Record<string, string> = {
        BCA_VA: "88012",
        MANDIRI_VA: "89012",
        BRI_VA: "88013",
        BNI_VA: "88014",
      };
      const prefix = bankPrefixes[paymentMethod] || "88000";
      const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
      vaNumber = `${prefix}${randomSuffix}`;
    }

    const attempt = await prisma.paymentAttempt.create({
      data: {
        orderId,
        paymentMethod,
        amount,
        status: "PENDING",
        vaNumber,
        qrString,
        expiresAt,
        providerName: "DemoPaymentProvider",
        isSimulation: true,
        idempotencyKey,
      },
    });

    return {
      paymentAttemptId: attempt.id,
      orderId: attempt.orderId,
      paymentMethod: attempt.paymentMethod,
      amount: attempt.amount,
      status: "PENDING",
      vaNumber,
      qrString,
      expiresAt,
      isSimulation: true,
      providerName: "DemoPaymentProvider",
    };
  }

  /**
   * Simulates an incoming payment webhook confirmation.
   * Enforces server-side expiration validation and idempotent escrow funding.
   */
  async simulateWebhook(params: {
    paymentAttemptId: string;
    orderId: string;
    amount: Money;
  }): Promise<WebhookResult> {
    const { paymentAttemptId, orderId, amount } = params;

    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
    });

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    // SERVER-SIDE EXPIRATION CHECK: Never accept payment if expired
    if (new Date() > attempt.expiresAt) {
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "EXPIRED" },
      });
      return {
        success: false,
        isDuplicate: false,
        orderId,
        amount,
        status: "EXPIRED",
        message: "Payment attempt has expired",
      };
    }

    // Idempotency: check if already settled
    if (attempt.status === "SETTLED") {
      return {
        success: true,
        isDuplicate: true,
        orderId,
        amount,
        status: "SETTLED",
        message: "Payment was already settled previously",
      };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // If order already funded/shipped/completed, return idempotent success
    if (order.status !== "PENDING_PAYMENT") {
      return {
        success: true,
        isDuplicate: true,
        orderId,
        amount,
        status: order.status,
        message: `Order is already in state ${order.status}`,
      };
    }

    // ATOMIC DATABASE TRANSACTION
    await prisma.$transaction(async (tx) => {
      // 1. Update PaymentAttempt to SETTLED
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SETTLED",
          settledAt: new Date(),
        },
      });

      // 2. Transition Order to FUNDED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "FUNDED",
          paidAt: new Date(),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "PENDING_PAYMENT",
          toStatus: "FUNDED",
          actorId: "system",
          actorRole: "SYSTEM",
          reason: `Pembayaran ${attempt.paymentMethod} sebesar Rp ${amount.toLocaleString("id-ID")} berhasil diverifikasi [Demo Simulation]`,
        },
      });

      // 3. Create or Fund Escrow Account
      const escrowIdemp = `ESC-DEP-${attempt.id}`;
      if (order.escrowAccount) {
        await tx.escrowAccount.update({
          where: { id: order.escrowAccount.id },
          data: {
            status: "HELD",
          },
        });
      } else {
        await tx.escrowAccount.create({
          data: {
            orderId: order.id,
            amount: order.totalAmount,
            status: "HELD",
            idempotencyKey: escrowIdemp,
            ledgerEntries: {
              create: [
                {
                  type: "DEPOSIT",
                  direction: "CREDIT",
                  amount: order.totalAmount,
                  previousBalance: 0,
                  newBalance: order.totalAmount,
                  referenceId: attempt.id,
                  idempotencyKey: escrowIdemp,
                  notes: `Deposit pembayaran order #${order.orderNumber} via ${attempt.paymentMethod}`,
                },
              ],
            },
          },
        });
      }

      // 4. Update seller's held balance
      const sellerWallet = await tx.wallet.findUnique({
        where: { userId: order.sellerId },
      });

      if (sellerWallet) {
        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: {
            heldBalance: sellerWallet.heldBalance + order.itemPrice,
          },
        });
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          userId: order.buyerId,
          action: "PAYMENT_CONFIRMED",
          targetType: "Order",
          targetId: order.id,
          details: JSON.stringify({
            orderNumber: order.orderNumber,
            amount,
            method: attempt.paymentMethod,
            isSimulation: true,
          }),
        },
      });
    });

    return {
      success: true,
      isDuplicate: false,
      orderId,
      amount,
      status: "FUNDED",
      message: "Payment successfully confirmed and escrow funded",
    };
  }
}

export const defaultPaymentProvider = new DemoPaymentProvider();
