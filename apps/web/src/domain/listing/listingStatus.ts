/**
 * Canonical Listing Status Constants & Invariants
 *
 * Status is stored as a plain String column in PostgreSQL.
 * This file is the single source of truth for valid status strings across
 * domain logic, order transactions, escrow settlement, and database queries.
 */

export const LISTING_STATUS = {
  ACTIVE: "ACTIVE",
  RESERVED: "RESERVED",
  SOLD: "SOLD",
  ARCHIVED: "ARCHIVED",
} as const;

export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

/**
 * Terminal order statuses that release the listing from active lock/reservation.
 */
export const TERMINAL_ORDER_STATUSES = ["CANCELLED", "REFUNDED", "COMPLETED"] as const;
export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

/**
 * Single reusable helper to evaluate whether an unpaid order is expired.
 * An order is considered expired if:
 * 1. It is in PENDING_PAYMENT status, AND
 * 2. Either its latest PaymentAttempt expiresAt is in the past, OR
 *    it was created more than 2 hours ago.
 */
export function isPendingOrderExpired(order: {
  status: string;
  createdAt: Date;
  paymentAttempts?: Array<{ expiresAt: Date; status: string }>;
}): boolean {
  if (order.status !== "PENDING_PAYMENT") {
    return false;
  }

  const latestAttempt = order.paymentAttempts && order.paymentAttempts.length > 0
    ? order.paymentAttempts[0]
    : undefined;

  const isAttemptExpired = latestAttempt ? new Date() > new Date(latestAttempt.expiresAt) : false;
  const isTimeLimitExceeded = Date.now() - new Date(order.createdAt).getTime() > 2 * 60 * 60 * 1000;

  return isAttemptExpired || isTimeLimitExceeded;
}
