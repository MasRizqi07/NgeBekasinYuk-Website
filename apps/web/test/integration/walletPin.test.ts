import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/server/db/prisma";
import { POST, GET } from "@/app/api/wallet/pin/route";
import { WalletLedgerService } from "@/domain/wallet/WalletLedgerService";
import bcrypt from "bcryptjs";

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

function assertNoSecrets(obj: unknown, path = ""): void {
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
        // hasPin in GET /api/wallet/pin is an allowable boolean indicator
        if (key === "hasPin") continue;
        if (secretPattern.test(key)) {
          throw new Error(`Secret field exposed at path "${fullPath}": key matches forbidden pattern`);
        }
        assertNoSecrets(value, fullPath);
      }
    }
  }
}

describe("Wallet PIN Management Integration Tests (Tasks 4.2 & 4.3)", () => {
  let userWithoutPin: { id: string; email: string };

  beforeEach(async () => {
    const ts = Date.now().toString().slice(-6);
    const password = "Password123!";
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: `pin-test-${ts}@test.id`,
        name: "PIN Test User",
        role: "SELLER",
        hashedPassword,
        hashedPin: null,
        wallet: {
          create: {
            activeBalance: 10000000,
            heldBalance: 0,
          },
        },
      },
    });

    userWithoutPin = { id: user.id, email: user.email };
    currentSessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
      avatar: user.avatar,
      accountStatus: user.accountStatus,
      sessionVersion: user.sessionVersion,
    };
  });

  it("1. Rejects request without session with 401", async () => {
    currentSessionUser = null;

    const req = new Request("http://localhost:3000/api/wallet/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Password123!", pin: "839201" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("2. Rejects wrong password with 401 and increments failed attempts (Task 4.2 brake)", async () => {
    const req = new Request("http://localhost:3000/api/wallet/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "WrongPassword!", pin: "839201" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("INVALID_CREDENTIALS");

    // Check failed attempt incremented in DB
    const dbUser = await prisma.user.findUnique({ where: { id: userWithoutPin.id } });
    expect(dbUser?.pinFailedAttempts).toBe(1);

    // Verify audit log created
    const auditLog = await prisma.auditLog.findFirst({
      where: { userId: userWithoutPin.id, action: "PASSWORD_ATTEMPT_FAILED" },
    });
    expect(auditLog).toBeDefined();
  });

  it("3. Locks account after 5 failed password attempts", async () => {
    for (let i = 1; i <= 4; i++) {
      const req = new Request("http://localhost:3000/api/wallet/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "WrongPassword!", pin: "839201" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    }

    // 5th attempt: triggers lock
    const fifthReq = new Request("http://localhost:3000/api/wallet/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "WrongPassword!", pin: "839201" }),
    });
    const fifthRes = await POST(fifthReq);
    expect(fifthRes.status).toBe(401);
    const fifthBody = await fifthRes.json();
    expect(fifthBody.error).toBe("ACCOUNT_LOCKED");

    const dbUser = await prisma.user.findUnique({ where: { id: userWithoutPin.id } });
    expect(dbUser?.pinFailedAttempts).toBe(5);
    expect(dbUser?.pinLockedUntil).toBeDefined();
  });

  it("4. Rejects trivially weak PINs with 422 PIN_TOO_WEAK", async () => {
    const weakPins = ["000000", "123456", "654321", "111111", "999999"];

    for (const weakPin of weakPins) {
      const req = new Request("http://localhost:3000/api/wallet/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "Password123!", pin: weakPin }),
      });

      const res = await POST(req);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe("PIN_TOO_WEAK");
    }
  });

  it("5. Successfully sets PIN, stores hash, writes AuditLog, and passes assertNoSecrets", async () => {
    const newPin = "741852";
    const req = new Request("http://localhost:3000/api/wallet/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Password123!", pin: newPin }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Response must pass assertNoSecrets
    assertNoSecrets(body);

    // Verify hash in DB
    const dbUser = await prisma.user.findUnique({ where: { id: userWithoutPin.id } });
    expect(dbUser?.hashedPin).toBeDefined();
    expect(dbUser?.hashedPin).not.toBeNull();
    const isMatch = await bcrypt.compare(newPin, dbUser!.hashedPin!);
    expect(isMatch).toBe(true);

    // Verify AuditLog
    const auditLog = await prisma.auditLog.findFirst({
      where: { userId: userWithoutPin.id, action: "PIN_SET" },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.details).not.toContain(newPin);
    expect(auditLog?.details).not.toContain(dbUser?.hashedPin);

    // 6. Second call to set PIN returns 409 PIN_ALREADY_SET
    const secondReq = new Request("http://localhost:3000/api/wallet/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Password123!", pin: "963852" }),
    });
    const secondRes = await POST(secondReq);
    expect(secondRes.status).toBe(409);
    const secondBody = await secondRes.json();
    expect(secondBody.error).toBe("PIN_ALREADY_SET");

    // 7. Withdrawal now succeeds with the new PIN and fails with old default "123456"
    await expect(
      WalletLedgerService.requestWithdrawal({
        userId: userWithoutPin.id,
        amount: 50000,
        bankName: "BCA",
        accountNumber: "1234567890",
        accountHolder: "PIN Test User",
        pin: "123456",
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "INVALID_PIN",
      })
    );

    const withdrawSuccess = await WalletLedgerService.requestWithdrawal({
      userId: userWithoutPin.id,
      amount: 50000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "PIN Test User",
      pin: newPin,
    });
    expect(withdrawSuccess.success).toBe(true);
    expect(withdrawSuccess.newActiveBalance).toBe(9950000);
  });

  it("6. GET /api/wallet/pin returns hasPin accurately and passes assertNoSecrets", async () => {
    // Before PIN set
    const resBefore = await GET();
    expect(resBefore.status).toBe(200);
    const bodyBefore = await resBefore.json();
    expect(bodyBefore.hasPin).toBe(false);
    assertNoSecrets(bodyBefore);

    // Set PIN
    await prisma.user.update({
      where: { id: userWithoutPin.id },
      data: { hashedPin: await bcrypt.hash("852963", 10) },
    });

    // After PIN set
    const resAfter = await GET();
    expect(resAfter.status).toBe(200);
    const bodyAfter = await resAfter.json();
    expect(bodyAfter.hasPin).toBe(true);
    assertNoSecrets(bodyAfter);
  });
});
