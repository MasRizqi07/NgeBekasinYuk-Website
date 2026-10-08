import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { POST as simulateWebhookRoute } from "@/app/api/payment/simulate-webhook/route";
import bcrypt from "bcryptjs";

// Mock validateAuthoritativeSession for testing
let activeUserId: string | null = null;
vi.mock("@/lib/auth/authoritativeSession", () => ({
  validateAuthoritativeSession: vi.fn(async () => {
    if (!activeUserId) return null;
    return await prisma.user.findUnique({
      where: { id: activeUserId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        avatar: true,
        accountStatus: true,
        sessionVersion: true,
      },
    });
  }),
}));

describe("Order Reservation Concurrency & Lazy Expiry Suite (PostgreSQL)", () => {
  let sellerId: string;
  let buyers: { id: string; email: string }[] = [];

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash("123456", 10);
    const suffix = Math.random().toString(36).substring(2, 8);

    // 1. Create Seller
    const seller = await prisma.user.create({
      data: {
        email: `seller-conc-${suffix}@test.id`,
        name: "Concurrency Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        sellerProfile: {
          create: {
            storeName: `Conc Store ${suffix}`,
            storeSlug: `conc-store-${suffix}`,
            city: "Jakarta Pusat",
          },
        },
      },
    });
    sellerId = seller.id;

    // 2. Create 5 distinct buyers
    buyers = [];
    for (let i = 0; i < 5; i++) {
      const buyer = await prisma.user.create({
        data: {
          email: `buyer-conc-${i}-${suffix}@test.id`,
          name: `Buyer ${i}`,
          role: "BUYER",
          hashedPassword: hashedPw,
          hashedPin,
        },
      });
      buyers.push({ id: buyer.id, email: buyer.email });
    }
  });

  async function createListing(initialStatus = "ACTIVE"): Promise<string> {
    const suffix = Math.random().toString(36).substring(2, 8);
    const listing = await prisma.productListing.create({
      data: {
        slug: `conc-item-${suffix}`,
        title: `Concurrency Test Device ${suffix}`,
        description: "Test description",
        price: 5000000,
        originalPrice: 6000000,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Apple",
        model: "iPhone 13",
        condition: "LIKE_NEW",
        canNego: false,
        status: initialStatus,
        sellerId,
      },
    });
    return listing.id;
  }

  function makeOrderRequest(listingId: string, buyerId: string, idempotencyKey: string): Request {
    return new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "x-test-user-id": buyerId,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Lapangan Banteng No. 1, Jakarta",
        courier: "J&T Express Regular",
        paymentMethod: "BCA_VA",
      }),
    });
  }

  it("1. 5 distinct buyers racing for the same listing (20 loop iterations)", async () => {
    for (let iteration = 0; iteration < 20; iteration++) {
      const listingId = await createListing("ACTIVE");

      // Execute 5 concurrent requests with distinct buyers
      const promises = buyers.map((buyer, idx) => {
        const req = makeOrderRequest(listingId, buyer.id, `idemp-race-${iteration}-${idx}-${Date.now()}`);
        activeUserId = buyer.id;
        return createOrderRoute(req);
      });

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      const count201 = statuses.filter((s) => s === 201).length;
      const count422 = statuses.filter((s) => s === 422).length;

      expect(count201).toBe(1);
      expect(count422).toBe(4);

      // Verify DB row invariants
      const orders = await prisma.order.findMany({ where: { listingId } });
      expect(orders.length).toBe(1);

      const listing = await prisma.productListing.findUniqueOrThrow({ where: { id: listingId } });
      expect(listing.status).toBe("RESERVED");
    }
  });

  it("2. 2 buyers racing for a listing whose blocking order is expired", async () => {
    const listingId = await createListing("RESERVED");

    // Seed a stale expired order (3 hours ago)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const staleOrder = await prisma.order.create({
      data: {
        id: `ord-stale-${Date.now()}`,
        orderNumber: `ORD-STALE-${Date.now()}`,
        buyerId: buyers[0].id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "PENDING_PAYMENT",
        shippingAddress: "Jl. Stale 1",
        createdAt: threeHoursAgo,
        updatedAt: threeHoursAgo,
        paymentAttempts: {
          create: {
            paymentMethod: "BCA_VA",
            amount: 5018000,
            status: "PENDING",
            expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // expired 1 hr ago
            providerName: "DemoPaymentProvider",
            idempotencyKey: `pay-stale-${Date.now()}`,
            createdAt: threeHoursAgo,
          },
        },
      },
    });

    // 2 buyers racing for the stale listing
    const reqBuyer1 = makeOrderRequest(listingId, buyers[1].id, `idemp-stale-b1-${Date.now()}`);
    const reqBuyer2 = makeOrderRequest(listingId, buyers[2].id, `idemp-stale-b2-${Date.now()}`);

    const [res1, res2] = await Promise.all([
      (async () => {
        activeUserId = buyers[1].id;
        return createOrderRoute(reqBuyer1);
      })(),
      (async () => {
        activeUserId = buyers[2].id;
        return createOrderRoute(reqBuyer2);
      })(),
    ]);

    const statuses = [res1.status, res2.status];
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s === 422).length).toBe(1);

    // Stale order cancelled exactly once
    const updatedStale = await prisma.order.findUniqueOrThrow({ where: { id: staleOrder.id } });
    expect(updatedStale.status).toBe("CANCELLED");

    const cancelHistories = await prisma.orderStatusHistory.findMany({
      where: { orderId: staleOrder.id, toStatus: "CANCELLED" },
    });
    expect(cancelHistories.length).toBe(1);

    // Stale payment attempts marked EXPIRED
    const staleAttempts = await prisma.paymentAttempt.findMany({
      where: { orderId: staleOrder.id },
    });
    expect(staleAttempts.every((a) => a.status === "EXPIRED")).toBe(true);

    // Listing remains RESERVED
    const listing = await prisma.productListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.status).toBe("RESERVED");
  });

  it("3. Late POST /api/payment/simulate-webhook for an order cancelled by lazy expiry is rejected", async () => {
    const listingId = await createListing("RESERVED");

    const twoHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000);
    const staleOrder = await prisma.order.create({
      data: {
        id: `ord-late-webhook-${Date.now()}`,
        orderNumber: `ORD-LATE-${Date.now()}`,
        buyerId: buyers[0].id,
        sellerId,
        listingId,
        itemPrice: 5000000,
        shippingFee: 18000,
        escrowFee: 0,
        totalAmount: 5018000,
        status: "CANCELLED",
        cancelledAt: new Date(),
        shippingAddress: "Jl. Stale 1",
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo,
        paymentAttempts: {
          create: {
            id: `pay-late-webhook-${Date.now()}`,
            paymentMethod: "BCA_VA",
            amount: 5018000,
            status: "EXPIRED",
            expiresAt: new Date(Date.now() - 30 * 60 * 1000),
            providerName: "DemoPaymentProvider",
            idempotencyKey: `pay-late-idemp-${Date.now()}`,
            createdAt: twoHoursAgo,
          },
        },
      },
      include: { paymentAttempts: true },
    });

    const paymentAttemptId = staleOrder.paymentAttempts[0].id;

    const webhookReq = new Request("http://localhost:3000/api/payment/simulate-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentAttemptId,
        orderId: staleOrder.id,
        amount: 5018000,
      }),
    });

    const initialLedgerCount = await prisma.escrowLedgerEntry.count();
    const initialEscrowAccountCount = await prisma.escrowAccount.count({ where: { orderId: staleOrder.id } });

    const webhookRes = await simulateWebhookRoute(webhookReq);
    expect(webhookRes.status).toBe(422);

    const finalLedgerCount = await prisma.escrowLedgerEntry.count();
    const finalEscrowAccountCount = await prisma.escrowAccount.count({ where: { orderId: staleOrder.id } });

    // Zero new ledger or escrow rows
    expect(finalLedgerCount).toBe(initialLedgerCount);
    expect(finalEscrowAccountCount).toBe(initialEscrowAccountCount);
  });

  it("4. Same buyer, different Idempotency-Key, same listing: second order rejected with 422", async () => {
    const listingId = await createListing("ACTIVE");
    activeUserId = buyers[0].id;

    const req1 = makeOrderRequest(listingId, buyers[0].id, `idemp-same-b-1-${Date.now()}`);
    const res1 = await createOrderRoute(req1);
    expect(res1.status).toBe(201);

    const req2 = makeOrderRequest(listingId, buyers[0].id, `idemp-same-b-2-${Date.now()}`);
    const res2 = await createOrderRoute(req2);
    expect(res2.status).toBe(422);
    const json2 = await res2.json();
    expect(json2.error).toBe("LISTING_NOT_ACTIVE");
  });

  it("5. Replay of same Idempotency-Key returns same order with single DB row", async () => {
    const listingId = await createListing("ACTIVE");
    activeUserId = buyers[0].id;
    const sameKey = `idemp-replay-key-${Date.now()}`;

    const req1 = makeOrderRequest(listingId, buyers[0].id, sameKey);
    const res1 = await createOrderRoute(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();

    const req2 = makeOrderRequest(listingId, buyers[0].id, sameKey);
    const res2 = await createOrderRoute(req2);
    expect(res2.status).toBe(201);
    const data2 = await res2.json();

    expect(data2.id).toBe(data1.id);
    const orderCount = await prisma.order.count({ where: { listingId } });
    expect(orderCount).toBe(1);
  });

  it("6. Decision D7: POST /api/orders on an ARCHIVED listing is rejected with 422 LISTING_NOT_ACTIVE", async () => {
    const listingId = await createListing("ARCHIVED");
    activeUserId = buyers[0].id;

    const req = makeOrderRequest(listingId, buyers[0].id, `idemp-archived-${Date.now()}`);
    const res = await createOrderRoute(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("LISTING_NOT_ACTIVE");
  });
});
