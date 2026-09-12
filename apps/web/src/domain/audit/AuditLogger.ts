// NgeBekasinYuk Append-Only Security Audit Logger
// Invariant: Never log plaintext passwords, PINs, raw JWTs, or unmasked credit cards.

import { prisma } from "@/server/db/prisma";

export type AuditAction =
  | "ADMIN_VERDICT"
  | "ESCROW_RELEASE"
  | "ESCROW_REFUND"
  | "WITHDRAW_REQUEST"
  | "WITHDRAW_SUCCESS"
  | "WITHDRAW_FAILED"
  | "PIN_ATTEMPT_FAILED"
  | "PIN_LOCKED"
  | "LOGIN_FAILED"
  | "LOGIN_SUCCESS"
  | "ADMIN_STEP_UP"
  | "DISPUTE_OPENED"
  | "PAYMENT_CONFIRMED";

export type AuditTargetType =
  | "User"
  | "Order"
  | "EscrowAccount"
  | "Wallet"
  | "Withdrawal"
  | "Dispute";

export interface LogAuditParams {
  userId?: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export class AuditLogger {
  /**
   * Sanitizes payload to guarantee no sensitive data is persisted in audit logs.
   */
  private static sanitizeDetails(details?: Record<string, unknown>): string {
    if (!details) return "{}";
    const sensitiveKeys = [
      "password",
      "pin",
      "token",
      "secret",
      "totp",
      "cardNumber",
      "cvv",
      "authHeader",
    ];

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = value;
      }
    }

    return JSON.stringify(clean);
  }

  /**
   * Appends an immutable security audit event to the database.
   */
  static async log(params: LogAuditParams): Promise<void> {
    const { userId, action, targetType, targetId, ipAddress, userAgent, details } = params;

    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || undefined,
          action,
          targetType,
          targetId,
          ipAddress,
          userAgent,
          details: this.sanitizeDetails(details),
        },
      });
    } catch (err) {
      // In production, fallback to process.stderr so audit logging never crashes business flows silently
      console.error("[AuditLogger] Failed to write audit record:", err);
    }
  }
}
