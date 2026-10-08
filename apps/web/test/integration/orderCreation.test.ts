// Order Creation Server-Authoritative Flow & Idempotency Integration Tests (PostgreSQL)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST } from "@/app/api/orders/route";
import bcrypt from "bcryptjs";

// Mock validateAuthoritativeSession for the route handler integration test
let testUserId: string | null = null;
vi.mock("@/lib/auth/authoritativeSession", () => ({
  validateAuthoritativeSession: vi.fn(async () => {
    if (!testUserId) return null;
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
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
    return user;
  }),
}));

describe("Server-Authoritative Order Creation Integration Tests (PostgreSQL)", () => {
  let buyerId: string;
  let sellerId: string;
  let listingId: string;
  const listingPrice = 7500000;

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash("123456", 10);
    const suffix = Math.random().toString(36).substring(2, 8);

    // Create Buyer
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-order-${suffix}@test.id`,
        name: "Test Buyer",
        role: "BUYER",
        hashedPassword: hashedPw,
        hashedPin,
      },
    });
    buyerId = buyer.id;

    // Create Seller
    const seller = await prisma.user.create({
      data: {
        email: `seller-order-${suffix}@test.id`,
        name: "Test Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        sellerProfile: {
          create: {
            storeName: `Seller Store ${suffix}`,
            storeSlug: `store-${suffix}`,
            city: "Jakarta Barat",
          },
        },
      },
    });
    sellerId = seller.id;

    // Create Active Listing
    const listing = await prisma.productListing.create({
      data: {
        id: `list-order-${suffix}`,
        slug: `slug-order-${suffix}`,
        title: "Test Gadget Item",
        description: "Unit mulus garansi aktif",
        price: listingPrice,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Apple",
        model: "iPhone 13",
        condition: "LIKE_NEW",
        status: "ACTIVE",
        sellerId: seller.id,
      },
    });
    listingId = listing.id;

    testUserId = buyer.id;
  });

  it("1. Tampered itemPrice / totalAmount in body -> 400, no order row created", async () => {
    const idempotencyKey = `idemp-tamper-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const tamperedPayload = {
      listingId,
      shippingAddress: "Jl. Gatot Subroto No. 123, Jakarta",
      courier: "J&T Express",
      paymentMethod: "BCA_VA",
      itemPrice: 1000, // TAMPER ATTACK: attempting to buy for Rp 1.000 instead of Rp 7.500.000
      totalAmount: 21000,
    };

    const request = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(tamperedPayload),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("VALIDATION_ERROR");

    // Verify in PostgreSQL: Zero order records created
    const count = await prisma.order.count({
      where: { listingId },
    });
    expect(count).toBe(0);
  });

  it("2. Own listing purchase attempt -> 403, no order row created", async () => {
    // Switch session to SELLER (attempting to purchase own listing)
    testUserId = sellerId;

    const idempotencyKey = `idemp-own-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      listingId,
      shippingAddress: "Jl. Sudirman No. 45, Jakarta",
      courier: "SiCepat BEST",
      paymentMethod: "BCA_VA",
    };

    const request = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(request);
    expect(res.status).toBe(403);

    const json = await res.json();
    expect(json.error).toBe("CANNOT_BUY_OWN_LISTING");

    const count = await prisma.order.count({
      where: { listingId },
    });
    expect(count).toBe(0);
  });

  it("3. Same Idempotency-Key twice -> exactly one order row created, identical response", async () => {
    testUserId = buyerId;
    const idempotencyKey = `idemp-replay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      listingId,
      shippingAddress: "Jl. Merdeka No. 1, Jakarta Pusat",
      courier: "J&T Express VIP",
      paymentMethod: "BCA_VA",
    };

    // First request
    const req1 = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const json1 = await res1.json();
    expect(json1.id).toBeDefined();
    expect(json1.orderNumber).toMatch(/^ORD-\d{4}-[0-9A-F]{6}$/);

    // Second request with SAME idempotency key
    const req2 = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const json2 = await res2.json();

    // Verify exact replay identity
    expect(json2.id).toBe(json1.id);
    expect(json2.orderNumber).toBe(json1.orderNumber);
    expect(json2.totalAmount).toBe(json1.totalAmount);

    // Verify database: Exactly 1 order in Postgres
    const orders = await prisma.order.findMany({
      where: { listingId },
    });
    expect(orders.length).toBe(1);

    // Verify idempotency record in Postgres
    const idempRecord = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    expect(idempRecord).not.toBeNull();
    expect(idempRecord?.resourceId).toBe(json1.id);
  });

  it("4. Inactive or unknown listing -> 404/422, no order row created", async () => {
    testUserId = buyerId;

    // 4a. Unknown listing ID
    const reqUnknown = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `idemp-unk-${Date.now()}`,
      },
      body: JSON.stringify({
        listingId: "non-existent-listing-id-xyz",
        shippingAddress: "Jl. Thamrin No. 9, Jakarta",
        courier: "JNE YES",
        paymentMethod: "BCA_VA",
      }),
    });

    const resUnknown = await POST(reqUnknown);
    expect(resUnknown.status).toBe(404);
    const jsonUnknown = await resUnknown.json();
    expect(jsonUnknown.error).toBe("LISTING_NOT_FOUND");

    // 4b. Inactive listing (status = RESERVED)
    await prisma.productListing.update({
      where: { id: listingId },
      data: { status: "RESERVED" },
    });

    const reqInactive = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `idemp-inact-${Date.now()}`,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Thamrin No. 9, Jakarta",
        courier: "JNE YES",
        paymentMethod: "BCA_VA",
      }),
    });

    const resInactive = await POST(reqInactive);
    expect(resInactive.status).toBe(422);
    const jsonInactive = await resInactive.json();
    expect(jsonInactive.error).toBe("LISTING_NOT_ACTIVE");

    // Ensure no order created
    const count = await prisma.order.count({ where: { listingId } });
    expect(count).toBe(0);
  });

  it("5. Unauthenticated request -> 401, no order row created", async () => {
    testUserId = null; // Unauthenticated

    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `idemp-unauth-${Date.now()}`,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Rasuna Said No. 5, Jakarta",
        courier: "J&T Express",
        paymentMethod: "BCA_VA",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");

    const count = await prisma.order.count({ where: { listingId } });
    expect(count).toBe(0);
  });

  it("6. Missing Idempotency-Key header -> 400 IDEMPOTENCY_KEY_REQUIRED", async () => {
    testUserId = buyerId;

    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Rasuna Said No. 5, Jakarta",
        courier: "J&T Express",
        paymentMethod: "BCA_VA",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("7. Written order has buyerId === session.id, status === PENDING_PAYMENT, and correct server breakdown", async () => {
    testUserId = buyerId;
    const idempotencyKey = `idemp-valid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      listingId,
      shippingAddress: "Jl. Asia Afrika No. 8, Senayan, Jakarta",
      courier: "J&T Express VIP", // rate is 22000
      paymentMethod: "BCA_VA",
    };

    const req = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();

    // Verify response DTO
    expect(json.id).toBeDefined();
    expect(json.buyerId).toBe(buyerId);
    expect(json.sellerId).toBe(sellerId);
    expect(json.itemPrice).toBe(7500000);
    expect(json.shippingFee).toBe(22000);
    expect(json.escrowFee).toBe(0);
    expect(json.totalAmount).toBe(7522000);
    expect(json.status).toBe("PENDING_PAYMENT");
    expect(json.courier).toBe("J&T Express VIP");
    expect(json.paymentMethod).toBe("BCA_VA");
    expect(json.vaNumber).toBeDefined();

    // Verify in PostgreSQL
    const dbOrder = await prisma.order.findUnique({
      where: { id: json.id },
      include: {
        statusHistory: true,
        paymentAttempts: true,
      },
    });

    expect(dbOrder).not.toBeNull();
    expect(dbOrder?.buyerId).toBe(buyerId);
    expect(dbOrder?.sellerId).toBe(sellerId);
    expect(dbOrder?.status).toBe("PENDING_PAYMENT");
    expect(dbOrder?.totalAmount).toBe(7522000);
    expect(dbOrder?.itemPrice).toBe(7500000);
    expect(dbOrder?.shippingFee).toBe(22000);

    // Verify status history
    expect(dbOrder?.statusHistory.length).toBe(1);
    expect(dbOrder?.statusHistory[0].toStatus).toBe("PENDING_PAYMENT");
    expect(dbOrder?.statusHistory[0].actorId).toBe(buyerId);

    // Verify payment attempt
    expect(dbOrder?.paymentAttempts.length).toBe(1);
    expect(dbOrder?.paymentAttempts[0].amount).toBe(7522000);
    expect(dbOrder?.paymentAttempts[0].status).toBe("PENDING");
    expect(dbOrder?.paymentAttempts[0].paymentMethod).toBe("BCA_VA");

    // Verify audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { targetId: json.id },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe("ORDER_CREATED");
    expect(auditLogs[0].userId).toBe(buyerId);
  });

  it("8. I1 Defense (Decision D5): Second order on already RESERVED listing is rejected with 422", async () => {
    testUserId = buyerId;

    // First order creation succeeds and reserves listing
    const idemp1 = `idemp-i1-first-${Date.now()}`;
    const req1 = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idemp1,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Sudirman No. 1, Jakarta",
        courier: "J&T Express",
        paymentMethod: "BCA_VA",
      }),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(201);

    // Verify listing is now RESERVED
    const dbListing = await prisma.productListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(dbListing.status).toBe("RESERVED");

    // Second order on same listing with DIFFERENT idempotency key (or another buyer)
    const idemp2 = `idemp-i1-second-${Date.now()}`;
    const req2 = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idemp2,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Gatot Subroto No. 2, Jakarta",
        courier: "J&T Express",
        paymentMethod: "BCA_VA",
      }),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(422);
    const json2 = await res2.json();
    expect(json2.error).toBe("LISTING_NOT_ACTIVE");

    // Database row count invariant: exactly 1 order row exists
    const orderCount = await prisma.order.count({ where: { listingId } });
    expect(orderCount).toBe(1);
  });
});
