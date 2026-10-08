import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST as simulateOrderRoute } from "@/app/api/orders/[id]/simulate/route";
import { GET as getOrderRoute } from "@/app/api/orders/[id]/route";
import { env } from "@/lib/env";

let currentSessionUser: {
  id: string;
  email: string;
  name: string;
  role: string;
  isVerified: boolean;
  avatar: string | null;
  accountStatus: string;
  sessionVersion: number;
} | null = null;

vi.mock("@/lib/auth/authoritativeSession", () => ({
  validateAuthoritativeSession: vi.fn(async () => currentSessionUser),
}));

describe("D4: Demo Simulation Controls Gate & Execution Suite", () => {
  let buyer: { id: string; email: string; name: string };
  let seller: { id: string; email: string; name: string };
  let outsider: { id: string; email: string; name: string };
  let orderId: string;

  beforeEach(async () => {
    const suffix = Math.random().toString(36).substring(2, 8);

    const bUser = await prisma.user.create({
      data: {
        email: `buyer-d4-${suffix}@test.id`,
        name: "D4 Buyer",
        role: "BUYER",
        hashedPassword: "test-password-hash",
      },
    });
    buyer = { id: bUser.id, email: bUser.email, name: bUser.name };

    const sUser = await prisma.user.create({
      data: {
        email: `seller-d4-${suffix}@test.id`,
        name: "D4 Seller",
        role: "SELLER",
        hashedPassword: "test-password-hash",
        sellerProfile: {
          create: {
            storeName: `Store D4 ${suffix}`,
            storeSlug: `store-d4-${suffix}`,
            city: "Jakarta",
          },
        },
      },
    });
    seller = { id: sUser.id, email: sUser.email, name: sUser.name };

    const oUser = await prisma.user.create({
      data: {
        email: `outsider-d4-${suffix}@test.id`,
        name: "D4 Outsider",
        role: "BUYER",
        hashedPassword: "test-password-hash",
      },
    });
    outsider = { id: oUser.id, email: oUser.email, name: oUser.name };

    const listing = await prisma.productListing.create({
      data: {
        title: `Item D4 ${suffix}`,
        slug: `item-d4-${suffix}`,
        description: "Listing description for D4 test",
        price: 3000000,
        originalPrice: 3500000,
        category: "LAPTOP",
        categoryLabel: "Laptop",
        brand: "Dell",
        model: "XPS 13",
        condition: "LIKE_NEW",
        sellerId: seller.id,
        status: "RESERVED",
      },
    });

    const ord = await prisma.order.create({
      data: {
        id: `ord-d4-${suffix}`,
        orderNumber: `ORD-D4-${suffix}`,
        buyerId: buyer.id,
        sellerId: seller.id,
        listingId: listing.id,
        itemPrice: 3000000,
        shippingFee: 20000,
        escrowFee: 0,
        totalAmount: 3020000,
        status: "FUNDED",
        shippingAddress: "Jl. Merdeka No. 1",
      },
    });
    orderId = ord.id;
  });

  afterEach(() => {
    currentSessionUser = null;
  });

  it("1. Reject with 404 when demo flag is disabled", async () => {
    const originalFlag = env.DEMO_PAYMENT_PROVIDER;
    try {
      (env as { DEMO_PAYMENT_PROVIDER: boolean }).DEMO_PAYMENT_PROVIDER = false;

      currentSessionUser = {
        ...buyer,
        role: "BUYER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const req = new Request(`http://localhost:3000/api/orders/${orderId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_SHIPPED" }),
      });

      const res = await simulateOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("NOT_FOUND");
    } finally {
      (env as { DEMO_PAYMENT_PROVIDER: boolean }).DEMO_PAYMENT_PROVIDER = originalFlag;
    }
  });

  it("2. Reject with 404 when APP_ENV is production even if demo flag is true", async () => {
    const originalAppEnv = env.APP_ENV;
    try {
      (env as { APP_ENV: string }).APP_ENV = "production";

      currentSessionUser = {
        ...buyer,
        role: "BUYER",
        isVerified: true,
        avatar: null,
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      };

      const req = new Request(`http://localhost:3000/api/orders/${orderId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SIMULATE_SHIPPED" }),
      });

      const res = await simulateOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("NOT_FOUND");
    } finally {
      (env as { APP_ENV: string }).APP_ENV = originalAppEnv;
    }
  });

  it("3. Reject with 403 when authenticated caller is not buyer, seller, or admin", async () => {
    currentSessionUser = {
      ...outsider,
      role: "BUYER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };

    const req = new Request(`http://localhost:3000/api/orders/${orderId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_SHIPPED" }),
    });

    const res = await simulateOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("FORBIDDEN");
  });

  it("4. Successfully simulate shipping (FUNDED -> SHIPPED) when called by buyer or seller", async () => {
    currentSessionUser = {
      ...buyer,
      role: "BUYER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };

    const req = new Request(`http://localhost:3000/api/orders/${orderId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_SHIPPED" }),
    });

    const res = await simulateOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.order.status).toBe("SHIPPED");
    expect(json.order.shippingAirwayBill).toMatch(/^JT\d+/);

    const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(dbOrder.status).toBe("SHIPPED");
    expect(dbOrder.shippedAt).not.toBeNull();

    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId, toStatus: "SHIPPED" },
    });
    expect(history.length).toBe(1);
    expect(history[0].fromStatus).toBe("FUNDED");
  });

  it("5. Successfully simulate delivery (SHIPPED -> DELIVERED -> INSPECTING) with inspection window", async () => {
    // Put order in SHIPPED status first
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        shippedAt: new Date(),
        shippingCourier: "JT Express",
        shippingAirwayBill: "JT9999999999",
      },
    });

    currentSessionUser = {
      ...buyer,
      role: "BUYER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };

    const req = new Request(`http://localhost:3000/api/orders/${orderId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_DELIVERED" }),
    });

    const res = await simulateOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.order.status).toBe("INSPECTING");

    const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(dbOrder.status).toBe("INSPECTING");
    expect(dbOrder.deliveredAt).not.toBeNull();
    expect(dbOrder.inspectionStartedAt).not.toBeNull();
    expect(dbOrder.inspectionExpiresAt).not.toBeNull();

    // Verify 2 status history records created: to DELIVERED and to INSPECTING
    const deliveredHist = await prisma.orderStatusHistory.findMany({
      where: { orderId, toStatus: "DELIVERED" },
    });
    expect(deliveredHist.length).toBe(1);

    const inspectingHist = await prisma.orderStatusHistory.findMany({
      where: { orderId, toStatus: "INSPECTING" },
    });
    expect(inspectingHist.length).toBe(1);
  });

  it("6. Rejects invalid transition (e.g. SIMULATE_SHIPPED on PENDING_PAYMENT order) with 422", async () => {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PENDING_PAYMENT" },
    });

    currentSessionUser = {
      ...buyer,
      role: "BUYER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };

    const req = new Request(`http://localhost:3000/api/orders/${orderId}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_SHIPPED" }),
    });

    const res = await simulateOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("INVALID_ORDER_TRANSITION");
  });

  it("7. GET /api/orders/[id] includes isSimulationAllowed accurately based on environment", async () => {
    currentSessionUser = {
      ...buyer,
      role: "BUYER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };

    const req = new Request(`http://localhost:3000/api/orders/${orderId}`);
    const res = await getOrderRoute(req, { params: Promise.resolve({ id: orderId }) });
    expect(res.status).toBe(200);
    const dto = await res.json();
    expect(dto.isSimulationAllowed).toBe(true);
  });
});
