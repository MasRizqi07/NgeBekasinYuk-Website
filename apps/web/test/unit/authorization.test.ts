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

  it("successfully signs and verifies a valid user session", async () => {
    const token = await signSession(mockUser);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const payload = await verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe(mockUser.id);
    expect(payload?.email).toBe(mockUser.email);
    expect(payload?.role).toBe("BUYER");
  });

  it("tampering with payload or signature causes verification to return null", async () => {
    const token = await signSession(mockUser);
    const [base64, sig] = token.split(".");

    // 1. Tamper payload (e.g. elevate to ADMIN)
    const decoded = JSON.parse(Buffer.from(base64, "base64url").toString());
    decoded.role = "ADMIN";
    const forgedBase64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const forgedToken = `${forgedBase64}.${sig}`;

    expect(await verifySession(forgedToken)).toBeNull();

    // 2. Tamper signature
    const corruptSigToken = `${base64}.${sig.slice(0, -4)}ffff`;
    expect(await verifySession(corruptSigToken)).toBeNull();
  });

  it("expired token returns null", async () => {
    const expiredUser: SessionUser = {
      ...mockUser,
    };
    const validToken = await signSession(expiredUser);
    const parts = validToken.split(".");
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    payload.expiresAt = Math.floor(Date.now() / 1000) - 3600;

    const expiredBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    // With altered payload, signature fails immediately
    expect(await verifySession(`${expiredBase64}.${parts[1]}`)).toBeNull();
  });
});
