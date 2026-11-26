import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { prisma } from "@/server/db/prisma";
import { signSession } from "@/lib/auth/session";
import { GET as listListingsRoute, POST as createListingRoute } from "@/app/api/listings/route";
import {
  GET as getListingRoute,
  PATCH as patchListingRoute,
} from "@/app/api/listings/[id]/route";
import { POST as archiveListingRoute } from "@/app/api/listings/[id]/archive/route";
import { POST as relistListingRoute } from "@/app/api/listings/[id]/relist/route";
import { POST as uploadImageRoute } from "@/app/api/listings/[id]/images/route";
import { GET as serveImageRoute } from "@/app/api/listings/images/[filename]/route";
import { GET as listOrdersRoute, POST as createOrderRoute } from "@/app/api/orders/route";

let currentSessionCookie: string | undefined;

// Shim only Next's HTTP cookie container so validateAuthoritativeSession runs real HMAC + DB verification.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === "ngebekasinyuk_session" && currentSessionCookie
        ? { name, value: currentSessionCookie }
        : undefined,
  })),
}));

const PUBLIC_LISTING_FORBIDDEN_KEY_PATTERN =
  /hash|password|pin|totp|secret|ciphertext|sessionVersion|lastTotp|email|phone/i;

function assertNoSecretsOrPii(obj: unknown, pathTrace = ""): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) =>
      assertNoSecretsOrPii(item, `${pathTrace}[${idx}]`)
    );
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const nextPath = pathTrace ? `${pathTrace}.${key}` : key;
    if (PUBLIC_LISTING_FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new Error(`Forbidden key exposed at "${nextPath}"`);
    }
    assertNoSecretsOrPii(value, nextPath);
  }
}

const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

