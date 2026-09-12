# NgeBekasinYuk Application Security & Defense-in-Depth Specification

## 1. Security Architecture Summary

This document details the security controls implemented to harden NgeBekasinYuk against common web and financial application vulnerabilities (OWASP Top 10).

---

## 2. Implemented Protections

### 2.1 Server-Side Authentication & Session Hardening
- **HMAC-SHA256 Signed Sessions**: Session tokens are cryptographically signed using a server-side secret (`AUTH_SECRET`).
- **Constant-Time Verification**: Uses `crypto.timingSafeEqual` to prevent timing side-channel attacks on signature checks.
- **HttpOnly & SameSite=Lax**: Session cookies are inaccessible to JavaScript (`document.cookie`), mitigating XSS token theft.
- **Strict Expiration**: Sessions expire after 7 days and tokens are rejected upon expiration.

### 2.2 Broken Access Control (BAC) & IDOR Mitigation
- **Next.js Middleware**: Guards all `/admin/:path*` routes at the server boundary, rejecting unauthenticated or non-admin requests before pages render.
- **Resource Ownership Validation**: All mutations verify that `buyerId` or `sellerId` matches the authenticated session user, rather than trusting client-provided IDs.

### 2.3 Transaction PIN Hardening (P0-04 Fix)
- **Bcrypt Hashing**: PINs are never stored in plaintext. Hashed using Bcrypt with 10 salt rounds.
- **Rate-Limiting & Lockout**: Tracks failed attempts in database. 5 consecutive incorrect entries trigger an automatic 15-minute lockout (`pinLockedUntil`).
- **No Hardcoded Bypass**: Eliminated the prototype's `pin !== "123456" && pin.length !== 6` bug.

### 2.4 Admin 2FA Step-Up Verification (P0-05 Fix)
- Sensitive dispute verdicts require server-side step-up code verification (`stepUpCode`).
- Invalid OTP attempts generate high-severity audit log entries.
- Production architecture is designed to integrate standard TOTP / WebAuthn.

### 2.5 Injection & Input Sanitization
- **Zod Schema Validation**: Every API route validates input types, lengths, string formats, and enum choices before domain processing.
- **Prisma Parameterized Queries**: Protects against SQL injection by using parameterized queries under the hood.
- **No Arbitrary HTML**: React JSX escaping is preserved everywhere; zero `dangerouslySetInnerHTML` usage.

### 2.6 Defense-in-Depth Security Headers
Configured via `src/middleware.ts` for all requests:
- `X-Frame-Options: DENY`: Prevents clickjacking.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`: Controls referrer leakage.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Restricts sensitive browser APIs.

### 2.7 Sensitive Logging Elimination
- `AuditLogger.sanitizeDetails` automatically redacts passwords, PINs, tokens, secrets, card numbers, and authorization headers before persisting audit records.
