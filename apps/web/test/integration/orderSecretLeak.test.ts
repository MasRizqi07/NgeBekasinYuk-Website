// Order Secret Leak Invariant Test (Vitest against real PostgreSQL)
// Verifies that neither POST /api/orders, replay, GET /api/orders/[id], nor GET /api/orders
// ever leaks password hashes, PIN hashes, TOTP secrets, or session internals.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST, GET as getOrdersList } from "@/app/api/orders/route";
import { GET as getOrderById } from "@/app/api/orders/[id]/route";

let currentTestUser: {
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
  validateAuthoritativeSession: vi.fn(async () => currentTestUser),
}));

export function assertNoSecrets(obj: unknown, path = ""): void {
  // Matches hash, password, PIN, totp, secret, ciphertext, sessionVersion, lastTotp
  const secretPattern = /hash|password|totp|secret|ciphertext|sessionVersion|lastTotp|\bpin\b|(?:^|_)pin/i;

  if (obj === null || obj === undefined) return;

  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        assertNoSecrets(item, `${path}[${index}]`);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (secretPattern.test(key)) {
          throw new Error(`Secret field exposed at path "${fullPath}": key matches forbidden pattern`);
        }
        assertNoSecrets(value, fullPath);
      }
    }
  }
}

const SENTINEL_BUYER_PWD = "SENTINEL_BUYER_PWD_HASH_99182";
const SENTINEL_BUYER_PIN = "SENTINEL_BUYER_PIN_HASH_88271";
const SENTINEL_BUYER_TOTP = "SENTINEL_BUYER_TOTP_CIPHERTEXT_77362";

const SENTINEL_SELLER_PWD = "SENTINEL_SELLER_PWD_HASH_66453";
const SENTINEL_SELLER_PIN = "SENTINEL_SELLER_PIN_HASH_55464";
const SENTINEL_SELLER_TOTP = "SENTINEL_SELLER_TOTP_CIPHERTEXT_44375";

const ALL_SENTINELS = [
  SENTINEL_BUYER_PWD,
  SENTINEL_BUYER_PIN,
  SENTINEL_BUYER_TOTP,
  SENTINEL_SELLER_PWD,
  SENTINEL_SELLER_PIN,
  SENTINEL_SELLER_TOTP,
];

function assertNoSentinelStrings(serializedJson: string) {
  for (const sentinel of ALL_SENTINELS) {
    if (serializedJson.includes(sentinel)) {
      throw new Error(`Response body leaked sentinel string: "${sentinel}"`);
    }
  }
}

