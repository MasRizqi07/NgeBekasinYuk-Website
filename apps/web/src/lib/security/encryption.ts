// NgeBekasinYuk Authenticated Application-Layer Secret Encryption (AES-256-GCM)
// Provides confidentiality and integrity verification for sensitive credentials at rest (HP3-P0-03).

import crypto from "crypto";
import { env } from "../env";

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64 (12 bytes)
  tag: string;        // Base64 (16 bytes)
  keyVersion: number;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // Standard 96-bit IV for AES-GCM
const CURRENT_KEY_VERSION = 1;

/**
 * Derives or validates a 32-byte cryptographic key buffer.
 */
function resolveKeyBuffer(explicitKey?: string): Buffer {
  const secret = explicitKey || env.TOTP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("TOTP_ENCRYPTION_KEY is required for cryptographic operations.");
  }

  // If secret is 32 bytes raw or hex/base64 representation, normalize
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must provide at least 32 bytes of entropy.");
  }

  // Use SHA-256 to deterministically derive a strict 256-bit (32-byte) key
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Encrypts a plaintext sensitive secret using AES-256-GCM with a fresh random IV.
 */
export function encryptSensitiveSecret(plaintext: string, explicitKey?: string): EncryptedPayload {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Cannot encrypt empty or non-string secret.");
  }

  const key = resolveKeyBuffer(explicitKey);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    keyVersion: CURRENT_KEY_VERSION,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload, authenticating ciphertext integrity.
 * Throws an error if ciphertext or auth tag has been tampered with or if key is invalid.
 */
export function decryptSensitiveSecret(payload: EncryptedPayload, explicitKey?: string): string {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.tag) {
    throw new Error("Invalid encrypted payload: ciphertext, iv, and tag are required.");
  }

  const key = resolveKeyBuffer(explicitKey);
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes.`);
  }

  if (tag.length !== 16) {
    throw new Error("Invalid GCM authentication tag length: expected 16 bytes.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(payload.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
