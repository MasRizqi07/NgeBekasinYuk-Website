// RFC 6238 Time-Based One-Time Password (TOTP) & Distributed Step-Up Authorization Service
// Implements genuine HMAC-SHA1 rotating OTP, PostgreSQL-backed distributed replay prevention (HP3-P0-02),
// AES-256-GCM encryption-at-rest (HP3-P0-03), and single-use one-time step-up grants (HP3-P0-04).

import crypto from "crypto";
import { env } from "../env";
import { signHmacSha256, verifyHmacSha256 } from "./crypto";
import { base64UrlEncode, base64UrlDecode } from "./session";
import { encryptSensitiveSecret, decryptSensitiveSecret, EncryptedPayload } from "../security/encryption";
import { prisma } from "@/server/db/prisma";

// RFC 4648 Base32 alphabet
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a buffer to RFC 4648 Base32 string.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string to a Buffer.
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${clean[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Deterministic seed secret for development and automated test fixtures.
 * STRICTLY forbidden when APP_ENV === "production".
 */
export const DEV_ADMIN_TOTP_SEED = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

/**
 * Generates a random RFC 6238 Base32 secret (160 bits = 20 bytes).
 */
export function generateTotpSecret(): string {
  const randomBytes = crypto.randomBytes(20);
  return base32Encode(randomBytes);
}

/**
 * Generates a 6-digit TOTP code for a given secret at a specific timestamp.
 */
export function generateTotpCode(secret: string, timestampMs = Date.now()): string {
  const key = base32Decode(secret);
  const step = Math.floor(timestampMs / 1000 / 30);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(step));

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (codeInt % 1_000_000).toString().padStart(6, "0");
  return otp;
}

export interface VerifyTotpParams {
  secret: string;
  code: string;
  adminId?: string;
  window?: number;
  timestampMs?: number;
}

export interface VerifyTotpResult {
  valid: boolean;
  step?: number;
  error?: "INVALID_CODE" | "REPLAY_ATTEMPT" | "EXPIRED" | "MALFORMED_INPUT";
}

// In-memory sliding replay tracker for offline/unit test execution
const inMemoryUsedSteps = new Map<string, number>();

/**
 * Test fixture helper to clear in-memory and database TOTP replay tracking.
 */
export function clearTotpReplayHistory(adminId?: string): void {
  inMemoryUsedSteps.clear();
  if (adminId) {
    prisma.user.updateMany({
      where: { id: adminId },
      data: { lastTotpStep: null },
    }).catch(() => {});
  } else {
    prisma.user.updateMany({
      where: { role: "ADMIN" },
      data: { lastTotpStep: null },
    }).catch(() => {});
  }
}

/**
 * Verifies a 6-digit TOTP code against RFC 6238 without database writes (pure algorithmic check).
 */
export function verifyTotpCode(params: VerifyTotpParams): VerifyTotpResult {
  const { secret, code, adminId, window = 1, timestampMs = Date.now() } = params;

  if (!/^\d{6}$/.test(code)) {
    return { valid: false, error: "MALFORMED_INPUT" };
  }

  const currentStep = Math.floor(timestampMs / 1000 / 30);

  for (let offset = -window; offset <= window; offset++) {
    const step = currentStep + offset;
    const expectedOtp = generateTotpCode(secret, step * 30 * 1000);

    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedOtp))) {
      // In-memory replay tracking when adminId is provided to this pure function
      if (adminId) {
        const lastStep = inMemoryUsedSteps.get(adminId);
        if (lastStep !== undefined && lastStep >= step) {
          return { valid: false, error: "REPLAY_ATTEMPT" };
        }
        inMemoryUsedSteps.set(adminId, step);
      }
      return { valid: true, step };
    }
  }

  return { valid: false, error: "INVALID_CODE" };
}

/**
 * Distributed, database-backed TOTP replay prevention (HP3-P0-02).
 * Atomically records the matched step in PostgreSQL using a conditional update.
 * If another instance or concurrent request already recorded this or a newer step, returns false.
 */
