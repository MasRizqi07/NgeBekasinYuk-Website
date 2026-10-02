// Full Server-Authoritative Journey Integration Test (Real PostgreSQL)
// Verifies: POST /api/orders -> GET /api/orders -> simulate-webhook -> ship -> deliver -> release -> seller wallet ledger

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST as createOrderRoute, GET as getOrdersRoute } from "@/app/api/orders/route";
import { GET as getOrderByIdRoute } from "@/app/api/orders/[id]/route";
import { POST as transitionRoute } from "@/app/api/orders/[id]/transition/route";
import { POST as simulateWebhookRoute } from "@/app/api/payment/simulate-webhook/route";
import bcrypt from "bcryptjs";

let currentSessionUser: {
  id: string;
  email: string;
  name: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  isVerified: boolean;
  avatar: string | null;
  accountStatus: string;
  sessionVersion: number;
} | null = null;

vi.mock("@/lib/auth/authoritativeSession", () => ({
  validateAuthoritativeSession: vi.fn(async () => currentSessionUser),
}));

describe("Full Server-Authoritative Order Journey (Real PostgreSQL)", () => {
  let buyer: { id: string; email: string; name: string; role: "BUYER"; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let seller: { id: string; email: string; name: string; role: "SELLER"; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let listingId: string;
  const listingPrice = 8500000;

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash("123456", 10);
    const suffix = Math.random().toString(36).substring(2, 8);

    // Create Buyer
    const buyerRow = await prisma.user.create({
      data: {
        email: `buyer-full-${suffix}@test.id`,
        name: "Buyer Journey",
        role: "BUYER",
        hashedPassword: hashedPw,
        hashedPin,
      },
    });
    buyer = {
      id: buyerRow.id,
      email: buyerRow.email,
      name: buyerRow.name,
      role: "BUYER",
      isVerified: buyerRow.isVerified,
      avatar: buyerRow.avatar,
      accountStatus: buyerRow.accountStatus,
      sessionVersion: buyerRow.sessionVersion,
    };

    // Create Seller with Wallet
    const sellerRow = await prisma.user.create({
      data: {
        email: `seller-full-${suffix}@test.id`,
        name: "Seller Journey",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        sellerProfile: {
          create: {
            storeName: "Toko Second Ori",
            storeSlug: `store-${suffix}`,
            city: "Jakarta Barat",
          },
        },
        wallet: {
          create: {
            activeBalance: 0,
            heldBalance: 0,
          },
        },
      },
    });
    seller = {
      id: sellerRow.id,
      email: sellerRow.email,
      name: sellerRow.name,
      role: "SELLER",
      isVerified: sellerRow.isVerified,
      avatar: sellerRow.avatar,
      accountStatus: sellerRow.accountStatus,
      sessionVersion: sellerRow.sessionVersion,
    };

    // Create Active Listing
    const listing = await prisma.productListing.create({
      data: {
        id: `list-journey-${suffix}`,
        slug: `slug-journey-${suffix}`,
        sellerId: seller.id,
        title: "iPad Air 5 64GB Space Grey",
        description: "Mulus 99% seperti baru, baterai 98%",
        price: listingPrice,
        category: "tablet",
        categoryLabel: "Tablet",
        brand: "Apple",
        model: "iPad Air 5",
        condition: "LIKE_NEW",
        status: "ACTIVE",
      },
    });
    listingId = listing.id;
  });

  it("completes full end-to-end server journey: createOrder -> getOrders -> webhookFund -> ship -> deliver -> inspect -> release", async () => {
    // 1. BUYER creates order via POST /api/orders
    currentSessionUser = buyer;
    const idempotencyKey = `journey-idem-${Date.now()}`;
    const createReq = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Merdeka No. 45, Jakarta Selatan 12000",
        courier: "J&T Express Regular",
        paymentMethod: "BCA_VA",
      }),
    });

    const createRes = await createOrderRoute(createReq);
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.id).toMatch(/^ord-/);
    expect(createdData.status).toBe("PENDING_PAYMENT");
    expect(createdData.totalAmount).toBe(listingPrice + 18000); // 8500000 + 18000
    const orderId = createdData.id;
    const paymentAttemptId = createdData.paymentAttemptId || createdData.paymentAttempts[0].id;
    expect(paymentAttemptId).toBeDefined();

    // 2. BUYER fetches orders list via GET /api/orders
    const listReq = new Request("http://localhost:3000/api/orders?status=ALL");
    const listRes = await getOrdersRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.orders.some((o: { id: string }) => o.id === orderId)).toBe(true);

    // 3. GET /api/orders/[id] returns order detail
    const getReq = new Request(`http://localhost:3000/api/orders/${orderId}`);
    const getRes = await getOrderByIdRoute(getReq, { params: Promise.resolve({ id: orderId }) });
    expect(getRes.status).toBe(200);
    const detailData = await getRes.json();
    expect(detailData.id).toBe(orderId);
    expect(detailData.buyerId).toBe(buyer.id);

    // 4. Payment webhook simulation funds the order
    const webhookReq = new Request("http://localhost:3000/api/payment/simulate-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentAttemptId,
        orderId,
        amount: createdData.totalAmount,
      }),
    });

    const webhookRes = await simulateWebhookRoute(webhookReq);
    expect(webhookRes.status).toBe(200);
    const webhookData = await webhookRes.json();
    expect(webhookData.success).toBe(true);
    expect(webhookData.status).toBe("FUNDED");

    // Check PostgreSQL state: Order must be FUNDED with escrowAccount
    const dbOrderFunded = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });
    expect(dbOrderFunded?.status).toBe("FUNDED");
    expect(dbOrderFunded?.escrowAccount).not.toBeNull();
    expect(dbOrderFunded?.escrowAccount?.status).toBe("HELD");

    // 5. SELLER inputs AWB and marks SHIPPED
    currentSessionUser = seller;
    const shipReq = new Request(`http://localhost:3000/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus: "SHIPPED",
        shippingAirwayBill: "JT928174829102",
        shippingCourier: "J&T Express Regular",
      }),
    });

    const shipRes = await transitionRoute(shipReq, { params: Promise.resolve({ id: orderId }) });
    expect(shipRes.status).toBe(200);

    const dbOrderShipped = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrderShipped?.status).toBe("SHIPPED");
    expect(dbOrderShipped?.shippingAirwayBill).toBe("JT928174829102");

    // 6. Courier/Admin marks DELIVERED and starts INSPECTION
    currentSessionUser = {
      ...buyer,
      id: "admin-courier-system",
      role: "ADMIN",
    };
    const deliverReq = new Request(`http://localhost:3000/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus: "DELIVERED",
      }),
    });

    const deliverRes = await transitionRoute(deliverReq, { params: Promise.resolve({ id: orderId }) });
    expect(deliverRes.status).toBe(200);

    const inspectReq = new Request(`http://localhost:3000/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus: "INSPECTING",
      }),
    });

    const inspectRes = await transitionRoute(inspectReq, { params: Promise.resolve({ id: orderId }) });
    expect(inspectRes.status).toBe(200);

    const dbOrderDelivered = await prisma.order.findUnique({ where: { id: orderId } });
    expect(dbOrderDelivered?.status).toBe("INSPECTING");
    expect(dbOrderDelivered?.inspectionExpiresAt).not.toBeNull();

    // 7. BUYER releases escrow funds -> transitions to COMPLETED
    currentSessionUser = buyer;
    const completeReq = new Request(`http://localhost:3000/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toStatus: "COMPLETED",
      }),
    });

    const completeRes = await transitionRoute(completeReq, { params: Promise.resolve({ id: orderId }) });
    expect(completeRes.status).toBe(200);
    const completeData = await completeRes.json();
    expect(completeData.escrowReleased).toBe(true);

    // 8. Verify PostgreSQL final state:
    // - Order status is COMPLETED
    const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(finalOrder?.status).toBe("COMPLETED");

    // - EscrowAccount status is released
    const finalEscrow = await prisma.escrowAccount.findUnique({ where: { orderId } });
    expect(finalEscrow?.isReleased).toBe(true);

    // - Seller wallet has been credited with itemPrice (8,500,000)
    const sellerWallet = await prisma.wallet.findUnique({ where: { userId: seller.id } });
    expect(sellerWallet?.activeBalance).toBe(listingPrice);
    expect(sellerWallet?.heldBalance).toBe(0);

    // - WalletLedger has an immutable ESCROW_RELEASE entry
    const ledger = await prisma.walletLedgerEntry.findFirst({
      where: { walletId: sellerWallet?.id, type: "ESCROW_RELEASE" },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(listingPrice);
    expect(ledger?.direction).toBe("CREDIT");
  });
});
