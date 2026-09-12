import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/server/db/prisma";
import { signSession } from "../../src/lib/auth/session";
import { validateAuthoritativeSession, revokeUserSessions } from "../../src/lib/auth/authoritativeSession";

describe("Authoritative Session Validation & Revocation (HP3-P0-01)", () => {
  const testUserId = "usr-test-revocation-user";

  beforeEach(async () => {
    // Reset test user state
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {
        email: "revocation.test@ngebekasinyuk.id",
        name: "Revocation Tester",
        role: "ADMIN",
        sessionVersion: 1,
        accountStatus: "ACTIVE",
      },
      create: {
        id: testUserId,
        email: "revocation.test@ngebekasinyuk.id",
        name: "Revocation Tester",
        hashedPassword: "hashed_dummy_password",
        role: "ADMIN",
        sessionVersion: 1,
        accountStatus: "ACTIVE",
      },
    });
  });

  it("authoritatively validates an active session when sessionVersion matches", async () => {
    const token = await signSession({
      id: testUserId,
      email: "revocation.test@ngebekasinyuk.id",
      name: "Revocation Tester",
      role: "ADMIN",
      isVerified: true,
      sessionVersion: 1,
    });

    const session = await validateAuthoritativeSession(token);
    expect(session).not.toBeNull();
    expect(session?.id).toBe(testUserId);
    expect(session?.role).toBe("ADMIN");
    expect(session?.sessionVersion).toBe(1);
    expect(session?.accountStatus).toBe("ACTIVE");
  });

  it("rejects token immediately if sessionVersion was incremented in the database", async () => {
    const oldToken = await signSession({
      id: testUserId,
      email: "revocation.test@ngebekasinyuk.id",
      name: "Revocation Tester",
      role: "ADMIN",
      isVerified: true,
      sessionVersion: 1,
    });

    // Revoke sessions via helper (increments sessionVersion to 2)
    const newVersion = await revokeUserSessions(testUserId, "PASSWORD_RESET");
    expect(newVersion).toBe(2);

    // Old token with version 1 must now be rejected
    const session = await validateAuthoritativeSession(oldToken);
    expect(session).toBeNull();

    // A newly issued token with version 2 is accepted
    const newToken = await signSession({
      id: testUserId,
      email: "revocation.test@ngebekasinyuk.id",
      name: "Revocation Tester",
      role: "ADMIN",
      isVerified: true,
      sessionVersion: 2,
    });

    const newSession = await validateAuthoritativeSession(newToken);
    expect(newSession).not.toBeNull();
    expect(newSession?.sessionVersion).toBe(2);
  });

  it("revokes privileged admin access immediately upon role demotion in DB even with signed token", async () => {
    const adminToken = await signSession({
      id: testUserId,
      email: "revocation.test@ngebekasinyuk.id",
      name: "Revocation Tester",
      role: "ADMIN", // Token claims ADMIN
      isVerified: true,
      sessionVersion: 1,
    });

    // Demote user in database to BUYER
    await prisma.user.update({
      where: { id: testUserId },
      data: { role: "BUYER" },
    });

    // Authoritative check must return the current database role (BUYER), not the stale claim (ADMIN)
    const session = await validateAuthoritativeSession(adminToken);
    expect(session).not.toBeNull();
    expect(session?.role).toBe("BUYER");
  });

  it("rejects valid signed token if account is SUSPENDED or DISABLED", async () => {
    const token = await signSession({
      id: testUserId,
      email: "revocation.test@ngebekasinyuk.id",
      name: "Revocation Tester",
      role: "ADMIN",
      isVerified: true,
      sessionVersion: 1,
    });

    // Suspend account
    await prisma.user.update({
      where: { id: testUserId },
      data: { accountStatus: "SUSPENDED" },
    });

    expect(await validateAuthoritativeSession(token)).toBeNull();

    // Disable account
    await prisma.user.update({
      where: { id: testUserId },
      data: { accountStatus: "DISABLED" },
    });

    expect(await validateAuthoritativeSession(token)).toBeNull();
  });

  it("rejects valid signed token if user record was deleted", async () => {
    const ghostUserId = "usr-ghost-deleted-user";
    const token = await signSession({
      id: ghostUserId,
      email: "ghost@ngebekasinyuk.id",
      name: "Ghost User",
      role: "BUYER",
      isVerified: false,
      sessionVersion: 1,
    });

    expect(await validateAuthoritativeSession(token)).toBeNull();
  });
});
