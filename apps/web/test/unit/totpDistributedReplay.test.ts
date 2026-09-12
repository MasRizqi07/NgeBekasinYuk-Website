import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../src/server/db/prisma";
import {
  generateTotpCode,
  verifyAndRecordTotpCode,
  DEV_ADMIN_TOTP_SEED,
} from "../../src/lib/auth/totp";

describe("Distributed Persistent TOTP Replay Prevention (HP3-P0-02)", () => {
  const testAdminId = "usr-test-distributed-totp-admin";
  const secret = DEV_ADMIN_TOTP_SEED;

  beforeEach(async () => {
    // Reset test admin state in PostgreSQL
    await prisma.user.upsert({
      where: { id: testAdminId },
      update: {
        email: "dist.totp@ngebekasinyuk.id",
        name: "Distributed Admin",
        role: "ADMIN",
        accountStatus: "ACTIVE",
        lastTotpStep: null,
      },
      create: {
        id: testAdminId,
        email: "dist.totp@ngebekasinyuk.id",
        name: "Distributed Admin",
        hashedPassword: "dummy",
        role: "ADMIN",
        accountStatus: "ACTIVE",
        lastTotpStep: null,
      },
    });
  });

  it("accepts a valid TOTP code on first submission and records lastTotpStep in PostgreSQL", async () => {
    const now = Date.now();
    const currentStep = Math.floor(now / 1000 / 30);
    const code = generateTotpCode(secret, now);

    const result = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code,
      timestampMs: now,
    });

    expect(result.valid).toBe(true);
    expect(result.step).toBe(currentStep);

    // Verify persisted in PostgreSQL
    const admin = await prisma.user.findUnique({
      where: { id: testAdminId },
      select: { lastTotpStep: true },
    });
    expect(admin?.lastTotpStep).toBe(currentStep);
  });

  it("strictly rejects replaying the exact same TOTP code in the same timestep", async () => {
    const now = Date.now();
    const code = generateTotpCode(secret, now);

    // First submission succeeds
    const first = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code,
      timestampMs: now,
    });
    expect(first.valid).toBe(true);

    // Immediate replay attempt in the same 30s window must be rejected by PostgreSQL conditional update
    const replay = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code,
      timestampMs: now,
    });
    expect(replay.valid).toBe(false);
    expect(replay.error).toBe("REPLAY_ATTEMPT");
  });

  it("survives process restart simulation because replay state is persisted in PostgreSQL", async () => {
    const now = Date.now();
    const code = generateTotpCode(secret, now);

    // First submission
    const first = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code,
      timestampMs: now,
    });
    expect(first.valid).toBe(true);

    // Simulate complete process restart (no memory caches, new execution context)
    // The database still holds lastTotpStep
    const replayAfterRestart = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code,
      timestampMs: now + 5000, // 5 seconds later, still same timestep
    });

    expect(replayAfterRestart.valid).toBe(false);
    expect(replayAfterRestart.error).toBe("REPLAY_ATTEMPT");
  });

  it("CONCURRENCY: two parallel simultaneous requests with the same TOTP result in exactly 1 success", async () => {
    const now = Date.now();
    const code = generateTotpCode(secret, now);

    // Launch both simultaneous verification attempts in parallel
    const [result1, result2] = await Promise.all([
      verifyAndRecordTotpCode({ adminId: testAdminId, secret, code, timestampMs: now }),
      verifyAndRecordTotpCode({ adminId: testAdminId, secret, code, timestampMs: now }),
    ]);

    // Exactly one must succeed, and exactly one must fail with REPLAY_ATTEMPT
    const successCount = (result1.valid ? 1 : 0) + (result2.valid ? 1 : 0);
    const replayCount =
      (result1.error === "REPLAY_ATTEMPT" ? 1 : 0) + (result2.error === "REPLAY_ATTEMPT" ? 1 : 0);

    expect(successCount).toBe(1);
    expect(replayCount).toBe(1);
  });

  it("accepts a code from the next timestep and updates lastTotpStep forward", async () => {
    const t1 = Date.now();
    const code1 = generateTotpCode(secret, t1);

    const first = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code: code1,
      timestampMs: t1,
    });
    expect(first.valid).toBe(true);

    // Next 30s timestep
    const t2 = t1 + 35 * 1000;
    const code2 = generateTotpCode(secret, t2);

    const second = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code: code2,
      timestampMs: t2,
    });
    expect(second.valid).toBe(true);
    expect(second.step).toBeGreaterThan(first.step!);
  });

  it("rejects an older timestep if a newer timestep was already accepted", async () => {
    const tNew = Date.now() + 30 * 1000;
    const codeNew = generateTotpCode(secret, tNew);

    // Newer step accepted first
    const resNew = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code: codeNew,
      timestampMs: tNew,
    });
    expect(resNew.valid).toBe(true);

    // Attempting older step (even if within drift window of current wall clock) must be rejected
    const tOld = tNew - 30 * 1000;
    const codeOld = generateTotpCode(secret, tOld);

    const resOld = await verifyAndRecordTotpCode({
      adminId: testAdminId,
      secret,
      code: codeOld,
      timestampMs: tNew,
    });
    expect(resOld.valid).toBe(false);
    expect(resOld.error).toBe("REPLAY_ATTEMPT");
  });
});
