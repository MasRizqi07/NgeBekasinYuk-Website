// NgeBekasinYuk Database-Authoritative Session Validation & Revocation
// Enforces fresh database verification of sessionVersion, account status, and role (HP3-P0-01).

import { cookies } from "next/headers";
import { prisma } from "@/server/db/prisma";
import { verifySession, SessionUser } from "./session";
import { env } from "../env";

export interface AuthoritativeSessionUser extends SessionUser {
  accountStatus: string;
  sessionVersion: number;
}

const COOKIE_NAME = env.SESSION_COOKIE_NAME;

/**
 * Validates a session token authoritatively against the PostgreSQL database.
 * Rejects revoked sessions (token.sessionVersion !== user.sessionVersion)
 * and inactive accounts (accountStatus !== "ACTIVE").
 * Returns the authoritative user with fresh database role.
 */
export async function validateAuthoritativeSession(
  explicitToken?: string
): Promise<AuthoritativeSessionUser | null> {
  try {
    let token = explicitToken;
    if (!token) {
      const cookieStore = await cookies();
      const cookie = cookieStore.get(COOKIE_NAME);
      token = cookie?.value;
    }

    if (!token) return null;

    // 1. Cryptographic HMAC signature and expiry check
    const payload = await verifySession(token);
    if (!payload || !payload.id) return null;

    // 2. Authoritative Database State Lookup
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        avatar: true,
        accountStatus: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      // User was deleted or does not exist
      return null;
    }

    // 3. Account Status Check (reject SUSPENDED or DISABLED users)
    if (user.accountStatus !== "ACTIVE") {
      return null;
    }

    // 4. Session Version Invalidation Check
    // If user.sessionVersion was incremented, the old token is invalidated
    const tokenVersion = payload.sessionVersion ?? 1;
    if (tokenVersion !== user.sessionVersion) {
      return null;
    }

    // 5. Return authoritative identity with fresh role from database
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "BUYER" | "SELLER" | "ADMIN",
      isVerified: user.isVerified,
      avatar: user.avatar,
      sessionVersion: user.sessionVersion,
      accountStatus: user.accountStatus,
    };
  } catch (error) {
    console.error("[Session/Authoritative] Validation error:", error);
    return null;
  }
}

/**
 * Revokes all existing session tokens for a user by incrementing their database sessionVersion.
 * Logs an append-only security audit event.
 */
export async function revokeUserSessions(userId: string, reason = "SECURITY_REVOCATION"): Promise<number> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      sessionVersion: { increment: 1 },
    },
    select: { sessionVersion: true },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action: "SESSION_REVOKED",
        targetType: "User",
        targetId: userId,
        ipAddress: "127.0.0.1",
        userAgent: "system",
        details: JSON.stringify({
          reason,
          newSessionVersion: updatedUser.sessionVersion,
        }),
      },
    });
  } catch (err) {
    console.error("[Session/Revoke] Audit log error:", err);
  }

  return updatedUser.sessionVersion;
}
