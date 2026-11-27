import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcryptjs";
import { LoginSchema } from "@/lib/validations";
import { setSessionCookieOnResponse } from "@/lib/auth/session";
import { AuditLogger } from "@/domain/audit/AuditLogger";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const INVALID_CREDENTIALS_MESSAGE = "Email atau kata sandi tidak cocok.";

let cachedDummyTimingHash: string | null = null;
function getDummyTimingHash(): string {
  if (!cachedDummyTimingHash) {
    cachedDummyTimingHash = bcrypt.hashSync("ngebekasinyuk-dummy-timing-guard", 10);
  }
  return cachedDummyTimingHash;
}

function computeRetryAfterSeconds(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

function invalidCredentialsResponse(retryAfter?: number) {
  const payload: { error: string; message: string; retryAfter?: number } = {
    error: "INVALID_CREDENTIALS",
    message: INVALID_CREDENTIALS_MESSAGE,
  };
  if (typeof retryAfter === "number") {
    payload.retryAfter = retryAfter;
  }
  return NextResponse.json(payload, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const validated = LoginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = validated.data;
    const now = new Date();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        avatar: true,
        hashedPassword: true,
        sessionVersion: true,
        loginFailedAttempts: true,
        loginLockedUntil: true,
      },
    });

    if (!user) {
      await bcrypt.compare(password, getDummyTimingHash());
      await AuditLogger.log({
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: email,
        details: { reason: "User not found" },
      });
      return invalidCredentialsResponse();
    }

    if (user.loginLockedUntil && user.loginLockedUntil > now) {
      await bcrypt.compare(password, getDummyTimingHash());
      const retryAfter = computeRetryAfterSeconds(user.loginLockedUntil, now);
      await AuditLogger.log({
        userId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        details: { reason: "Account locked", retryAfter },
      });
      return invalidCredentialsResponse(retryAfter);
    }

    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      const nowUtcIso = now.toISOString();
      const lockUntilUtcIso = new Date(now.getTime() + LOGIN_LOCKOUT_MS).toISOString();
      const updatedRows = await prisma.$queryRaw<
        Array<{ loginFailedAttempts: number; loginLockedUntil: Date | null }>
      >`
        UPDATE "User"
        SET
          "loginFailedAttempts" = CASE
            WHEN "loginLockedUntil" IS NOT NULL AND "loginLockedUntil" <= (${nowUtcIso}::timestamptz AT TIME ZONE 'UTC') THEN 1
            ELSE "loginFailedAttempts" + 1
          END,
          "loginLockedUntil" = CASE
            WHEN "loginLockedUntil" IS NOT NULL AND "loginLockedUntil" > (${nowUtcIso}::timestamptz AT TIME ZONE 'UTC') THEN "loginLockedUntil"
            WHEN (
              CASE
                WHEN "loginLockedUntil" IS NOT NULL AND "loginLockedUntil" <= (${nowUtcIso}::timestamptz AT TIME ZONE 'UTC') THEN 1
                ELSE "loginFailedAttempts" + 1
              END
            ) >= ${MAX_LOGIN_ATTEMPTS} THEN (${lockUntilUtcIso}::timestamptz AT TIME ZONE 'UTC')
            ELSE NULL
          END,
          "updatedAt" = (${nowUtcIso}::timestamptz AT TIME ZONE 'UTC')
        WHERE "id" = ${user.id}
        RETURNING "loginFailedAttempts", "loginLockedUntil"
      `;

      const updated = updatedRows[0];
      const lockedUntil = updated?.loginLockedUntil ?? null;
      const isNowLocked = Boolean(lockedUntil && lockedUntil > now);

      await AuditLogger.log({
        userId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        details: {
          reason: "Incorrect password",
          attempts: updated?.loginFailedAttempts,
          locked: isNowLocked,
        },
      });

      if (isNowLocked && lockedUntil) {
        return invalidCredentialsResponse(computeRetryAfterSeconds(lockedUntil, now));
      }
      return invalidCredentialsResponse();
    }

    // Atomically reset failure counter only if account was not concurrently locked during bcrypt verification
    const resetResult = await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ loginLockedUntil: null }, { loginLockedUntil: { lte: now } }],
      },
      data: {
        loginFailedAttempts: 0,
        loginLockedUntil: null,
      },
    });

    if (resetResult.count === 0) {
      const latest = await prisma.user.findUnique({
        where: { id: user.id },
        select: { loginLockedUntil: true },
      });
      const retryAfter =
        latest?.loginLockedUntil && latest.loginLockedUntil > now
          ? computeRetryAfterSeconds(latest.loginLockedUntil, now)
          : Math.ceil(LOGIN_LOCKOUT_MS / 1000);
      await AuditLogger.log({
        userId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        details: { reason: "Account locked concurrently", retryAfter },
      });
      return invalidCredentialsResponse(retryAfter);
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        avatar: user.avatar ?? null,
      },
    });

    await setSessionCookieOnResponse(response, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "BUYER" | "SELLER" | "ADMIN",
      isVerified: user.isVerified,
      avatar: user.avatar,
      sessionVersion: user.sessionVersion,
    });

    await AuditLogger.log({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      targetType: "User",
      targetId: user.id,
    });

    return response;
  } catch (error) {
    console.error("[Auth/Login] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
