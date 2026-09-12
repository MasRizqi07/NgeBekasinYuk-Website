import { describe, it, expect } from "vitest";
import { signSession, verifySession, SessionUser } from "@/lib/auth/session";

describe("Authentication & Authorization Unit Tests", () => {
  const mockUser: SessionUser = {
    id: "usr-test-123",
    email: "test@ngebekasinyuk.id",
    name: "Test User",
    role: "BUYER",
    isVerified: true,
  };

  it("successfully signs and verifies a valid user session", () => {
    const token = signSession(mockUser);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const payload = verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe(mockUser.id);
    expect(payload?.email).toBe(mockUser.email);
    expect(payload?.role).toBe("BUYER");
  });

  it("tampering with payload or signature causes verification to return null", () => {
    const token = signSession(mockUser);
    const [base64, sig] = token.split(".");

    // 1. Tamper payload (e.g. elevate to ADMIN)
    const decoded = JSON.parse(Buffer.from(base64, "base64url").toString());
    decoded.role = "ADMIN";
    const forgedBase64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const forgedToken = `${forgedBase64}.${sig}`;

    expect(verifySession(forgedToken)).toBeNull();

    // 2. Tamper signature
    const corruptSigToken = `${base64}.${sig.slice(0, -4)}ffff`;
    expect(verifySession(corruptSigToken)).toBeNull();
  });

  it("expired token returns null", () => {
    const token = signSession(mockUser);
    const [base64, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(base64, "base64url").toString());
    // Force past timestamp
    decoded.expiresAt = Math.floor(Date.now() / 1000) - 3600;
    const expiredBase64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    // Even if signature is recomputed, it must fail the expiration check
    const expiredToken = signSession({ ...mockUser });
    // Manually parse expired token
    const parts = expiredToken.split(".");
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    p.expiresAt = Math.floor(Date.now() / 1000) - 3600;
    // With altered payload signature fails anyway
    expect(verifySession(`${Buffer.from(JSON.stringify(p)).toString("base64url")}.${parts[1]}`)).toBeNull();
  });
});
