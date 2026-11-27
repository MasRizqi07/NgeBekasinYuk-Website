import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { prisma } from "@/server/db/prisma";
import { signSession } from "@/lib/auth/session";
import {
  GET as listConversationsRoute,
  POST as createConversationRoute,
} from "@/app/api/conversations/route";
import { GET as getConversationRoute } from "@/app/api/conversations/[id]/route";
import {
  GET as pollMessagesRoute,
  POST as sendMessageRoute,
} from "@/app/api/conversations/[id]/messages/route";
import { POST as createOfferRoute } from "@/app/api/conversations/[id]/offers/route";
import { POST as acceptOfferRoute } from "@/app/api/conversations/[id]/offers/[offerId]/accept/route";
import { POST as rejectOfferRoute } from "@/app/api/conversations/[id]/offers/[offerId]/reject/route";
import { POST as counterOfferRoute } from "@/app/api/conversations/[id]/offers/[offerId]/counter/route";
import { GET as getOfferForCheckoutRoute } from "@/app/api/offers/[offerId]/route";
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

const FORBIDDEN_KEY_PATTERN =
  /hash|password|pin|totp|secret|ciphertext|sessionVersion|lastTotp|email|phone|minNegoPrice/i;

function assertNoLeakedSecrets(obj: unknown, trace = ""): void {
  if (obj === null || obj === undefined || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoLeakedSecrets(item, `${trace}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    const nextTrace = trace ? `${trace}.${k}` : k;
    if (FORBIDDEN_KEY_PATTERN.test(k)) {
      throw new Error(`Forbidden key leaked at "${nextTrace}"`);
    }
    assertNoLeakedSecrets(v, nextTrace);
  }
}

describe("Phase 11 Chat & Price Offers Integration (AC11.1 - AC11.7, AC11.9)", () => {
  const createdUserIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdConvoIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdIdempKeys: string[] = [];

  let sellerA: { id: string; email: string; name: string; role: "SELLER" };
  let buyerB: { id: string; email: string; name: string; role: "BUYER" };
  let outsiderC: { id: string; email: string; name: string; role: "BUYER" };
  let sellerCookie: string;
  let buyerCookie: string;
  let outsiderCookie: string;
  let activeListingId: string;
  let secondListingId: string;

  beforeEach(async () => {
    currentSessionCookie = undefined;
    const suffix = crypto.randomBytes(4).toString("hex");

    const uSeller = await prisma.user.create({
      data: {
        email: `chat-seller-${suffix}@test.id`,
        phone: `081111${suffix.slice(0, 5)}`,
        name: `Seller Chat ${suffix}`,
        role: "SELLER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD",
        hashedPin: "SENTINEL_HASHED_PIN",
        totpSecretCiphertext: "SENTINEL_TOTP",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
        sellerProfile: {
          create: {
            storeName: `Chat Store ${suffix}`,
            storeSlug: `chat-store-${suffix}`,
            city: "Jakarta Selatan",
          },
        },
      },
    });
    createdUserIds.push(uSeller.id);

    const uBuyer = await prisma.user.create({
      data: {
        email: `chat-buyer-${suffix}@test.id`,
        phone: `081222${suffix.slice(0, 5)}`,
        name: `Buyer Chat ${suffix}`,
        role: "BUYER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD",
        hashedPin: "SENTINEL_HASHED_PIN",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      },
    });
    createdUserIds.push(uBuyer.id);

    const uOutsider = await prisma.user.create({
      data: {
        email: `chat-outsider-${suffix}@test.id`,
        phone: `081333${suffix.slice(0, 5)}`,
        name: `Outsider Chat ${suffix}`,
        role: "BUYER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD",
        hashedPin: "SENTINEL_HASHED_PIN",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      },
    });
    createdUserIds.push(uOutsider.id);

    sellerA = { id: uSeller.id, email: uSeller.email, name: uSeller.name, role: "SELLER" };
    buyerB = { id: uBuyer.id, email: uBuyer.email, name: uBuyer.name, role: "BUYER" };
    outsiderC = { id: uOutsider.id, email: uOutsider.email, name: uOutsider.name, role: "BUYER" };

    sellerCookie = await signSession({ ...sellerA, isVerified: true, sessionVersion: 1 });
    buyerCookie = await signSession({ ...buyerB, isVerified: true, sessionVersion: 1 });
    outsiderCookie = await signSession({ ...outsiderC, isVerified: true, sessionVersion: 1 });

    const listing1 = await prisma.productListing.create({
      data: {
        id: `list-chat-1-${suffix}`,
        slug: `slug-chat-1-${suffix}`,
        title: `iPad Mini 6 Nego ${suffix}`,
        description: "Mulus like new garansi iBox.",
        price: 6000000,
        minNegoPrice: 4500000,
        canNego: true,
        category: "smartphone",
        categoryLabel: "Smartphone",
        brand: "Apple",
        model: "iPad Mini 6",
        condition: "LIKE_NEW",
        status: "ACTIVE",
        sellerId: sellerA.id,
      },
    });
    createdListingIds.push(listing1.id);
    activeListingId = listing1.id;

    const listing2 = await prisma.productListing.create({
      data: {
        id: `list-chat-2-${suffix}`,
        slug: `slug-chat-2-${suffix}`,
        title: `MacBook M2 Pro ${suffix}`,
        description: "Mulus fullset.",
        price: 15000000,
        canNego: true,
        category: "laptop",
        categoryLabel: "Laptop",
        brand: "Apple",
        model: "MacBook Pro",
        condition: "LIKE_NEW",
        status: "ACTIVE",
        sellerId: sellerA.id,
      },
    });
    createdListingIds.push(listing2.id);
    secondListingId = listing2.id;
  });

  afterEach(async () => {
    const orderIds = createdOrderIds.filter(Boolean);
    createdOrderIds.length = 0;
    if (orderIds.length > 0) {
      await prisma.escrowAccount.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.paymentAttempt.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    const convoIds = createdConvoIds.filter(Boolean);
    createdConvoIds.length = 0;
    if (convoIds.length > 0) {
      await prisma.chatMessage.deleteMany({ where: { conversationId: { in: convoIds } } });
      await prisma.priceOffer.deleteMany({ where: { conversationId: { in: convoIds } } });
      await prisma.conversation.deleteMany({ where: { id: { in: convoIds } } });
    }

    const listingIds = createdListingIds.filter(Boolean);
    createdListingIds.length = 0;
    if (listingIds.length > 0) {
      await prisma.productListing.deleteMany({ where: { id: { in: listingIds } } });
    }

    const keys = createdIdempKeys.filter(Boolean);
    createdIdempKeys.length = 0;
    if (keys.length > 0) {
      await prisma.idempotencyKey.deleteMany({ where: { key: { in: keys } } });
    }

    const userIds = createdUserIds.filter(Boolean);
    createdUserIds.length = 0;
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.sellerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("AC11.1 & AC11.2: enforces participant-only isolation (401/403), blocks seller self-chat, and deduplicates conversations", async () => {
    // Unauthenticated rejected
    const anonCreate = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    expect(anonCreate.status).toBe(401);

    // AC11.2: Seller cannot chat on own listing
    currentSessionCookie = sellerCookie;
    const selfChatRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    expect(selfChatRes.status).toBe(403);
    expect(
      await prisma.conversation.count({ where: { listingId: activeListingId } })
    ).toBe(0);

    // Buyer creates conversation -> idempotent second call returns 200 with same ID
    currentSessionCookie = buyerCookie;
    const createRes1 = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    expect(createRes1.status).toBe(201);
    const convo = await createRes1.json();
    createdConvoIds.push(convo.id);
    assertNoLeakedSecrets(convo);

    const createRes2 = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    expect(createRes2.status).toBe(200);
    const convo2 = await createRes2.json();
    expect(convo2.id).toBe(convo.id);

    // Buyer creates offer so outsider offer-response attempt can also be checked
    const offRes = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5200000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(offRes.status).toBe(201);
    const offJson = await offRes.json();

    // AC11.1: Non-participant (outsiderC) gets 403 on all endpoints and inbox excludes convo
    currentSessionCookie = outsiderCookie;
    const outsiderInbox = await listConversationsRoute(
      new Request("http://localhost:3000/api/conversations")
    );
    expect(outsiderInbox.status).toBe(200);
    const outsiderList = await outsiderInbox.json();
    expect(outsiderList.data).toHaveLength(0);

    const outRead = await getConversationRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}`),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(outRead.status).toBe(403);

    const outPoll = await pollMessagesRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(outPoll.status).toBe(403);

    const outPostMsg = await sendMessageRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Intruder message" }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(outPostMsg.status).toBe(403);

    const outOffer = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5000000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(outOffer.status).toBe(403);

    const outAccept = await acceptOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/offers/${offJson.offer.id}/accept`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: convo.id, offerId: offJson.offer.id }) }
    );
    expect(outAccept.status).toBe(403);
  });

  it("AC11.3 (storage) & AC11.4: stores plain XSS payload intact, rejects strict schema bloat, and rate limits 31st message (429)", async () => {
    currentSessionCookie = buyerCookie;
    const convRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    const convo = await convRes.json();
    createdConvoIds.push(convo.id);

    // Extra .strict() field -> 400
    const strictFail = await sendMessageRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Halo", senderId: sellerA.id }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(strictFail.status).toBe(400);

    // > 1000 chars -> 400
    const longFail = await sendMessageRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "a".repeat(1001) }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(longFail.status).toBe(400);

    // 1st message has literal <script> payload (AC11.3 DB fidelity)
    const xssPayload = 'Barang ready? <script>window.__xss=1</script>';
    const firstMsg = await sendMessageRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `  ${xssPayload}  ` }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(firstMsg.status).toBe(201);
    const firstJson = await firstMsg.json();
    expect(firstJson.message.text).toBe(xssPayload);

    // Remaining 29 messages succeed -> 30 total
    for (let i = 2; i <= 30; i++) {
      const r = await sendMessageRoute(
        new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `Pesan ke-${i}` }),
        }),
        { params: Promise.resolve({ id: convo.id }) }
      );
      expect(r.status).toBe(201);
    }

    // 31st message in same 60s window hits 429 RATE_LIMITED
    const limited = await sendMessageRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Pesan ke-31 harus ditolak" }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(limited.status).toBe(429);
    const limitedJson = await limited.json();
    expect(limitedJson.error).toBe("RATE_LIMITED");
    expect(
      await prisma.chatMessage.count({ where: { conversationId: convo.id } })
    ).toBe(30);

    // Seller polls after first message cursor and sees messages 2..30 cleanly without leakage
    currentSessionCookie = sellerCookie;
    const pollRes = await pollMessagesRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/messages?after=${encodeURIComponent(
          firstJson.cursor
        )}`
      ),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(pollRes.status).toBe(200);
    const pollJson = await pollRes.json();
    assertNoLeakedSecrets(pollJson);
    expect(pollJson.data).toHaveLength(29);
    expect(pollJson.data[0].text).toBe("Pesan ke-2");
  });

  it("AC11.5: validates offer bounds (>0 and <= listing.price), single PENDING rule, counter, reject & accept CAS", async () => {
    currentSessionCookie = buyerCookie;
    const convRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    const convo = await convRes.json();
    createdConvoIds.push(convo.id);

    // Invalid <= 0 or decimal or > listing.price
    for (const badAmount of [0, -100000, 123.45]) {
      const bad = await createOfferRoute(
        new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: badAmount }),
        }),
        { params: Promise.resolve({ id: convo.id }) }
      );
      expect(bad.status).toBe(400);
    }

    const tooHigh = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 6000001 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(tooHigh.status).toBe(422);
    expect(await prisma.priceOffer.count({ where: { conversationId: convo.id } })).toBe(0);

    // Valid offer #1 -> 201; duplicate PENDING -> 409
    const off1Res = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5000000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(off1Res.status).toBe(201);
    const off1 = await off1Res.json();

    const dupPending = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5100000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(dupPending.status).toBe(409);

    // Buyer cannot accept own offer (403)
    const buyerAcceptAttempt = await acceptOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/offers/${off1.offer.id}/accept`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: convo.id, offerId: off1.offer.id }) }
    );
    expect(buyerAcceptAttempt.status).toBe(403);

    // Seller counters -> PENDING becomes COUNTERED -> frees slot for buyer offer #2
    currentSessionCookie = sellerCookie;
    const counterRes = await counterOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/offers/${off1.offer.id}/counter`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5500000 }),
        }
      ),
      { params: Promise.resolve({ id: convo.id, offerId: off1.offer.id }) }
    );
    expect(counterRes.status).toBe(200);
    const counteredJson = await counterRes.json();
    expect(counteredJson.offer.status).toBe("COUNTERED");
    expect(counteredJson.offer.counterPrice).toBe(5500000);

    // Re-rejecting already-COUNTERED offer -> 409 CAS guard
    const rejectStale = await rejectOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/offers/${off1.offer.id}/reject`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: convo.id, offerId: off1.offer.id }) }
    );
    expect(rejectStale.status).toBe(409);

    // Buyer submits new offer at counter price
    currentSessionCookie = buyerCookie;
    const off2Res = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5500000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(off2Res.status).toBe(201);
    const off2 = await off2Res.json();

    // Seller accepts offer #2
    currentSessionCookie = sellerCookie;
    const acceptRes = await acceptOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/offers/${off2.offer.id}/accept`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: convo.id, offerId: off2.offer.id }) }
    );
    expect(acceptRes.status).toBe(200);
    const acceptedJson = await acceptRes.json();
    expect(acceptedJson.offer.status).toBe("ACCEPTED");
  });

  it("AC11.6, AC11.7 & AC11.9: rejects foreign-buyer/cross-listing/expired/reused offers (422) and charges offerPrice on checkout", async () => {
    currentSessionCookie = buyerCookie;
    const convRes = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    const convo = await convRes.json();
    createdConvoIds.push(convo.id);

    // Offer 1: expires -> AC11.7
    const offExpRes = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 4900000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    const offExp = await offExpRes.json();
    await prisma.priceOffer.update({
      where: { id: offExp.offer.id },
      data: { status: "ACCEPTED", expiresAt: new Date(Date.now() - 60_000) },
    });

    const expOrderKey = `idemp-exp-offer-${crypto.randomBytes(4).toString("hex")}`;
    createdIdempKeys.push(expOrderKey);
    const expOrderRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": expOrderKey },
        body: JSON.stringify({
          listingId: activeListingId,
          shippingAddress: "Jl. Asia Afrika No. 88, Bandung",
          courier: "J&T Express",
          paymentMethod: "BCA_VA",
          offerId: offExp.offer.id,
        }),
      })
    );
    expect(expOrderRes.status).toBe(422);
    const expiredDb = await prisma.priceOffer.findUniqueOrThrow({
      where: { id: offExp.offer.id },
    });
    expect(expiredDb.status).toBe("EXPIRED");

    // Offer 2: accepted for buyerB -> outsiderC cannot use it (AC11.6) and wrong listingId rejected
    const off2Res = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${convo.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 4700000 }),
      }),
      { params: Promise.resolve({ id: convo.id }) }
    );
    expect(off2Res.status).toBe(201);
    const off2 = await off2Res.json();

    currentSessionCookie = sellerCookie;
    await acceptOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${convo.id}/offers/${off2.offer.id}/accept`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: convo.id, offerId: off2.offer.id }) }
    );

    // AC11.6: Buyer outsiderC sends buyerB's offerId -> 422 and zero orders
    currentSessionCookie = outsiderCookie;
    const stealKey = `idemp-steal-offer-${crypto.randomBytes(4).toString("hex")}`;
    createdIdempKeys.push(stealKey);
    const stealRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": stealKey },
        body: JSON.stringify({
          listingId: activeListingId,
          shippingAddress: "Jl. Asia Afrika No. 89, Bandung",
          courier: "J&T Express",
          paymentMethod: "QRIS",
          offerId: off2.offer.id,
        }),
      })
    );
    expect(stealRes.status).toBe(422);

    // Cross-listing mismatch -> 422
    currentSessionCookie = buyerCookie;
    const crossKey = `idemp-cross-offer-${crypto.randomBytes(4).toString("hex")}`;
    createdIdempKeys.push(crossKey);
    const crossRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crossKey },
        body: JSON.stringify({
          listingId: secondListingId,
          shippingAddress: "Jl. Asia Afrika No. 89, Bandung",
          courier: "J&T Express",
          paymentMethod: "QRIS",
          offerId: off2.offer.id,
        }),
      })
    );
    expect(crossRes.status).toBe(422);

    // AC11.9: Legitimate buyerB checkout with accepted offer -> itemPrice === 4_700_000 & CONSUMED
    const legitKey = `idemp-legit-offer-${crypto.randomBytes(4).toString("hex")}`;
    createdIdempKeys.push(legitKey);
    const orderRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": legitKey },
        body: JSON.stringify({
          listingId: activeListingId,
          shippingAddress: "Jl. Asia Afrika No. 89, Bandung",
          courier: "JNE YES",
          paymentMethod: "BCA_VA",
          offerId: off2.offer.id,
        }),
      })
    );
    expect(orderRes.status).toBe(201);
    const orderDto = await orderRes.json();
    createdOrderIds.push(orderDto.id);

    expect(orderDto.itemPrice).toBe(4700000);
    expect(orderDto.offerId).toBe(off2.offer.id);
    expect(orderDto.escrowFee).toBe(0);
    expect(orderDto.totalAmount).toBe(4700000 + orderDto.shippingFee);

    const consumedOffer = await prisma.priceOffer.findUniqueOrThrow({
      where: { id: off2.offer.id },
    });
    expect(consumedOffer.status).toBe("CONSUMED");
    expect(consumedOffer.consumedAt).not.toBeNull();

    // Even if order is later cancelled releasing listing back to ACTIVE, consumed offer cannot be reused
    await prisma.order.update({
      where: { id: orderDto.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await prisma.productListing.update({
      where: { id: activeListingId },
      data: { status: "ACTIVE" },
    });

    const reuseKey = `idemp-reuse-offer-${crypto.randomBytes(4).toString("hex")}`;
    createdIdempKeys.push(reuseKey);
    const reuseRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": reuseKey },
        body: JSON.stringify({
          listingId: activeListingId,
          shippingAddress: "Jl. Asia Afrika No. 89, Bandung",
          courier: "JNE YES",
          paymentMethod: "BCA_VA",
          offerId: off2.offer.id,
        }),
      })
    );
    expect(reuseRes.status).toBe(422);
  });

  it("PR25-2, PR25-5 & PR25-6: targeted /api/offers lookup handles >5 offers, inbox cursor + q search paginate across all threads, and chat poll recovers expired reservation", async () => {
    currentSessionCookie = buyerCookie;
    const conv1Res = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: activeListingId }),
      })
    );
    const conv1 = await conv1Res.json();
    createdConvoIds.push(conv1.id);

    const conv2Res = await createConversationRoute(
      new Request("http://localhost:3000/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: secondListingId }),
      })
    );
    const conv2 = await conv2Res.json();
    createdConvoIds.push(conv2.id);

    // PR25-5: Inbox pagination cursor + server ?q= search across >1 pages
    const page1Res = await listConversationsRoute(
      new Request("http://localhost:3000/api/conversations?limit=1")
    );
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json();
    expect(page1.data).toHaveLength(1);
    expect(page1.pagination.hasMore).toBe(true);
    expect(page1.pagination.nextCursor).toBeTruthy();

    const page2Res = await listConversationsRoute(
      new Request(
        `http://localhost:3000/api/conversations?limit=1&cursor=${encodeURIComponent(
          page1.pagination.nextCursor
        )}`
      )
    );
    const page2 = await page2Res.json();
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);

    const searchRes = await listConversationsRoute(
      new Request("http://localhost:3000/api/conversations?limit=1&q=iPad")
    );
    const searchJson = await searchRes.json();
    expect(searchJson.data).toHaveLength(1);
    expect(searchJson.data[0].id).toBe(conv1.id);

    // PR25-2: Offer #1 is ACCEPTED, then 6 newer offers are created & rejected so Offer #1 drops out of 5-offer inbox preview
    const offAcceptedRes = await createOfferRoute(
      new Request(`http://localhost:3000/api/conversations/${conv1.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 5100000 }),
      }),
      { params: Promise.resolve({ id: conv1.id }) }
    );
    expect(offAcceptedRes.status).toBe(201);
    const offAccepted = await offAcceptedRes.json();

    currentSessionCookie = sellerCookie;
    const accRes = await acceptOfferRoute(
      new Request(
        `http://localhost:3000/api/conversations/${conv1.id}/offers/${offAccepted.offer.id}/accept`,
        { method: "POST" }
      ),
      { params: Promise.resolve({ id: conv1.id, offerId: offAccepted.offer.id }) }
    );
    expect(accRes.status).toBe(200);

    for (let i = 0; i < 6; i++) {
      currentSessionCookie = buyerCookie;
      const tmpOffRes = await createOfferRoute(
        new Request(`http://localhost:3000/api/conversations/${conv1.id}/offers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: 5200000 + i * 10000 }),
        }),
        { params: Promise.resolve({ id: conv1.id }) }
      );
      expect(tmpOffRes.status).toBe(201);
      const tmpOff = await tmpOffRes.json();

      currentSessionCookie = sellerCookie;
      await rejectOfferRoute(
        new Request(
          `http://localhost:3000/api/conversations/${conv1.id}/offers/${tmpOff.offer.id}/reject`,
          { method: "POST" }
        ),
        { params: Promise.resolve({ id: conv1.id, offerId: tmpOff.offer.id }) }
      );
    }

    // Outsider cannot read Offer #1 (404), buyer CAN verify Offer #1 via GET /api/offers/[offerId]
    currentSessionCookie = outsiderCookie;
    const outLookup = await getOfferForCheckoutRoute(
      new Request(`http://localhost:3000/api/offers/${offAccepted.offer.id}`),
      { params: Promise.resolve({ offerId: offAccepted.offer.id }) }
    );
    expect(outLookup.status).toBe(404);

    currentSessionCookie = buyerCookie;
    const buyerLookup = await getOfferForCheckoutRoute(
      new Request(`http://localhost:3000/api/offers/${offAccepted.offer.id}`),
      { params: Promise.resolve({ offerId: offAccepted.offer.id }) }
    );
    expect(buyerLookup.status).toBe(200);
    const lookupJson = await buyerLookup.json();
    expect(lookupJson.offer.id).toBe(offAccepted.offer.id);
    expect(lookupJson.isEligibleForCheckout).toBe(true);

    // PR25-6: Expired PENDING_PAYMENT order on listing1 recovers to ACTIVE on chat poll
    currentSessionCookie = outsiderCookie;
    const staleKey = `idemp-chat-rec-${crypto.randomBytes(4).toString("hex")}`;
    createdIdempKeys.push(staleKey);
    const staleOrdRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": staleKey },
        body: JSON.stringify({
          listingId: activeListingId,
          shippingAddress: "Jl. Senayan No. 2, Jakarta",
          courier: "J&T Express",
          paymentMethod: "QRIS",
        }),
      })
    );
    expect(staleOrdRes.status).toBe(201);
    const staleOrd = await staleOrdRes.json();
    createdOrderIds.push(staleOrd.id);

    const past = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma.order.update({ where: { id: staleOrd.id }, data: { createdAt: past } });
    await prisma.paymentAttempt.updateMany({
      where: { orderId: staleOrd.id },
      data: { expiresAt: past },
    });

    currentSessionCookie = buyerCookie;
    const pollRecovered = await pollMessagesRoute(
      new Request(`http://localhost:3000/api/conversations/${conv1.id}/messages`),
      { params: Promise.resolve({ id: conv1.id }) }
    );
    expect(pollRecovered.status).toBe(200);
    const pollJson = await pollRecovered.json();
    expect(pollJson.listingStatus).toBe("ACTIVE");
  });
});