export async function recordTotpStepIfNew(adminId: string, matchedStep: number): Promise<boolean> {
  const updateResult = await prisma.user.updateMany({
    where: {
      id: adminId,
      accountStatus: "ACTIVE",
      OR: [
        { lastTotpStep: null },
        { lastTotpStep: { lt: matchedStep } },
      ],
    },
    data: {
      lastTotpStep: matchedStep,
    },
  });

  return updateResult.count === 1;
}

/**
 * Verifies a 6-digit TOTP code and authoritatively records the matched step in PostgreSQL.
 * Guarantees distributed replay defense across multiple server instances and restarts.
 */
export async function verifyAndRecordTotpCode(params: {
  adminId: string;
  secret: string;
  code: string;
  window?: number;
  timestampMs?: number;
}): Promise<VerifyTotpResult> {
  const { adminId, secret, code, window = 1, timestampMs = Date.now() } = params;

  const result = verifyTotpCode({ secret, code, window, timestampMs });
  if (!result.valid || result.step === undefined) {
    return result;
  }

  // Atomic database conditional update for distributed replay prevention
  const recorded = await recordTotpStepIfNew(adminId, result.step);
  if (!recorded) {
    return { valid: false, error: "REPLAY_ATTEMPT" };
  }

  return result;
}

// --------------------------------------------------------
// ENCRYPTED TOTP SECRET MANAGEMENT (HP3-P0-03)
// --------------------------------------------------------

export interface UserTotpRecord {
  id: string;
  totpSecret?: string | null;
  totpSecretCiphertext?: string | null;
  totpSecretIv?: string | null;
  totpSecretTag?: string | null;
  isTotpEnrolled?: boolean;
}

/**
 * Retrieves and decrypts the admin's TOTP secret from ciphertext stored at rest.
 * Falls back to legacy/dev seed only in development/test fixtures.
 */
export function getAdminDecryptedTotpSecret(user: UserTotpRecord): string | null {
  if (user.totpSecretCiphertext && user.totpSecretIv && user.totpSecretTag) {
    const payload: EncryptedPayload = {
      ciphertext: user.totpSecretCiphertext,
      iv: user.totpSecretIv,
      tag: user.totpSecretTag,
      keyVersion: 1,
    };
    return decryptSensitiveSecret(payload);
  }

  // Legacy plaintext fallback for unmigrated development fixtures
  if (user.totpSecret) {
    return user.totpSecret;
  }

  // Development fixture fallback
  if (env.APP_ENV !== "production") {
    return DEV_ADMIN_TOTP_SEED;
  }

  return null;
}

/**
 * Encrypts and persists a new TOTP secret for an administrator.
 */
export async function setAdminEncryptedTotpSecret(adminId: string, plainSecret: string): Promise<void> {
  const encrypted = encryptSensitiveSecret(plainSecret);

  await prisma.user.update({
    where: { id: adminId },
    data: {
      totpSecretCiphertext: encrypted.ciphertext,
      totpSecretIv: encrypted.iv,
      totpSecretTag: encrypted.tag,
      totpSecretKeyVersion: encrypted.keyVersion,
      isTotpEnrolled: true,
      lastTotpStep: null, // Reset step history upon new secret enrollment
    },
  });
}

// --------------------------------------------------------
// ONE-TIME ADMIN STEP-UP AUTHORIZATION GRANTS (HP3-P0-04)
// --------------------------------------------------------

