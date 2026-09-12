import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/server/db/prisma";
import {
  createStepUpGrant,
  consumeStepUpGrant,
} from "../../src/lib/auth/totp";
import { base64UrlEncode } from "../../src/lib/auth/session";

describe("One-Time Admin Step-Up Authorization Grants (HP3-P0-04)", () => {
  const adminIdA = "usr-admin-test-grant-a";
  const adminIdB = "usr-admin-test-grant-b";
  const disputeA = "dsp-test-resource-a";
  const disputeB = "dsp-test-resource-b";

  beforeEach(async () => {
    // Setup test admin users
    await prisma.adminStepUpGrant.deleteMany({
      where: { adminId: { in: [adminIdA, adminIdB] } },
    });

    await prisma.user.upsert({
      where: { id: adminIdA },
      update: { role: "ADMIN", accountStatus: "ACTIVE" },
      create: {
        id: adminIdA,
        email: "adminA@ngebekasinyuk.id",
        name: "Admin A",
        hashedPassword: "dummy",
        role: "ADMIN",
        accountStatus: "ACTIVE",
      },
    });

    await prisma.user.upsert({
      where: { id: adminIdB },
      update: { role: "ADMIN", accountStatus: "ACTIVE" },
      create: {
        id: adminIdB,
        email: "adminB@ngebekasinyuk.id",
        name: "Admin B",
        hashedPassword: "dummy",
        role: "ADMIN",
        accountStatus: "ACTIVE",
      },
    });
  });

  it("successfully consumes a valid single-use step-up grant on first use", async () => {
    const grantToken = await createStepUpGrant(adminIdA, "DISPUTE_VERDICT", disputeA);

    const result = await consumeStepUpGrant({
      grantToken,
      expectedAdminId: adminIdA,
      expectedAction: "DISPUTE_VERDICT",
      expectedResourceId: disputeA,
    });

    expect(result.valid).toBe(true);

    // Verify record in PostgreSQL shows consumedAt set
    const grants = await prisma.adminStepUpGrant.findMany({
      where: { adminId: adminIdA, resourceId: disputeA },
    });
    expect(grants.length).toBe(1);
    expect(grants[0].consumedAt).not.toBeNull();
  });

  it("strictly rejects reusing the same step-up grant a second time (one-time invariant)", async () => {
    const grantToken = await createStepUpGrant(adminIdA, "DISPUTE_VERDICT", disputeA);

    // First use consumes the grant
    const firstUse = await consumeStepUpGrant({
      grantToken,
      expectedAdminId: adminIdA,
      expectedAction: "DISPUTE_VERDICT",
      expectedResourceId: disputeA,
    });
    expect(firstUse.valid).toBe(true);

    // Second use of the exact same grant token must be rejected
    const secondUse = await consumeStepUpGrant({
      grantToken,
      expectedAdminId: adminIdA,
      expectedAction: "DISPUTE_VERDICT",
      expectedResourceId: disputeA,
    });
    expect(secondUse.valid).toBe(false);
    expect(secondUse.reason).toMatch(/already been consumed/i);
  });

  it("CONCURRENCY: simultaneous parallel consumption of the same grant allows exactly 1 execution", async () => {
    const grantToken = await createStepUpGrant(adminIdA, "DISPUTE_VERDICT", disputeA);

    // Trigger two concurrent requests at the same instant
    const [res1, res2] = await Promise.all([
      consumeStepUpGrant({ grantToken, expectedAdminId: adminIdA, expectedAction: "DISPUTE_VERDICT", expectedResourceId: disputeA }),
      consumeStepUpGrant({ grantToken, expectedAdminId: adminIdA, expectedAction: "DISPUTE_VERDICT", expectedResourceId: disputeA }),
    ]);

    const successCount = (res1.valid ? 1 : 0) + (res2.valid ? 1 : 0);
    const failureCount = (!res1.valid ? 1 : 0) + (!res2.valid ? 1 : 0);

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);
  });

  it("rejects grant issued to Admin A when submitted by Admin B", async () => {
    const grantToken = await createStepUpGrant(adminIdA, "DISPUTE_VERDICT", disputeA);

    const result = await consumeStepUpGrant({
      grantToken,
      expectedAdminId: adminIdB, // Different admin
      expectedAction: "DISPUTE_VERDICT",
      expectedResourceId: disputeA,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/different admin/i);
  });

  it("rejects grant scoped to Dispute A when used to execute verdict on Dispute B", async () => {
    const grantToken = await createStepUpGrant(adminIdA, "DISPUTE_VERDICT", disputeA);

    const result = await consumeStepUpGrant({
      grantToken,
      expectedAdminId: adminIdA,
      expectedAction: "DISPUTE_VERDICT",
      expectedResourceId: disputeB, // Different resource
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/resource/i);
  });

  it("rejects cryptographically tampered grant tokens", async () => {
    const grantToken = await createStepUpGrant(adminIdA, "DISPUTE_VERDICT", disputeA);
    const parts = grantToken.split(".");

    // Tamper with base64 payload
    const tamperedPayload = base64UrlEncode(
      JSON.stringify({ adminId: adminIdB, action: "DISPUTE_VERDICT", expiresAt: 9999999999 })
    );
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;

    const result = await consumeStepUpGrant({
      grantToken: tamperedToken,
      expectedAdminId: adminIdA,
      expectedAction: "DISPUTE_VERDICT",
      expectedResourceId: disputeA,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/signature/i);
  });
});
