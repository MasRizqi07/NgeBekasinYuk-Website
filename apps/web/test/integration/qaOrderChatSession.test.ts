import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";
import { POST as createConversationRoute } from "@/app/api/conversations/route";
import { GET as getSessionRoute } from "@/app/api/auth/session/route";
import { assertNoSecrets } from "./orderSecretLeak.test";

let currentTestSession: {
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
  validateAuthoritativeSession: vi.fn(async () => currentTestSession),
}));

describe("QA Fixes Integration: Order-Scoped Chat & Safe Auth Session", () => {
  const createdUserIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdConversationIds: string[] = [];

  let buyerId: string;
  let sellerId: string;
  let strangerId: string;
  let listingId: string;
  let reservedOrderId: string;

  beforeEach(async () => {
    const ts = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const hash = await bcrypt.hash("Password123!", 8);

    const [buyer, seller, stranger] = await Promise.all([
      prisma.user.create({
        data: {
          email: `qa-buyer-${ts}@test.id`,
          name: "QA Buyer",
          role: "BUYER",
          hashedPassword: hash,
          hashedPin: "SENTINEL_PIN_HASH",
          totpSecretCiphertext: "SENTINEL_TOTP",
        },
      }),
      prisma.user.create({
        data: {
          email: `qa-seller-${ts}@test.id`,
          name: "QA Seller",
          role: "SELLER",
          isVerified: true,
          hashedPassword: hash,
          sellerProfile: {
            create: {
              storeName: "QA Store",
              storeSlug: `qa-store-${ts}`,
              city: "Bandung",
              bio: "Seller terverifikasi",
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          email: `qa-stranger-${ts}@test.id`,
          name: "QA Stranger",
          role: "BUYER",
          hashedPassword: hash,
        },
      }),
    ]);

    buyerId = buyer.id;
    sellerId = seller.id;
    strangerId = stranger.id;
    createdUserIds.push(buyerId, sellerId, strangerId);

    const listing = await prisma.productListing.create({
      data: {
        slug: `qa-reserved-item-${ts}`,
        title: "QA Reserved Gadget",
        description: "Test reserved listing order chat resumption",
        price: 4000000,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Samsung",
        model: "S23",
        condition: "LIKE_NEW",
        status: "RESERVED",
        sellerId,
      },
    });
    listingId = listing.id;
    createdListingIds.push(listingId);

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-QA-${ts}`,
        buyerId,
        sellerId,
        listingId,
        itemPrice: 4000000,
        shippingFee: 45000,
        totalAmount: 4045000,
        status: "INSPECTING",
        shippingAddress: "Jl. Braga No. 1 Bandung",
        shippingCourier: "GoSend Instant Motor",
      },
    });
    reservedOrderId = order.id;
    createdOrderIds.push(reservedOrderId);
  });

  afterAll(async () => {
    if (createdConversationIds.length > 0) {
      await prisma.conversation.deleteMany({
        where: { id: { in: createdConversationIds } },
      });
    }
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (createdListingIds.length > 0) {
      await prisma.productListing.deleteMany({
        where: { id: { in: createdListingIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.sellerProfile.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
  });

  it("POST /api/conversations { orderId } lets buyer & seller resume chat on RESERVED listing, blocks strangers (403)", async () => {
    // 1. Stranger blocked with 403
    currentTestSession = {
      id: strangerId,
      email: "stranger@test.id",
      name: "QA Stranger",
      role: "BUYER",
      isVerified: false,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };
    const strangerRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: reservedOrderId }),
      })
    );
    expect(strangerRes.status).toBe(403);

    // 2. Buyer opens order conversation even while listing is RESERVED (returns 201)
    currentTestSession = {
      id: buyerId,
      email: "buyer@test.id",
      name: "QA Buyer",
      role: "BUYER",
      isVerified: false,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };
    const buyerRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: reservedOrderId }),
      })
    );
    expect(buyerRes.status).toBe(201);
    const buyerJson = await buyerRes.json();
    expect(buyerJson.id).toBeTruthy();
    createdConversationIds.push(buyerJson.id);

    // 3. Seller opens exact same order conversation (returns 200 with same id)
    currentTestSession = {
      id: sellerId,
      email: "seller@test.id",
      name: "QA Seller",
      role: "SELLER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 1,
    };
    const sellerRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: reservedOrderId }),
      })
    );
    expect(sellerRes.status).toBe(200);
    const sellerJson = await sellerRes.json();
    expect(sellerJson.id).toBe(buyerJson.id);
  });

  it("GET /api/auth/session returns real DB profile fields and never leaks sessionVersion or credentials", async () => {
    currentTestSession = {
      id: sellerId,
      email: "seller@test.id",
      name: "QA Seller",
      role: "SELLER",
      isVerified: true,
      avatar: null,
      accountStatus: "ACTIVE",
      sessionVersion: 3,
    };
    const res = await getSessionRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.name).toBe("QA Seller");
    expect(body.user.city).toBe("Bandung");
    expect(body.user.sessionVersion).toBeUndefined();
    assertNoSecrets(body);

    currentTestSession = null;
    const guestRes = await getSessionRoute();
    const guestBody = await guestRes.json();
    expect(guestBody).toEqual({ authenticated: false, user: null });
  });
});
