import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcryptjs";
import { defaultPaymentProvider } from "@/domain/payment/PaymentProvider";
import { EscrowLedgerService } from "@/domain/escrow/EscrowLedgerService";
import { assertTransition } from "@/domain/order/OrderStateMachine";

describe("Order & Escrow End-to-End Lifecycle Integration Test", () => {
  let buyerId: string;
  let sellerId: string;
  let orderId: string;
  let paymentAttemptId: string;

  beforeEach(async () => {
    const ts = Date.now().toString().slice(-6);
    const hashed = await bcrypt.hash("Password123!", 10);

    const buyer = await prisma.user.create({
      data: {
        email: `e2e-buyer-${ts}@test.id`,
        name: "E2E Buyer",
        role: "BUYER",
        hashedPassword: hashed,
      },
    });
    buyerId = buyer.id;

    const seller = await prisma.user.create({
      data: {
        email: `e2e-seller-${ts}@test.id`,
        name: "E2E Seller",
        role: "SELLER",
        hashedPassword: hashed,
        wallet: {
          create: {
            activeBalance: 0,
            heldBalance: 0,
          },
        },
      },
    });
    sellerId = seller.id;

    const listing = await prisma.productListing.create({
      data: {
        slug: `e2e-macbook-${ts}`,
        title: "MacBook Pro M2 16GB",
        description: "Mulus garansi resmi",
        price: 18000000,
        category: "laptop",
        categoryLabel: "Laptop",
        brand: "Apple",
        model: "MacBook Pro M2",
        condition: "LIKE_NEW",
        sellerId: seller.id,
      },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-E2E-${ts}`,
        buyerId: buyer.id,
        sellerId: seller.id,
        listingId: listing.id,
        itemPrice: 18000000,
        shippingFee: 50000,
        totalAmount: 18050000,
        status: "PENDING_PAYMENT",
        shippingAddress: "Jl. Sudirman No. 10 Jakarta",
      },
    });
    orderId = order.id;

    // Create payment attempt
    const payment = await defaultPaymentProvider.createPayment({
      orderId: order.id,
      amount: 18050000,
      paymentMethod: "BCA_VA",
    });
    paymentAttemptId = payment.paymentAttemptId;
  });

  it("executes full lifecycle: payment -> shipment -> inspection -> receipt confirmation -> escrow release", async () => {
    // 1. Payment webhook triggers funding
    const webhookRes = await defaultPaymentProvider.simulateWebhook({
      paymentAttemptId,
      orderId,
      amount: 18050000,
    });
    expect(webhookRes.success).toBe(true);
    expect(webhookRes.status).toBe("FUNDED");

    // Verify order funded and escrow created
    let order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });
    expect(order?.status).toBe("FUNDED");
    expect(order?.escrowAccount?.status).toBe("HELD");
    expect(order?.escrowAccount?.amount).toBe(18050000);

    // Verify seller held balance allocated
    let sellerWallet = await prisma.wallet.findUnique({ where: { userId: sellerId } });
    expect(sellerWallet?.heldBalance).toBe(18000000);
    expect(sellerWallet?.activeBalance).toBe(0);

    // 2. Seller ships order
    assertTransition("FUNDED", "SHIPPED", {
      actorId: sellerId,
      actorRole: "SELLER",
      order: {
        id: orderId,
        buyerId,
        sellerId,
        status: "FUNDED",
      },
    });

    order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        shippedAt: new Date(),
        shippingCourier: "J&T Express",
        shippingAirwayBill: "JT99281726",
      },
      include: { escrowAccount: true },
    });
    expect(order.status).toBe("SHIPPED");

    // 3. Courier marks delivered -> starts 2x24h inspection
    const deliveryTime = new Date();
    const expiresTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

    order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "INSPECTING",
        deliveredAt: deliveryTime,
        inspectionStartedAt: deliveryTime,
        inspectionExpiresAt: expiresTime,
      },
      include: { escrowAccount: true },
    });
    expect(order.status).toBe("INSPECTING");

    // 4. Buyer confirms receipt -> executes authoritative escrow release
    assertTransition("INSPECTING", "COMPLETED", {
      actorId: buyerId,
      actorRole: "BUYER",
      order: {
        id: orderId,
        buyerId,
        sellerId,
        status: "INSPECTING",
        inspectionExpiresAt: expiresTime,
      },
    });

    const releaseRes = await EscrowLedgerService.releaseEscrow({
      orderId,
      actorId: buyerId,
      actorRole: "BUYER",
    });

    expect(releaseRes.success).toBe(true);
    expect(releaseRes.releasedAmount).toBe(18000000);

    // 5. Verify final financial state in DB
    order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });
    expect(order?.status).toBe("COMPLETED");
    expect(order?.escrowAccount?.isReleased).toBe(true);

    sellerWallet = await prisma.wallet.findUnique({ where: { userId: sellerId } });
    expect(sellerWallet?.activeBalance).toBe(18000000);
    expect(sellerWallet?.heldBalance).toBe(0);

    // Verify wallet ledger entry
    const ledger = await prisma.walletLedgerEntry.findFirst({
      where: { walletId: sellerWallet?.id, type: "ESCROW_RELEASE" },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(18000000);
    expect(ledger?.direction).toBe("CREDIT");
  });
});
