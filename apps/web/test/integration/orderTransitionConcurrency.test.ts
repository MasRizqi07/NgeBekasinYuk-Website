// Order Transition Compare-and-Set Concurrency Guard Integration Test (Task 3.6.4)
// Real PostgreSQL execution verifying race condition prevention on non-money transitions

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST as transitionOrder } from "@/app/api/orders/[id]/transition/route";

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

describe("H2: Order Transition Compare-and-Set Concurrency Guard (PostgreSQL)", () => {
  let seller: { id: string; email: string; name: string; role: string; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let buyer: { id: string; email: string; name: string; role: string; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let orderId: string;

  beforeEach(async () => {
    const suffix = Math.random().toString(36).substring(2, 8);

    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-cas-${suffix}@test.id`,
        name: "CAS Test Seller",
        role: "SELLER",
        hashedPassword: "test-password-hash",
        sellerProfile: {
          create: {
            storeName: `Store CAS ${suffix}`,
            storeSlug: `store-cas-${suffix}`,
            city: "Jakarta",
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
      id: sellerUser.id,
      email: sellerUser.email,
      name: sellerUser.name,
      role: sellerUser.role,
      isVerified: sellerUser.isVerified,
      avatar: sellerUser.avatar,
      accountStatus: sellerUser.accountStatus,
      sessionVersion: sellerUser.sessionVersion,
    };

    const buyerUser = await prisma.user.create({
      data: {
        email: `buyer-cas-${suffix}@test.id`,
        name: "CAS Test Buyer",
        role: "BUYER",
        hashedPassword: "test-password-hash",
      },
    });

    buyer = {
      id: buyerUser.id,
      email: buyerUser.email,
      name: buyerUser.name,
      role: buyerUser.role,
      isVerified: buyerUser.isVerified,
      avatar: buyerUser.avatar,
      accountStatus: buyerUser.accountStatus,
      sessionVersion: buyerUser.sessionVersion,
    };

    const listing = await prisma.productListing.create({
      data: {
        sellerId: seller.id,
        title: `CAS Item ${suffix}`,
        slug: `cas-item-${suffix}`,
        description: "Test description",
        brand: "Apple",
        model: "iPhone 13",
        price: 3000000,
        status: "RESERVED",
        category: "smartphone",
        categoryLabel: "Smartphone",
        condition: "LIKE_NEW",
        canNego: false,
      },
    });

    // Create FUNDED order with active escrow
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-CAS-${suffix.toUpperCase()}`,
        buyerId: buyer.id,
        sellerId: seller.id,
        listingId: listing.id,
        itemPrice: 3000000,
        shippingFee: 20000,
        escrowFee: 0,
        totalAmount: 3020000,
        status: "FUNDED",
        shippingAddress: "Jl. Sudirman No. 1",
        shippingCourier: "J&T Express",
        paidAt: new Date(),
        escrowAccount: {
          create: {
            amount: 3020000,
            status: "HELD",
            idempotencyKey: `ESC-CAS-${suffix}`,
          },
        },
      },
    });

    orderId = order.id;
  });

  it("fires two concurrent SHIPPED transitions from same seller: exactly one 200, one 409, and exactly one OrderStatusHistory row", async () => {
    currentSessionUser = seller;

    const makeRequest = (airwayBill: string) =>
      new Request(`http://localhost:3000/api/orders/${orderId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: "SHIPPED",
          shippingCourier: "J&T Express",
          shippingAirwayBill: airwayBill,
        }),
      });

    const context = { params: Promise.resolve({ id: orderId }) };

    // Fire two concurrent SHIPPED requests via Promise.all
    const [resA, resB] = await Promise.all([
      transitionOrder(makeRequest("JT1111111111"), context),
      transitionOrder(makeRequest("JT2222222222"), context),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const res200 = resA.status === 200 ? resA : resB;
    const res409 = resA.status === 409 ? resA : resB;

    const json200 = await res200.json();
    expect(json200.success).toBe(true);

    const json409 = await res409.json();
    expect(json409.error).toBe("ORDER_STATE_CHANGED");

    // Check PostgreSQL state
    const dbOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(dbOrder.status).toBe("SHIPPED");
    expect(dbOrder.shippedAt).not.toBeNull();

    // Exactly ONE history record for SHIPPED
    const historyRows = await prisma.orderStatusHistory.findMany({
      where: { orderId, toStatus: "SHIPPED" },
    });
    expect(historyRows.length).toBe(1);
    expect(historyRows[0].fromStatus).toBe("FUNDED");
    expect(historyRows[0].toStatus).toBe("SHIPPED");
    expect(historyRows[0].actorId).toBe(seller.id);
  });
});
