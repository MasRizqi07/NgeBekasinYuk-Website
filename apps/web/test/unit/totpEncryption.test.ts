import { describe, it, expect } from "vitest";
import {
  encryptSensitiveSecret,
  decryptSensitiveSecret,
  EncryptedPayload,
} from "../../src/lib/security/encryption";
import { parseEnv, DEV_TOTP_ENCRYPTION_KEY_FALLBACK } from "../../src/lib/env";

describe("TOTP Application-Layer AES-256-GCM Encryption (HP3-P0-03)", () => {
  const testPlainSecret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  const customKey = "custom-test-encryption-key-32-chars-long";

  it("encrypts and successfully decrypts a plaintext TOTP secret", () => {
    const encrypted = encryptSensitiveSecret(testPlainSecret, customKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = decryptSensitiveSecret(encrypted, customKey);
    expect(decrypted).toBe(testPlainSecret);
  });

  it("produces different ciphertexts and IVs for identical plaintext (fresh random IV invariant)", () => {
    const enc1 = encryptSensitiveSecret(testPlainSecret, customKey);
    const enc2 = encryptSensitiveSecret(testPlainSecret, customKey);

    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);

    // Both decrypt to the same original secret
    expect(decryptSensitiveSecret(enc1, customKey)).toBe(testPlainSecret);
    expect(decryptSensitiveSecret(enc2, customKey)).toBe(testPlainSecret);
  });

  it("fails decryption when ciphertext is tampered with", () => {
    const encrypted = encryptSensitiveSecret(testPlainSecret, customKey);

    // Tamper with ciphertext by altering characters
    const tamperedPayload: EncryptedPayload = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -4) + "AAAA",
    };

    expect(() => decryptSensitiveSecret(tamperedPayload, customKey)).toThrow();
  });

  it("fails decryption when authentication tag is tampered with", () => {
    const encrypted = encryptSensitiveSecret(testPlainSecret, customKey);

    const tamperedPayload: EncryptedPayload = {
      ...encrypted,
      tag: Buffer.from("0123456789abcdef0123456789abcdef", "hex").toString("base64"),
    };

    expect(() => decryptSensitiveSecret(tamperedPayload, customKey)).toThrow();
  });

  it("fails decryption when wrong key is provided", () => {
    const encrypted = encryptSensitiveSecret(testPlainSecret, customKey);
    const wrongKey = "different-encryption-key-32-characters-test";

    expect(() => decryptSensitiveSecret(encrypted, wrongKey)).toThrow();
  });

  it("enforces fail-closed behavior in production if TOTP_ENCRYPTION_KEY uses dev fallback", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/prod_db",
        AUTH_SECRET: "strong-prod-auth-secret-32-chars-long",
        ADMIN_STEP_UP_SECRET: "strong-prod-admin-secret-32-chars-long",
        TOTP_ENCRYPTION_KEY: DEV_TOTP_ENCRYPTION_KEY_FALLBACK, // Dev fallback in production
        DEMO_PAYMENT_PROVIDER: "false",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
      })
    ).toThrow(/TOTP_ENCRYPTION_KEY in production cannot use the development fallback/);
  });

  it("enforces fail-closed behavior in production if TOTP_ENCRYPTION_KEY is missing or too short", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        APP_ENV: "production",
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/prod_db",
        AUTH_SECRET: "strong-prod-auth-secret-32-chars-long",
        ADMIN_STEP_UP_SECRET: "strong-prod-admin-secret-32-chars-long",
        TOTP_ENCRYPTION_KEY: "too-short-key",
        DEMO_PAYMENT_PROVIDER: "false",
        DEMO_KYC_PROVIDER: "false",
        DEMO_WITHDRAWAL_PROVIDER: "false",
      })
    ).toThrow(/TOTP_ENCRYPTION_KEY must be at least 32 characters/);
  });
});