describe("P0 Data Exposure Guard: Order API Endpoints Must Never Leak Credentials", () => {
  let buyer: { id: string; email: string; name: string; role: string; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let seller: { id: string; email: string; name: string; role: string; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let admin: { id: string; email: string; name: string; role: string; isVerified: boolean; avatar: string | null; accountStatus: string; sessionVersion: number };
  let listingId: string;

  beforeEach(async () => {
    const suffix = Math.random().toString(36).substring(2, 8);

    const buyerUser = await prisma.user.create({
      data: {
        email: `buyer-leak-${suffix}@test.id`,
        name: "Buyer Leak Sentinel",
        role: "BUYER",
        hashedPassword: SENTINEL_BUYER_PWD,
        hashedPin: SENTINEL_BUYER_PIN,
        totpSecretCiphertext: SENTINEL_BUYER_TOTP,
        totpSecretIv: "iv123",
        totpSecretTag: "tag123",
        totpSecretKeyVersion: 1,
        pinFailedAttempts: 2,
        sessionVersion: 7,
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

    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-leak-${suffix}@test.id`,
        name: "Seller Leak Sentinel",
        role: "SELLER",
        hashedPassword: SENTINEL_SELLER_PWD,
        hashedPin: SENTINEL_SELLER_PIN,
        totpSecretCiphertext: SENTINEL_SELLER_TOTP,
        totpSecretIv: "iv456",
        totpSecretTag: "tag456",
        totpSecretKeyVersion: 1,
        pinFailedAttempts: 1,
        sessionVersion: 5,
        sellerProfile: {
          create: {
            storeName: `Store ${suffix}`,
            storeSlug: `store-${suffix}`,
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

    const adminUser = await prisma.user.create({
      data: {
        email: `admin-leak-${suffix}@test.id`,
        name: "Admin Leak Sentinel",
        role: "ADMIN",
        hashedPassword: "admin-password-hash",
        sessionVersion: 1,
      },
    });

    admin = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      isVerified: adminUser.isVerified,
      avatar: adminUser.avatar,
      accountStatus: adminUser.accountStatus,
      sessionVersion: adminUser.sessionVersion,
    };

    const listing = await prisma.productListing.create({
      data: {
        sellerId: seller.id,
        title: `Item Sentinel ${suffix}`,
        slug: `item-sentinel-${suffix}`,
        description: `Description for sentinel item ${suffix}`,
        brand: "Apple",
        model: "iPhone 13",
        price: 5000000,
        status: "ACTIVE",
        category: "smartphone",
        categoryLabel: "Smartphone",
        condition: "LIKE_NEW",
        canNego: false,
        images: {
          create: [
            { url: "https://example.com/img1.jpg", isPrimary: true, sortOrder: 1 },
          ],
        },
      },
    });
    listingId = listing.id;
  });

  it("POST /api/orders, replay, GET /api/orders/[id], and GET /api/orders never leak secrets or sentinels to buyer, seller, or admin", async () => {
    currentTestUser = buyer;
    const idempotencyKey = `leak-test-${Date.now()}`;

    // 1. BUYER creates order
    const createReq = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Tes Kebocoran Data No. 1",
        courier: "J&T Express",
        paymentMethod: "BCA_VA",
      }),
    });

    const createRes = await POST(createReq);
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    const createRawText = JSON.stringify(createJson);

    // Assertions on POST /api/orders
    assertNoSentinelStrings(createRawText);
    assertNoSecrets(createJson);

    const orderId = createJson.id;
    expect(orderId).toBeDefined();

    // 2. Assert stored IdempotencyKey.result contains NO sentinels
    const storedKey = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });
    expect(storedKey).not.toBeNull();
    assertNoSentinelStrings(storedKey!.result);
    assertNoSecrets(JSON.parse(storedKey!.result));

    // 3. Replay POST /api/orders with same Idempotency-Key
    const replayReq = new Request("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        listingId,
        shippingAddress: "Jl. Tes Kebocoran Data No. 1",
        courier: "J&T Express",
        paymentMethod: "BCA_VA",
      }),
    });

    const replayRes = await POST(replayReq);
    expect(replayRes.status).toBe(201);
    const replayJson = await replayRes.json();
    const replayRawText = JSON.stringify(replayJson);

    assertNoSentinelStrings(replayRawText);
    assertNoSecrets(replayJson);

    // 4. Test GET /api/orders/[id] and GET /api/orders as BUYER, SELLER, and ADMIN
    const testRoles = [
      { user: buyer, label: "BUYER" },
      { user: seller, label: "SELLER" },
      { user: admin, label: "ADMIN" },
    ];

    for (const { user, label } of testRoles) {
      currentTestUser = user;

      // GET /api/orders/[id]
      const getDetailReq = new Request(`http://localhost:3000/api/orders/${orderId}`);
      const getDetailRes = await getOrderById(getDetailReq, {
        params: Promise.resolve({ id: orderId }),
      });
      expect(getDetailRes.status, `Detail status for ${label}`).toBe(200);
      const detailJson = await getDetailRes.json();
      const detailRawText = JSON.stringify(detailJson);

      assertNoSentinelStrings(detailRawText);
      assertNoSecrets(detailJson);

      // GET /api/orders
      const getListReq = new Request("http://localhost:3000/api/orders?status=ALL");
      const getListRes = await getOrdersList(getListReq);
      expect(getListRes.status, `List status for ${label}`).toBe(200);
      const listJson = await getListRes.json();
      const listRawText = JSON.stringify(listJson);

      assertNoSentinelStrings(listRawText);
      assertNoSecrets(listJson);
    }
  });
});
