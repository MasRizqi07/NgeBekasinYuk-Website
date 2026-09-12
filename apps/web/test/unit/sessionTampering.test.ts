// Adversarial Session Tampering Test Suite (HP2-P0-01 regression coverage)
import { describe, it, expect } from "vitest";
import { signSession, verifySession, SessionUser, base64UrlEncode } from "@/lib/auth/session";

describe("Session Tampering & Cryptographic Integrity Tests", () => {
  const validAdminUser: SessionUser = {
    id: "admin-sec-1",
    email: "superadmin@ngebekasinyuk.id",
    name: "Master Admin",
    role: "ADMIN",
    isVerified: true,
  };

  it("accepts a valid cryptographically signed admin session", async () => {
    const token = await signSession(validAdminUser);
    const session = await verifySession(token);
    expect(session).not.toBeNull();
    expect(session?.id).toBe(validAdminUser.id);
    expect(session?.role).toBe("ADMIN");
  });

  it("rejects a completely forged token with invalid HMAC signature", async () => {
    const forgedPayload = {
      ...validAdminUser,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    const forgedBase64 = base64UrlEncode(JSON.stringify(forgedPayload));
    const forgedToken = `${forgedBase64}.0000000000000000000000000000000000000000000000000000000000000000`;

    const session = await verifySession(forgedToken);
    expect(session).toBeNull();
  });

  it("rejects token when role is tampered from BUYER to ADMIN (privilege escalation attack)", async () => {
    const buyerUser: SessionUser = {
      id: "buyer-sec-2",
      email: "buyer@ngebekasinyuk.id",
      name: "Standard Buyer",
      role: "BUYER",
      isVerified: true,
    };
    const validBuyerToken = await signSession(buyerUser);
    const [base64, signature] = validBuyerToken.split(".");

    // Attacker modifies the payload to claim ADMIN role while reusing buyer signature
    const decoded = JSON.parse(Buffer.from(base64, "base64url").toString());
    decoded.role = "ADMIN";
    const tamperedBase64 = base64UrlEncode(JSON.stringify(decoded));
    const attackToken = `${tamperedBase64}.${signature}`;

    const session = await verifySession(attackToken);
    expect(session).toBeNull();
  });

  it("rejects token when userId is modified to impersonate another user", async () => {
    const validToken = await signSession(validAdminUser);
    const [base64, signature] = validToken.split(".");

    const decoded = JSON.parse(Buffer.from(base64, "base64url").toString());
    decoded.id = "victim-user-id";
    const tamperedBase64 = base64UrlEncode(JSON.stringify(decoded));
    const attackToken = `${tamperedBase64}.${signature}`;

    const session = await verifySession(attackToken);
    expect(session).toBeNull();
  });

  it("rejects token when expiry timestamp is extended without resigning", async () => {
    const validToken = await signSession(validAdminUser);
    const [base64, signature] = validToken.split(".");

    const decoded = JSON.parse(Buffer.from(base64, "base64url").toString());
    decoded.expiresAt = decoded.expiresAt + 1000000; // Extend expiry
    const tamperedBase64 = base64UrlEncode(JSON.stringify(decoded));
    const attackToken = `${tamperedBase64}.${signature}`;

    const session = await verifySession(attackToken);
    expect(session).toBeNull();
  });

  it("rejects truncated tokens", async () => {
    const validToken = await signSession(validAdminUser);
    const truncated1 = validToken.slice(0, 30);
    const truncated2 = validToken.split(".")[0]; // missing signature

    expect(await verifySession(truncated1)).toBeNull();
    expect(await verifySession(truncated2)).toBeNull();
  });

  it("rejects garbage strings and empty input", async () => {
    expect(await verifySession("")).toBeNull();
    expect(await verifySession("not.a.valid.jwt.token")).toBeNull();
    expect(await verifySession("undefined")).toBeNull();
    expect(await verifySession("null.null")).toBeNull();
  });

  it("rejects expired tokens even if signature was originally authentic", async () => {
    // Generate token with an expired timestamp
    const expiredPayload = {
      ...validAdminUser,
      expiresAt: Math.floor(Date.now() / 1000) - 300, // 5 minutes in the past
    };
    const base64 = base64UrlEncode(JSON.stringify(expiredPayload));
    // Even if an attacker had a previously authentic signature for this expired payload:
    // verifySession must fail the expiration check
    const { signHmacSha256 } = await import("@/lib/auth/crypto");
    const { env } = await import("@/lib/env");
    const validSigForExpiredPayload = await signHmacSha256(base64, env.AUTH_SECRET);
    const expiredToken = `${base64}.${validSigForExpiredPayload}`;

    const session = await verifySession(expiredToken);
    expect(session).toBeNull();
  });
});
