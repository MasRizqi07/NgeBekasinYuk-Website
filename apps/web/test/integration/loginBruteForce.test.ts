import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db/prisma";

const capturedCookieSets: Array<{ name: string; value: string }> = [];

// Provide an in-memory Next.js cookies() store so handlers using next/headers cookies()
// execute identically inside Vitest without mocking auth logic or the database.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
    set: (name: string, value: string) => {
      capturedCookieSets.push({ name, value });
    },
    delete: () => undefined,
  })),
}));

import { POST } from "@/app/api/auth/login/route";

function buildLoginRequest(email: string, password: string): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

function hasSessionCookie(res: Response): boolean {
  const setCookieHeader = res.headers.get("set-cookie") || "";
  if (setCookieHeader.includes("ngebekasinyuk_session=")) return true;
  return capturedCookieSets.some((c) => c.name === "ngebekasinyuk_session" && c.value.length > 0);
}

describe("Login Brute-Force Protection Integration Tests (AC9.3 - AC9.5)", () => {
  const createdUserIds: string[] = [];
  const validPassword = "CorrectPassword123!";
  let testEmail = "";
  let testUserId = "";

  beforeEach(async () => {
    capturedCookieSets.length = 0;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    testEmail = `login-bf-${suffix}@test.id`;
    const hashedPassword = await bcrypt.hash(validPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Login BruteForce Test User",
        role: "BUYER",
        hashedPassword,
      },
    });
    testUserId = user.id;
    createdUserIds.push(user.id);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("AC9.3: locks account for 15 minutes after 5 consecutive wrong passwords and rejects 6th correct password without setting session cookie", async () => {
    for (let i = 1; i <= 4; i++) {
      const res = await POST(buildLoginRequest(testEmail, `WrongPassword-${i}`));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("INVALID_CREDENTIALS");
      expect(typeof body.message).toBe("string");
      expect(body.retryAfter).toBeUndefined();
      expect(hasSessionCookie(res)).toBe(false);
    }

    // 5th consecutive wrong password triggers lock
    const fifthRes = await POST(buildLoginRequest(testEmail, "WrongPassword-5"));
    expect(fifthRes.status).toBe(401);
    const fifthBody = await fifthRes.json();
    expect(fifthBody.error).toBe("INVALID_CREDENTIALS");
    expect(typeof fifthBody.retryAfter).toBe("number");
    expect(fifthBody.retryAfter).toBeGreaterThan(0);
    expect(fifthBody.retryAfter).toBeLessThanOrEqual(15 * 60);
    expect(hasSessionCookie(fifthRes)).toBe(false);

    // 6th attempt uses the CORRECT password within 15 minutes -> rejected with lock response, no cookie
    capturedCookieSets.length = 0;
    const sixthRes = await POST(buildLoginRequest(testEmail, validPassword));
    expect(sixthRes.status).toBe(401);
    const sixthBody = await sixthRes.json();
    expect(sixthBody.error).toBe("INVALID_CREDENTIALS");
    expect(typeof sixthBody.message).toBe("string");
    expect(typeof sixthBody.retryAfter).toBe("number");
    expect(sixthBody.retryAfter).toBeGreaterThan(0);
    expect(sixthBody.retryAfter).toBeLessThanOrEqual(15 * 60);
    expect(hasSessionCookie(sixthRes)).toBe(false);
  });

  it("AC9.4: unknown email and known email with wrong password return identical HTTP status and JSON keys", async () => {
    const unknownRes = await POST(
      buildLoginRequest(`unknown-${Date.now()}-${Math.random().toString(36).slice(2)}@test.id`, "WrongPassword!")
    );
    const knownWrongRes = await POST(buildLoginRequest(testEmail, "WrongPassword!"));

    expect(unknownRes.status).toBe(401);
    expect(knownWrongRes.status).toBe(unknownRes.status);

    const unknownBody = await unknownRes.json();
    const knownWrongBody = await knownWrongRes.json();

    expect(Object.keys(unknownBody).sort()).toEqual(Object.keys(knownWrongBody).sort());
    expect(unknownBody).toEqual(knownWrongBody);
    expect(hasSessionCookie(unknownRes)).toBe(false);
    expect(hasSessionCookie(knownWrongRes)).toBe(false);
  });

  it(
    "AC9.5: 20 concurrent wrong-password requests increment loginFailedAttempts without undercounting and lock the account",
    async () => {
      const requests = Array.from({ length: 20 }, (_, i) =>
        POST(buildLoginRequest(testEmail, `ConcurrentWrong-${i}`))
      );
      const responses = await Promise.all(requests);

      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(hasSessionCookie(res)).toBe(false);
      }

      // Immediate attempt with correct password must be rejected by the lock
      capturedCookieSets.length = 0;
      const correctAfterStorm = await POST(buildLoginRequest(testEmail, validPassword));
      expect(correctAfterStorm.status).toBe(401);
      const lockBody = await correctAfterStorm.json();
      expect(lockBody.error).toBe("INVALID_CREDENTIALS");
      expect(typeof lockBody.retryAfter).toBe("number");
      expect(lockBody.retryAfter).toBeGreaterThan(0);
      expect(hasSessionCookie(correctAfterStorm)).toBe(false);

      const rows = await prisma.$queryRaw<
        Array<{ loginFailedAttempts: number; loginLockedUntil: Date | null }>
      >`SELECT "loginFailedAttempts", "loginLockedUntil" FROM "User" WHERE id = ${testUserId}`;

      expect(rows).toHaveLength(1);
      expect(Number(rows[0].loginFailedAttempts)).toBe(20);
      expect(rows[0].loginLockedUntil).not.toBeNull();
      expect(new Date(rows[0].loginLockedUntil!).getTime()).toBeGreaterThan(Date.now());
    },
    20_000
  );

  it("resets loginFailedAttempts on successful login and clears expired lock on subsequent attempts", async () => {
    // 4 wrong attempts
    for (let i = 1; i <= 4; i++) {
      const res = await POST(buildLoginRequest(testEmail, `Wrong-${i}`));
      expect(res.status).toBe(401);
    }

    // Successful login resets counter
    const okRes = await POST(buildLoginRequest(testEmail, validPassword));
    expect(okRes.status).toBe(200);
    expect(hasSessionCookie(okRes)).toBe(true);

    const afterSuccess = await prisma.$queryRaw<
      Array<{ loginFailedAttempts: number; loginLockedUntil: Date | null }>
    >`SELECT "loginFailedAttempts", "loginLockedUntil" FROM "User" WHERE id = ${testUserId}`;
    expect(Number(afterSuccess[0].loginFailedAttempts)).toBe(0);
    expect(afterSuccess[0].loginLockedUntil).toBeNull();

    // Simulate an expired lock (lockedUntil in the past with 5 failed attempts)
    const pastDate = new Date(Date.now() - 10_000);
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        loginFailedAttempts: 5,
        loginLockedUntil: pastDate,
      },
    });

    // One wrong password after lock expiry starts fresh at 1 (does not immediately re-lock)
    const afterExpiryWrong = await POST(buildLoginRequest(testEmail, "WrongAgain!"));
    expect(afterExpiryWrong.status).toBe(401);
    const bodyAfterExpiry = await afterExpiryWrong.json();
    expect(bodyAfterExpiry.retryAfter).toBeUndefined();

    const afterExpiryRows = await prisma.$queryRaw<
      Array<{ loginFailedAttempts: number; loginLockedUntil: Date | null }>
    >`SELECT "loginFailedAttempts", "loginLockedUntil" FROM "User" WHERE id = ${testUserId}`;
    expect(Number(afterExpiryRows[0].loginFailedAttempts)).toBe(1);
    expect(afterExpiryRows[0].loginLockedUntil).toBeNull();
  });
});
