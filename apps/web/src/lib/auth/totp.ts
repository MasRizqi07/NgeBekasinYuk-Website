// RFC 6238 Time-Based One-Time Password (TOTP) & Admin Step-Up Authorization Service
// Implements genuine HMAC-SHA1 rotating OTP, drift windows, replay prevention, and short-lived step-up grants.

import crypto from "crypto";
import { env } from "../env";
import { signHmacSha256, verifyHmacSha256 } from "./crypto";
import { base64UrlEncode, base64UrlDecode } from "./session";

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

// In-memory replay tracking per admin: adminId -> lastVerifiedStepNumber
const lastUsedSteps = new Map<string, number>();

/**
 * Resets TOTP replay history for an admin (or all admins). Used primarily by tests.
 */
export function clearTotpReplayHistory(adminId?: string): void {
  if (adminId) {
    lastUsedSteps.delete(adminId);
  } else {
    lastUsedSteps.clear();
  }
}

/**
 * Deterministic seed secret for development and automated integration test fixtures.
 * STRICTLY forbidden when NODE_ENV === "production".
 */
export const DEV_ADMIN_TOTP_SEED = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"; // Base32 for "Hello!\xde\xad\xbe\xef..."

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

  // Buffer for 8-byte big-endian counter
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(step));

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226)
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
  window?: number; // default +-1 step (30s before and after)
  timestampMs?: number;
}

export interface VerifyTotpResult {
  valid: boolean;
  step?: number;
  error?: "INVALID_CODE" | "REPLAY_ATTEMPT" | "EXPIRED" | "MALFORMED_INPUT";
}

/**
 * Verifies a 6-digit TOTP code according to RFC 6238 with replay prevention.
 */
export function verifyTotpCode(params: VerifyTotpParams): VerifyTotpResult {
  const { secret, code, adminId, window = 1, timestampMs = Date.now() } = params;

  if (!/^\d{6}$/.test(code)) {
    return { valid: false, error: "MALFORMED_INPUT" };
  }

  const currentStep = Math.floor(timestampMs / 1000 / 30);

  // Check windows: [currentStep - window, currentStep + window]
  for (let offset = -window; offset <= window; offset++) {
    const step = currentStep + offset;
    const expectedOtp = generateTotpCode(secret, step * 30 * 1000);

    // Constant time comparison
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedOtp))) {
      // Replay check: step must be strictly greater than last used step for this admin
      if (adminId) {
        const lastStep = lastUsedSteps.get(adminId);
        if (lastStep !== undefined && step <= lastStep) {
          return { valid: false, error: "REPLAY_ATTEMPT" };
        }
        lastUsedSteps.set(adminId, step);
      }

      return { valid: true, step };
    }
  }

  return { valid: false, error: "INVALID_CODE" };
}

export interface StepUpGrantPayload {
  adminId: string;
  action: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates a signed, short-lived (default 5 minutes) step-up authorization grant token.
 */
export async function createStepUpGrant(
  adminId: string,
  action = "DISPUTE_VERDICT"
): Promise<string> {
  const ttlSeconds = env.ADMIN_STEP_UP_TTL_SECONDS;
  const nowSec = Math.floor(Date.now() / 1000);

  const payload: StepUpGrantPayload = {
    adminId,
    action,
    issuedAt: nowSec,
    expiresAt: nowSec + ttlSeconds,
  };

  const json = JSON.stringify(payload);
  const base64 = base64UrlEncode(json);
  const signature = await signHmacSha256(base64, env.ADMIN_STEP_UP_SECRET);

  return `${base64}.${signature}`;
}

/**
 * Validates a step-up grant token for sensitive administrative actions.
 */
export async function verifyStepUpGrant(
  grantToken: string,
  expectedAdminId: string,
  expectedAction = "DISPUTE_VERDICT"
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

    return { valid: true };
  } catch {
    return { valid: false, reason: "Failed to parse grant token" };
  }
}
