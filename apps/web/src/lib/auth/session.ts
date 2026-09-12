// NgeBekasinYuk Server-Authoritative Session Management
// HMAC-SHA256 signed session cookie compatible with Next.js App Router and Edge Middleware.

import crypto from "crypto";
import { cookies } from "next/headers";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  isVerified: boolean;
  avatar?: string | null;
}

export interface SessionPayload extends SessionUser {
  expiresAt: number;
}

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ngebekasinyuk_session";
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-in-production-min-32-chars-key";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Creates an HMAC-SHA256 signature for the session data.
 */
function signData(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Serializes and signs a session payload.
 */
export function signSession(user: SessionUser): string {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json).toString("base64url");
  const signature = signData(base64, AUTH_SECRET);
  return `${base64}.${signature}`;
}

/**
 * Verifies and parses a signed session cookie string.
 */
export function verifySession(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [base64, signature] = parts;
    const expectedSignature = signData(base64, AUTH_SECRET);

    // Constant-time signature comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, "hex");
    const expBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return null;
    }

    const json = Buffer.from(base64, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as SessionPayload;

    // Expiration check
    if (payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sets the httpOnly session cookie on the current response context.
 */
export async function setServerSessionCookie(user: SessionUser): Promise<void> {
  const token = signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * Clears the session cookie.
 */
export async function clearServerSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Retrieves and validates the session of the currently authenticated user.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;

    const payload = verifySession(cookie.value);
    if (!payload) return null;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      isVerified: payload.isVerified,
      avatar: payload.avatar,
    };
  } catch {
    return null;
  }
}
