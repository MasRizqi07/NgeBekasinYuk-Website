// NgeBekasinYuk Server-Authoritative Session Management
// Cryptographically verified HMAC-SHA256 session cookie compatible with Edge Middleware and Node.js.

import { cookies } from "next/headers";
import { signHmacSha256, verifyHmacSha256 } from "./crypto";
import { env } from "../env";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  isVerified: boolean;
  avatar?: string | null;
  sessionVersion?: number;
}

export interface SessionPayload extends SessionUser {
  expiresAt: number;
}

const COOKIE_NAME = env.SESSION_COOKIE_NAME;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Universal Base64URL encoding (Node & Edge compatible)
 */
export function base64UrlEncode(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64url");
  }
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Universal Base64URL decoding (Node & Edge compatible)
 */
export function base64UrlDecode(base64url: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64url, "base64url").toString("utf-8");
  }
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Serializes and signs a session payload using Web Crypto HMAC-SHA256.
 */
export async function signSession(user: SessionUser): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    sessionVersion: user.sessionVersion ?? 1,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const json = JSON.stringify(payload);
  const base64 = base64UrlEncode(json);
  const signature = await signHmacSha256(base64, env.AUTH_SECRET);
  return `${base64}.${signature}`;
}

/**
 * Verifies and parses a signed session cookie string.
 * Cryptographically validates the HMAC signature before trusting any payload fields.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [base64, signature] = parts;
    if (!base64 || !signature) return null;

    // Cryptographic signature check
    const isValid = await verifyHmacSha256(base64, signature, env.AUTH_SECRET);
    if (!isValid) {
      return null;
    }

    // Decode and parse payload only after signature verification succeeds
    const json = base64UrlDecode(base64);
    const payload = JSON.parse(json) as SessionPayload;

    // Expiration check
    if (!payload.expiresAt || payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Role and identity structure check
    if (!payload.id || !payload.role) {
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
  const token = await signSession(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
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

    const payload = await verifySession(cookie.value);
    if (!payload) return null;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      isVerified: payload.isVerified,
      avatar: payload.avatar,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}