export interface StepUpGrantPayload {
  grantId: string;
  adminId: string;
  action: string;
  resourceId?: string | null;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates and persists a single-use step-up authorization grant in PostgreSQL (HP3-P0-04).
 */
export async function createStepUpGrant(
  adminId: string,
  action = "DISPUTE_VERDICT",
  resourceId?: string | null
): Promise<string> {
  const ttlSeconds = env.ADMIN_STEP_UP_TTL_SECONDS;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((nowSec + ttlSeconds) * 1000);

  const grant = await prisma.adminStepUpGrant.create({
    data: {
      adminId,
      action,
      resourceId: resourceId || null,
      expiresAt,
    },
  });

  const payload: StepUpGrantPayload = {
    grantId: grant.id,
    adminId,
    action,
    resourceId: resourceId || null,
    issuedAt: nowSec,
    expiresAt: nowSec + ttlSeconds,
  };

  const json = JSON.stringify(payload);
  const base64 = base64UrlEncode(json);
  const signature = await signHmacSha256(base64, env.ADMIN_STEP_UP_SECRET);

  return `${base64}.${signature}`;
}

/**
 * Authoritatively consumes a one-time step-up grant in PostgreSQL (HP3-P0-04).
 * Rejects consumed, expired, or resource-mismatched grants.
 */
export async function consumeStepUpGrant(params: {
  grantToken: string;
  expectedAdminId: string;
  expectedAction?: string;
  expectedResourceId?: string | null;
}): Promise<{ valid: boolean; reason?: string }> {
  const {
    grantToken,
    expectedAdminId,
    expectedAction = "DISPUTE_VERDICT",
    expectedResourceId,
  } = params;

  try {
    const parts = grantToken.split(".");
    if (parts.length !== 2) return { valid: false, reason: "Malformed token" };

    const [base64, signature] = parts;
    const isValid = await verifyHmacSha256(base64, signature, env.ADMIN_STEP_UP_SECRET);
    if (!isValid) return { valid: false, reason: "Invalid signature" };

    const json = base64UrlDecode(base64);
    const payload = JSON.parse(json) as StepUpGrantPayload;

    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: "Step-up grant expired" };
    }

    if (payload.adminId !== expectedAdminId) {
      return { valid: false, reason: "Step-up grant belongs to a different admin" };
    }

    if (payload.action !== expectedAction) {
      return { valid: false, reason: "Action scope mismatch" };
    }

    if (payload.resourceId && expectedResourceId && payload.resourceId !== expectedResourceId) {
      return { valid: false, reason: "Resource scope mismatch: grant not valid for this resource" };
    }

    // Atomic one-time consumption in PostgreSQL
    const updateResult = await prisma.adminStepUpGrant.updateMany({
      where: {
        id: payload.grantId,
        adminId: expectedAdminId,
        action: expectedAction,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        OR: [
          { resourceId: null },
          { resourceId: expectedResourceId || null },
        ],
      },
      data: {
        consumedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      return { valid: false, reason: "Step-up grant has already been consumed or is invalid" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Failed to parse grant token" };
  }
}

/**
 * Verifies a step-up grant cryptographically and structurally without consuming it (read-only verification).
 */
export async function verifyStepUpGrant(
  grantToken: string,
  expectedAdminId: string,
  expectedAction = "DISPUTE_VERDICT",
  expectedResourceId?: string | null
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const parts = grantToken.split(".");
    if (parts.length !== 2) return { valid: false, reason: "Malformed token" };

    const [base64, signature] = parts;
    const isValid = await verifyHmacSha256(base64, signature, env.ADMIN_STEP_UP_SECRET);
    if (!isValid) return { valid: false, reason: "Invalid signature" };

    const json = base64UrlDecode(base64);
    const payload = JSON.parse(json) as StepUpGrantPayload;

    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: "Step-up grant expired" };
    }

    if (payload.adminId !== expectedAdminId) {
      return { valid: false, reason: "Step-up grant belongs to a different admin" };
    }

    if (payload.action !== expectedAction) {
      return { valid: false, reason: "Action scope mismatch" };
    }

    if (payload.resourceId && expectedResourceId && payload.resourceId !== expectedResourceId) {
      return { valid: false, reason: "Resource scope mismatch: grant not valid for this resource" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Failed to parse grant token" };
  }
}
