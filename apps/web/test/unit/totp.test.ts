// RFC 6238 TOTP and Admin Step-Up Grant Unit Tests (HP2-P0-03)
import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  createStepUpGrant,
  verifyStepUpGrant,
  DEV_ADMIN_TOTP_SEED,
} from "@/lib/auth/totp";

describe("RFC 6238 TOTP & Step-Up Grant Unit Tests", () => {
  const secret = DEV_ADMIN_TOTP_SEED;
  const adminId = "admin-test-007";

  it("generates and verifies a valid 6-digit TOTP code", () => {
    const code = generateTotpCode(secret);
    expect(code).toMatch(/^\d{6}$/);

    const result = verifyTotpCode({ secret, code });
    expect(result.valid).toBe(true);
  });

  it("rejects an incorrect 6-digit code", () => {
    const result = verifyTotpCode({ secret, code: "000000" });
    // In rare event 000000 is current code, pick one that doesn't match
    if (result.valid) {
      expect(verifyTotpCode({ secret, code: "999999" }).valid).toBe(false);
    } else {
      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_CODE");
    }
  });

  it("rejects malformed codes (non-numeric, wrong length)", () => {
    expect(verifyTotpCode({ secret, code: "12345" }).valid).toBe(false);
    expect(verifyTotpCode({ secret, code: "1234567" }).valid).toBe(false);
    expect(verifyTotpCode({ secret, code: "abcdef" }).valid).toBe(false);
  });

  it("REPLAY PREVENTION: rejects the same code when reused by the same admin in the same window", () => {
    const timestamp = Date.now();
    const code = generateTotpCode(secret, timestamp);

    // First attempt succeeds
    const firstAttempt = verifyTotpCode({
      secret,
      code,
      adminId,
      timestampMs: timestamp,
    });
    expect(firstAttempt.valid).toBe(true);

    // Second attempt with the exact same code / step is blocked as replay
    const secondAttempt = verifyTotpCode({
      secret,
      code,
      adminId,
      timestampMs: timestamp,
    });
    expect(secondAttempt.valid).toBe(false);
    expect(secondAttempt.error).toBe("REPLAY_ATTEMPT");
  });

  it("accepts codes within +-1 time step drift window (30s)", () => {
    const now = Date.now();
    // Previous step (-30s)
    const prevCode = generateTotpCode(secret, now - 30_000);
    expect(verifyTotpCode({ secret, code: prevCode, timestampMs: now, window: 1 }).valid).toBe(true);

    // Next step (+30s)
    const nextCode = generateTotpCode(secret, now + 30_000);
    expect(verifyTotpCode({ secret, code: nextCode, timestampMs: now, window: 1 }).valid).toBe(true);

    // Distant past (-90s) exceeds window 1
    const pastCode = generateTotpCode(secret, now - 90_000);
    expect(verifyTotpCode({ secret, code: pastCode, timestampMs: now, window: 1 }).valid).toBe(false);
  });

  it("creates and verifies a valid short-lived step-up grant", async () => {
    const grant = await createStepUpGrant(adminId, "DISPUTE_VERDICT");
    expect(typeof grant).toBe("string");
    expect(grant).toContain(".");

    const result = await verifyStepUpGrant(grant, adminId, "DISPUTE_VERDICT");
    expect(result.valid).toBe(true);
  });

  it("rejects a step-up grant when presented by a different admin (binding defense)", async () => {
    const grant = await createStepUpGrant(adminId, "DISPUTE_VERDICT");
    const result = await verifyStepUpGrant(grant, "attacker-admin-id", "DISPUTE_VERDICT");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("different admin");
  });

  it("rejects a step-up grant when action scope does not match", async () => {
    const grant = await createStepUpGrant(adminId, "DISPUTE_VERDICT");
    const result = await verifyStepUpGrant(grant, adminId, "WITHDRAWAL_OVERRIDE");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Action scope mismatch");
  });

  it("generates unique random secrets", () => {
    const s1 = generateTotpSecret();
    const s2 = generateTotpSecret();
    expect(s1).not.toBe(s2);
    expect(s1.length).toBeGreaterThanOrEqual(32);
  });
});
