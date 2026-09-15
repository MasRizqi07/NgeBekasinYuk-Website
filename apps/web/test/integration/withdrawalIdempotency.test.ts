// Withdrawal Retry Idempotency & Replay Protection Verification (PostgreSQL)
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST } from "@/app/api/wallet/withdraw/route";
import { WithdrawalRequestSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";

// Mock validateAuthoritativeSession for the route handler integration test
let testUserId = "";
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

describe("Withdrawal Retry Idempotency Integration Tests (PostgreSQL)", () => {
  let sellerId: string;
  const pin = "123456";

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash("Password123!", 10);
    const hashedPin = await bcrypt.hash(pin, 10);
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    const seller = await prisma.user.create({
      data: {
        email: `seller-idemp-${randomSuffix}@test.id`,
        name: "Idempotency Seller",
        role: "SELLER",
        hashedPassword: hashedPw,
        hashedPin,
        wallet: {
          create: {
            activeBalance: 500_000,
            heldBalance: 0,
          },
        },
      },
    });

    sellerId = seller.id;
    testUserId = seller.id;
  });

  it("1. Two withdrawal requests with the SAME clientRequestId -> wallet debited exactly once, second response has isDuplicate: true", async () => {
    const clientRequestId = `req-idemp-same-${Date.now()}-abc12345`;
    const payload = {
      amount: 100_000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "Idempotency Seller",
      pin,
      clientRequestId,
    };

    // First call: initial attempt
    const req1 = new Request("http://localhost:3000/api/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    expect(data1.success).toBe(true);
    expect(data1.isDuplicate).toBe(false);
    expect(data1.amount).toBe(100_000);
    expect(data1.newActiveBalance).toBe(400_000);

    // Second call: manual retry replaying the exact same clientRequestId
    const req2 = new Request("http://localhost:3000/api/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data2.success).toBe(true);
    expect(data2.isDuplicate).toBe(true);
    expect(data2.withdrawalId).toBe(data1.withdrawalId);
    expect(data2.withdrawalNumber).toBe(data1.withdrawalNumber);
    expect(data2.newActiveBalance).toBe(400_000);

    // Verify database ledger: wallet debited only once (balance is 400k, not 300k)
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: sellerId },
    });
    expect(wallet.activeBalance).toBe(400_000);

    const withdrawals = await prisma.withdrawal.findMany({
      where: { walletId: wallet.id },
    });
    expect(withdrawals.length).toBe(1);
  });

  it("2. Two withdrawal requests with DIFFERENT clientRequestId (same user, same amount) -> both succeed, wallet debited twice", async () => {
    const clientRequestId1 = `req-idemp-diff1-${Date.now()}-abc12345`;
    const clientRequestId2 = `req-idemp-diff2-${Date.now()}-abc12345`;

    const payload1 = {
      amount: 100_000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "Idempotency Seller",
      pin,
      clientRequestId: clientRequestId1,
    };

    const payload2 = {
      amount: 100_000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "Idempotency Seller",
      pin,
      clientRequestId: clientRequestId2,
    };

    const res1 = await POST(
      new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload1),
      })
    );
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.success).toBe(true);
    expect(data1.isDuplicate).toBe(false);
    expect(data1.newActiveBalance).toBe(400_000);

    const res2 = await POST(
      new Request("http://localhost:3000/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload2),
      })
    );
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.success).toBe(true);
    expect(data2.isDuplicate).toBe(false);
    expect(data2.newActiveBalance).toBe(300_000);
    expect(data2.withdrawalId).not.toBe(data1.withdrawalId);

    // Verify database ledger: wallet debited twice (balance is 300,000)
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: sellerId },
    });
    expect(wallet.activeBalance).toBe(300_000);

    const withdrawals = await prisma.withdrawal.findMany({
      where: { walletId: wallet.id },
    });
    expect(withdrawals.length).toBe(2);
  });

  it("3. Missing clientRequestId in request body -> 400 VALIDATION_ERROR (schema now requires it)", async () => {
    const payloadWithoutKey = {
      amount: 100_000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "Idempotency Seller",
      pin,
      // clientRequestId omitted
    };

    // Schema level verification
    const schemaValidation = WithdrawalRequestSchema.safeParse(payloadWithoutKey);
    expect(schemaValidation.success).toBe(false);
    if (!schemaValidation.success) {
      expect(schemaValidation.error.flatten().fieldErrors).toHaveProperty("clientRequestId");
    }

    // Route handler HTTP response verification
    const req = new Request("http://localhost:3000/api/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadWithoutKey),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.details).toHaveProperty("clientRequestId");
  });

  it("4. Two withdrawal requests with the SAME Idempotency-Key HTTP HEADER -> wallet debited exactly once, second response has isDuplicate: true", async () => {
    const headerKey = `hdr-idemp-same-${Date.now()}-xyz98765`;
    const payload = {
      amount: 150_000,
      bankName: "MANDIRI",
      accountNumber: "9876543210",
      accountHolder: "Idempotency Seller",
      pin,
      // clientRequestId omitted from JSON body — supplied via standard HTTP header!
    };

    // First call with Idempotency-Key header
    const req1 = new Request("http://localhost:3000/api/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": headerKey,
      },
      body: JSON.stringify(payload),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();

    expect(data1.success).toBe(true);
    expect(data1.isDuplicate).toBe(false);
    expect(data1.amount).toBe(150_000);
    expect(data1.newActiveBalance).toBe(350_000);

    // Second call: duplicate request replaying identical Idempotency-Key header
    const req2 = new Request("http://localhost:3000/api/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": headerKey,
      },
      body: JSON.stringify(payload),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();

    expect(data2.success).toBe(true);
    expect(data2.isDuplicate).toBe(true);
    expect(data2.withdrawalId).toBe(data1.withdrawalId);
    expect(data2.withdrawalNumber).toBe(data1.withdrawalNumber);
    expect(data2.newActiveBalance).toBe(350_000);

    // Verify DB ledger: wallet balance debited exactly once (350k, not 200k)
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: sellerId },
    });
    expect(wallet.activeBalance).toBe(350_000);

    const withdrawals = await prisma.withdrawal.findMany({
      where: { walletId: wallet.id, idempotencyKey: headerKey },
    });
    expect(withdrawals.length).toBe(1);
  });
});
