// NgeBekasinYuk Identifier Generator
// Separates internal collision-resistant IDs from public user-facing reference numbers.
// Never use Math.random() for security or financial domain identifiers.

import crypto from "crypto";

/**
 * Generates a collision-resistant internal UUIDv4 / random string.
 */
export function generateInternalId(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Generates a public human-readable order reference number.
 * Format: ORD-YYYY-XXXXXX (e.g. ORD-2026-8D71X2)
 */
export function generateOrderNumber(year = new Date().getFullYear()): string {
  const bytes = crypto.randomBytes(3);
  const randomHex = bytes.toString("hex").toUpperCase();
  return `ORD-${year}-${randomHex}`;
}

/**
 * Generates a public dispute reference number.
 * Format: DSP-YYYY-XXXXXX (e.g. DSP-2026-8D71X2)
 */
export function generateDisputeNumber(year = new Date().getFullYear()): string {
  const bytes = crypto.randomBytes(3);
  const randomHex = bytes.toString("hex").toUpperCase();
  return `DSP-${year}-${randomHex}`;
}

/**
 * Generates a public withdrawal reference number.
 * Format: WDR-YYYY-XXXXXX (e.g. WDR-2026-8F291C)
 */
export function generateWithdrawalNumber(year = new Date().getFullYear()): string {
  const bytes = crypto.randomBytes(3);
  const randomHex = bytes.toString("hex").toUpperCase();
  return `WDR-${year}-${randomHex}`;
}

/**
 * Deterministically constructs an idempotency key for financial operations.
 * Prevents duplicate payouts, releases, or webhook replays.
 */
export function buildIdempotencyKey(
  action: string,
  resourceId: string,
  extraScope?: string
): string {
  const raw = `${action}:${resourceId}:${extraScope || ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
