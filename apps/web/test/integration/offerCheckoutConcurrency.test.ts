import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";
import { prisma } from "@/server/db/prisma";
import { signSession } from "@/lib/auth/session";
import { POST as createOrderRoute } from "@/app/api/orders/route";

let currentSessionCookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "ngebekasinyuk_session" && currentSessionCookie
        ? { name, value: currentSessionCookie }
        : undefined,
  })),
}));

describe("AC11.8: Concurrent Accepted Offer Checkout Consumption (20x Promise.all)", () => {
  const createdUserIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdConvoIds: string[] = [];
  const createdOfferIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];

  afterEach(async () => {
    const orderIds = createdOrderIds.filter(Boolean);
    createdOrderIds.length = 0;
    if (orderIds.length > 0) {
      await prisma.escrowAccount.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.paymentAttempt.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: orderIds } },
      });
    }

    const offerIds = createdOfferIds.filter(Boolean);
    createdOfferIds.length = 0;
    if (offerIds.length > 0) {
      await prisma.priceOffer.deleteMany({
        where: { id: { in: offerIds } },
      });
    }

    const convoIds = createdConvoIds.filter(Boolean);
    createdConvoIds.length = 0;
    if (convoIds.length > 0) {
      await prisma.chatMessage.deleteMany({
        where: { conversationId: { in: convoIds } },
      });
      await prisma.conversation.deleteMany({
        where: { id: { in: convoIds } },
      });
    }

    const listingIds = createdListingIds.filter(Boolean);
    createdListingIds.length = 0;
    if (listingIds.length > 0) {
      await prisma.productListing.deleteMany({
        where: { id: { in: listingIds } },
      });
    }

    const idempKeys = createdIdempotencyKeys.filter(Boolean);
    createdIdempotencyKeys.length = 0;
    if (idempKeys.length > 0) {
      await prisma.idempotencyKey.deleteMany({
        where: { key: { in: idempKeys } },
      });
    }

    const userIds = createdUserIds.filter(Boolean);
    createdUserIds.length = 0;
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.sellerProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  it("allows exactly 1 order at offered price and rejects the concurrent duplicate across 20 iterations", async () => {
    for (let iter = 0; iter < 20; iter++) {
      const suffix = `${iter}-${crypto.randomBytes(4).toString("hex")}`;
      const seller = await prisma.user.create({
        data: {
          email: `offer-race-seller-${suffix}@test.id`,
          name: `Offer Seller ${suffix}`,
          role: "SELLER",
          isVerified: true,
          hashedPassword: "SENTINEL_HASHED_PASSWORD",
          hashedPin: "SENTINEL_HASHED_PIN",
          accountStatus: "ACTIVE",
          sessionVersion: 1,
          sellerProfile: {
            create: {
              storeName: `Offer Store ${suffix}`,
              storeSlug: `offer-store-${suffix}`,
              city: "Jakarta Selatan",
            },
          },
        },
      });
      createdUserIds.push(seller.id);

      const buyer = await prisma.user.create({
        data: {
          email: `offer-race-buyer-${suffix}@test.id`,
          name: `Offer Buyer ${suffix}`,
          role: "BUYER",
          isVerified: true,
          hashedPassword: "SENTINEL_HASHED_PASSWORD",
          hashedPin: "SENTINEL_HASHED_PIN",
          accountStatus: "ACTIVE",
          sessionVersion: 1,
        },
      });
      createdUserIds.push(buyer.id);

      const listing = await prisma.productListing.create({
        data: {
          id: `list-race-${suffix}`,
          slug: `slug-race-${suffix}`,
          title: `Nego Concurrency Gadget ${iter}`,
          description: "Testing atomic offer consumption on checkout.",
          price: 6000000,
          category: "smartphone",
          categoryLabel: "Smartphone",
          brand: "Apple",
          model: "iPhone 14",
          condition: "LIKE_NEW",
          canNego: true,
          status: "ACTIVE",
          sellerId: seller.id,
        },
      });
      createdListingIds.push(listing.id);

      const convo = await prisma.conversation.create({
        data: {
          id: `conv-race-${suffix}`,
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          lastMessage: "Penawaran disetujui",
          lastTimestamp: new Date(),
        },
      });
      createdConvoIds.push(convo.id);

      const offerPrice = 4800000;
      const offer = await prisma.priceOffer.create({
        data: {
          id: `off-race-${suffix}`,
          conversationId: convo.id,
          senderId: buyer.id,
          offerPrice,
          status: "ACCEPTED",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      createdOfferIds.push(offer.id);

      currentSessionCookie = await signSession({
        id: buyer.id,
        email: buyer.email,
        name: buyer.name,
        role: "BUYER",
        isVerified: true,
        sessionVersion: 1,
      });

      const key1 = `idemp-offer-race-1-${suffix}`;
      const key2 = `idemp-offer-race-2-${suffix}`;
      createdIdempotencyKeys.push(key1, key2);

      const makeReq = (key: string) =>
        createOrderRoute(
          new Request("http://localhost:3000/api/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key,
            },
            body: JSON.stringify({
              listingId: listing.id,
              shippingAddress: "Jl. Jendral Sudirman No. 1, Jakarta",
              courier: "J&T Express",
              paymentMethod: "BCA_VA",
              offerId: offer.id,
            }),
          })
        );

      const [res1, res2] = await Promise.all([makeReq(key1), makeReq(key2)]);
      const body1 = await res1.json();
      const body2 = await res2.json();

      if (res1.status === 201 && body1.id) createdOrderIds.push(body1.id);
      if (res2.status === 201 && body2.id) createdOrderIds.push(body2.id);

      const statuses = [res1.status, res2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 422]);

      const winnerBody = res1.status === 201 ? body1 : body2;
      expect(winnerBody.itemPrice).toBe(offerPrice);

      const updatedOffer = await prisma.priceOffer.findUniqueOrThrow({
        where: { id: offer.id },
      });
      expect(updatedOffer.status).toBe("CONSUMED");

      const orderCount = await prisma.order.count({
        where: { listingId: listing.id },
      });
      expect(orderCount).toBe(1);
    }
  }, 60000);
});