describe("Phase 10 Listings API Integration (Real PostgreSQL)", () => {
  const createdUserIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdOrderIds: string[] = [];
  let tempUploadDir: string;

  let ownerA: { id: string; email: string; name: string; role: "SELLER"; isVerified: boolean };
  let userB: { id: string; email: string; name: string; role: "BUYER"; isVerified: boolean };
  let sellerCookieA: string;
  let buyerCookieB: string;

  beforeEach(async () => {
    tempUploadDir = mkdtempSync(path.join(os.tmpdir(), "ngebekasinyuk-api-uploads-"));
    process.env.LISTING_UPLOAD_DIR = tempUploadDir;
    currentSessionCookie = undefined;

    const suffix = crypto.randomBytes(4).toString("hex");
    const uA = await prisma.user.create({
      data: {
        email: `seller-a-${suffix}@test.id`,
        phone: `0812999${suffix.slice(0, 5)}`,
        name: `Seller A ${suffix}`,
        role: "SELLER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD_A",
        hashedPin: "SENTINEL_HASHED_PIN_A",
        totpSecretCiphertext: "SENTINEL_TOTP_A",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      },
    });
    createdUserIds.push(uA.id);

    const uB = await prisma.user.create({
      data: {
        email: `buyer-b-${suffix}@test.id`,
        phone: `0813888${suffix.slice(0, 5)}`,
        name: `Buyer B ${suffix}`,
        role: "BUYER",
        isVerified: true,
        hashedPassword: "SENTINEL_HASHED_PASSWORD_B",
        hashedPin: "SENTINEL_HASHED_PIN_B",
        totpSecretCiphertext: "SENTINEL_TOTP_B",
        accountStatus: "ACTIVE",
        sessionVersion: 1,
      },
    });
    createdUserIds.push(uB.id);

    ownerA = {
      id: uA.id,
      email: uA.email,
      name: uA.name,
      role: "SELLER",
      isVerified: true,
    };
    userB = {
      id: uB.id,
      email: uB.email,
      name: uB.name,
      role: "BUYER",
      isVerified: true,
    };

    sellerCookieA = await signSession({ ...ownerA, sessionVersion: 1 });
    buyerCookieB = await signSession({ ...userB, sessionVersion: 1 });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    delete process.env.LISTING_UPLOAD_DIR;
    rmSync(tempUploadDir, { recursive: true, force: true });

    if (createdOrderIds.length > 0) {
      await prisma.escrowAccount.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.paymentAttempt.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
      createdOrderIds.length = 0;
    }

    if (createdListingIds.length > 0) {
      await prisma.listingImage.deleteMany({
        where: { listingId: { in: createdListingIds } },
      });
      await prisma.productListing.deleteMany({
        where: { id: { in: createdListingIds } },
      });
      createdListingIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.sellerProfile.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      createdUserIds.length = 0;
    }
  });

  it("AC10.1: GET /api/listings returns public list envelope without secrets or PII", async () => {
    const res = await listListingsRoute(
      new Request("http://localhost:3000/api/listings?limit=5")
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.object).toBe("list");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.pagination).toHaveProperty("limit", 5);
    expect(body.pagination).toHaveProperty("hasMore");
    expect(body.pagination).toHaveProperty("nextCursor");

    for (const item of body.data) {
      assertNoSecretsOrPii(item);
      const serialized = JSON.stringify(item);
      expect(serialized).not.toMatch(/SENTINEL_HASHED|ngebekasinyuk\.id.*@/i);
      expect(item.status).toBe("ACTIVE");
      expect(item.minNegoPrice).toBeUndefined();
    }
  });

  it("AC10.2: Keyset cursor pagination does not duplicate or skip items under concurrent insert", async () => {
    currentSessionCookie = sellerCookieA;
    const tag = crypto.randomBytes(3).toString("hex");
    const initialIds: string[] = [];

    for (let i = 0; i < 4; i++) {
      const createRes = await createListingRoute(
        new Request("http://localhost:3000/api/listings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `proof-idemp-cursor-${tag}-${i}`,
          },
          body: JSON.stringify({
            title: `Cursor Item ${tag} #${i}`,
            description: "Unit testing cursor stability with real postgres.",
            price: 1500000 + i * 100000,
            category: "smartphone",
            brand: "CursorBrand",
            model: `Model-${i}`,
            condition: "LIKE_NEW",
            canNego: true,
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      createdListingIds.push(created.id);
      initialIds.push(created.id);
    }

    currentSessionCookie = undefined;
    const page1Res = await listListingsRoute(
      new Request(`http://localhost:3000/api/listings?q=${tag}&limit=2&sort=newest`)
    );
    expect(page1Res.status).toBe(200);
    const page1 = await page1Res.json();
    expect(page1.data).toHaveLength(2);
    expect(page1.pagination.hasMore).toBe(true);
    expect(typeof page1.pagination.nextCursor).toBe("string");

    // Concurrent new listing inserted between page 1 and page 2
    currentSessionCookie = sellerCookieA;
    const concurrentRes = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-cursor-conc-${tag}`,
        },
        body: JSON.stringify({
          title: `Cursor Concurrent Item ${tag}`,
          description: "Inserted concurrently between pagination pages.",
          price: 2900000,
          category: "smartphone",
          brand: "CursorBrand",
          model: "Model-Concurrent",
          condition: "LIKE_NEW",
          canNego: true,
        }),
      })
    );
    expect(concurrentRes.status).toBe(201);
    const concurrentItem = await concurrentRes.json();
    createdListingIds.push(concurrentItem.id);

    currentSessionCookie = undefined;
    const page2Res = await listListingsRoute(
      new Request(
        `http://localhost:3000/api/listings?q=${tag}&limit=2&sort=newest&cursor=${encodeURIComponent(
          page1.pagination.nextCursor
        )}`
      )
    );
    expect(page2Res.status).toBe(200);
    const page2 = await page2Res.json();
    expect(page2.data).toHaveLength(2);

    const combinedIds = [
      ...page1.data.map((d: { id: string }) => d.id),
      ...page2.data.map((d: { id: string }) => d.id),
    ];
    expect(new Set(combinedIds).size).toBe(4);
    expect(combinedIds).not.toContain(concurrentItem.id);
    for (const id of initialIds) {
      expect(combinedIds).toContain(id);
    }
  });

  it("AC10.3: Enforces authentication (401) and IDOR ownership guards (403) across write routes", async () => {
    currentSessionCookie = sellerCookieA;
    const createRes = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-idor-${crypto.randomBytes(4).toString("hex")}`,
        },
        body: JSON.stringify({
          title: "Owner A Protected ThinkPad",
          description: "Owned exclusively by Seller A for IDOR verification.",
          price: 9200000,
          category: "laptop",
          brand: "Lenovo",
          model: "ThinkPad X1",
          condition: "LIKE_NEW",
          canNego: true,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const listing = await createRes.json();
    createdListingIds.push(listing.id);

    // Unauthenticated (and tampered session) -> 401
    currentSessionCookie = `${sellerCookieA}tampered`;
    const unauthPost = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "proof-idemp-unauth",
        },
        body: JSON.stringify({
          title: "Tampered Cookie Attempt",
          description: "Should be rejected by real HMAC check.",
          price: 500000,
          category: "audio",
          brand: "Sony",
          model: "XM5",
          condition: "LIKE_NEW",
        }),
      })
    );
    expect(unauthPost.status).toBe(401);

    // Non-owner User B -> 403 across PATCH, archive, relist, and image upload
    currentSessionCookie = buyerCookieB;

    const patchRes = await patchListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: 100000 }),
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(patchRes.status).toBe(403);

    const archiveRes = await archiveListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/archive`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(archiveRes.status).toBe(403);

    const relistRes = await relistListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/relist`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(relistRes.status).toBe(403);

    const formData = new FormData();
    formData.append(
      "file",
      new File([VALID_PNG_BYTES], "hijack.png", { type: "image/png" })
    );
    const uploadRes = await uploadImageRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/images`, {
        method: "POST",
        body: formData,
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(uploadRes.status).toBe(403);
  });

  it("AC10.4: Strict Zod rejects forged sellerId/status/id, auto-provisions SellerProfile, and replays Idempotency-Key", async () => {
    currentSessionCookie = buyerCookieB; // First-time seller has no SellerProfile yet

    // Reject forged fields
    const forgedRes = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-forged-${crypto.randomBytes(3).toString("hex")}`,
        },
        body: JSON.stringify({
          id: "forged-id",
          sellerId: ownerA.id,
          status: "SOLD",
          title: "Attempted Forgery Gadget",
          description: "Testing strict schema rejection of forbidden keys.",
          price: 1200000,
          category: "smartphone",
          brand: "Apple",
          model: "iPhone 13",
          condition: "LIKE_NEW",
        }),
      })
    );
    expect(forgedRes.status).toBe(400);

    const idempKey = `proof-idemp-create-${crypto.randomBytes(4).toString("hex")}`;
    const validPayload = {
      title: "First-Time Seller Gadget Real DB",
      description: "Auto-creates SellerProfile atomically on first listing.",
      price: 3500000,
      category: "audio",
      brand: "Sony",
      model: "WH-1000XM5",
      condition: "BRAND_NEW",
      canNego: true,
      minNegoPrice: 3200000,
    };

    const res1 = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempKey,
        },
        body: JSON.stringify(validPayload),
      })
    );
    expect(res1.status).toBe(201);
    const created1 = await res1.json();
    createdListingIds.push(created1.id);

    expect(created1.sellerId).toBe(userB.id);
    expect(created1.status).toBe("ACTIVE");
    expect(created1.minNegoPrice).toBe(3200000);

    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: userB.id },
    });
    expect(profile).not.toBeNull();

    // Replay returns the exact same listing once
    const res2 = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempKey,
        },
        body: JSON.stringify(validPayload),
      })
    );
    expect(res2.status).toBe(201);
    const created2 = await res2.json();
    expect(created2.id).toBe(created1.id);
    expect(created2.slug).toBe(created1.slug);
  });

  it("AC10.5 & AC10.6: Active orders return 409 on PATCH/relist; archive hides from catalog & relist restores", async () => {
    currentSessionCookie = sellerCookieA;
    const createRes = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-lifecycle-${crypto.randomBytes(4).toString("hex")}`,
        },
        body: JSON.stringify({
          title: "Lifecycle Check Pixel 8",
          description: "Testing archive visibility, active order guard, and relist.",
          price: 6800000,
          category: "smartphone",
          brand: "Google",
          model: "Pixel 8",
          condition: "LIKE_NEW",
          canNego: false,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const listing = await createRes.json();
    createdListingIds.push(listing.id);

    // Owner archives listing
    const archiveRes = await archiveListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/archive`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(archiveRes.status).toBe(200);
    const archived = await archiveRes.json();
    expect(archived.status).toBe("ARCHIVED");

    // Non-owner / public cannot see ARCHIVED listing in search or detail
    currentSessionCookie = buyerCookieB;
    const searchArchivedRes = await listListingsRoute(
      new Request(`http://localhost:3000/api/listings?q=Lifecycle Check Pixel 8`)
    );
    const searchArchived = await searchArchivedRes.json();
    expect(
      searchArchived.data.some((d: { id: string }) => d.id === listing.id)
    ).toBe(false);

    const detailNonOwnerRes = await getListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}`),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(detailNonOwnerRes.status).toBe(404);

    // Owner CAN inspect ARCHIVED listing
    currentSessionCookie = sellerCookieA;
    const detailOwnerRes = await getListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}`),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(detailOwnerRes.status).toBe(200);
    const detailOwner = await detailOwnerRes.json();
    expect(detailOwner.status).toBe("ARCHIVED");

    // Relist transitions ARCHIVED -> ACTIVE
    const relistRes = await relistListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/relist`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(relistRes.status).toBe(200);
    expect((await relistRes.json()).status).toBe("ACTIVE");

    // Buyer places order via POST /api/orders -> listing becomes RESERVED with active order
    currentSessionCookie = buyerCookieB;
    const orderRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-order-${crypto.randomBytes(4).toString("hex")}`,
        },
        body: JSON.stringify({
          listingId: listing.id,
          shippingAddress: "Jl. Sudirman No. 1, Jakarta Pusat 10220",
          courier: "J&T Express VIP Fast",
          paymentMethod: "BCA_VA",
        }),
      })
    );
    expect(orderRes.status).toBe(201);
    const order = await orderRes.json();
    createdOrderIds.push(order.id);

    // Confirm order visible via GET /api/orders
    const myOrdersRes = await listOrdersRoute(
      new Request("http://localhost:3000/api/orders")
    );
    expect(myOrdersRes.status).toBe(200);

    // Owner attempting PATCH or relist while active order exists receives 409
    currentSessionCookie = sellerCookieA;
    const patchConflict = await patchListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: 9999999 }),
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(patchConflict.status).toBe(409);

    const relistConflict = await relistListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/relist`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(relistConflict.status).toBe(409);
  });

  it("AC10.7: Listing detail & order creation flow cleanly for seeded/newly created active listing", async () => {
    currentSessionCookie = sellerCookieA;
    const createRes = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-buy-${crypto.randomBytes(4).toString("hex")}`,
        },
        body: JSON.stringify({
          title: "Buyable Sony Walkman NW-A306",
          description: "Pristine condition Walkman ready for escrow checkout.",
          price: 4200000,
          category: "audio",
          brand: "Sony",
          model: "NW-A306",
          condition: "LIKE_NEW",
          canNego: true,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const listing = await createRes.json();
    createdListingIds.push(listing.id);

    currentSessionCookie = undefined;
    const bySlug = await getListingRoute(
      new Request(`http://localhost:3000/api/listings/${listing.slug}`),
      { params: Promise.resolve({ id: listing.slug }) }
    );
    expect(bySlug.status).toBe(200);
    expect((await bySlug.json()).id).toBe(listing.id);

    currentSessionCookie = buyerCookieB;
    const orderRes = await createOrderRoute(
      new Request("http://localhost:3000/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-buy-ord-${crypto.randomBytes(4).toString("hex")}`,
        },
        body: JSON.stringify({
          listingId: listing.id,
          shippingAddress: "Jl. Gatot Subroto Kav. 52, Jakarta Selatan",
          courier: "JNE YES",
          paymentMethod: "QRIS",
        }),
      })
    );
    expect(orderRes.status).toBe(201);
    const order = await orderRes.json();
    createdOrderIds.push(order.id);
    expect(order.itemPrice).toBe(4200000);
  });

  it("AC10.8: Rejects fake PNG magic bytes (400), accepts real PNG, and serves safely with nosniff", async () => {
    currentSessionCookie = sellerCookieA;
    const createRes = await createListingRoute(
      new Request("http://localhost:3000/api/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `proof-idemp-img-${crypto.randomBytes(4).toString("hex")}`,
        },
        body: JSON.stringify({
          title: "Image Upload Test Camera",
          description: "Testing real magic byte validation and safe local serving.",
          price: 11500000,
          category: "camera",
          brand: "Fujifilm",
          model: "X-S10",
          condition: "LIKE_NEW",
        }),
      })
    );
    const listing = await createRes.json();
    createdListingIds.push(listing.id);

    // Spoofed PNG payload (plain text labeled image/png) -> 400
    const badForm = new FormData();
    badForm.append(
      "file",
      new File([Buffer.from("<html>not a png</html>")], "evil.png", {
        type: "image/png",
      })
    );
    const badRes = await uploadImageRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/images`, {
        method: "POST",
        body: badForm,
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(badRes.status).toBe(400);

    // Real PNG payload -> 201 and serves with nosniff header
    const goodForm = new FormData();
    goodForm.append(
      "file",
      new File([VALID_PNG_BYTES], "camera.png", { type: "image/png" })
    );
    const goodRes = await uploadImageRoute(
      new Request(`http://localhost:3000/api/listings/${listing.id}/images`, {
        method: "POST",
        body: goodForm,
      }),
      { params: Promise.resolve({ id: listing.id }) }
    );
    expect(goodRes.status).toBe(201);
    const uploaded = await goodRes.json();
    expect(uploaded.url).toMatch(
      /^\/api\/listings\/images\/[0-9a-f-]{36}\.png$/
    );

    const filename = uploaded.url.split("/").pop()!;
    const serveRes = await serveImageRoute(
      new Request(`http://localhost:3000${uploaded.url}`),
      { params: Promise.resolve({ filename }) }
    );
    expect(serveRes.status).toBe(200);
    expect(serveRes.headers.get("Content-Type")).toBe("image/png");
    expect(serveRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("AC10.9: Escapes LIKE wildcards in q and executes <= 3 SQL queries on GET /api/listings", async () => {
    const queryRawSpy = vi.spyOn(prisma, "$queryRaw");
    const findManySpy = vi.spyOn(prisma.productListing, "findMany");

    // 100% wildcard query must NOT match unrelated listings
    const wildcardRes = await listListingsRoute(
      new Request(
        "http://localhost:3000/api/listings?q=%25_unlikely_wildcard_%5C"
      )
    );
    expect(wildcardRes.status).toBe(200);
    const wildcardJson = await wildcardRes.json();
    expect(wildcardJson.data).toHaveLength(0);

    const totalQueries =
      queryRawSpy.mock.calls.length + findManySpy.mock.calls.length;
    expect(totalQueries).toBeGreaterThanOrEqual(1);
    expect(totalQueries).toBeLessThanOrEqual(3);
  });
});
