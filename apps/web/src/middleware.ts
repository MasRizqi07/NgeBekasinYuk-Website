// NgeBekasinYuk Server Route Guard & Security Headers Middleware
// Enforces cryptographic server boundary access controls for /admin routes and sets defense-in-depth headers.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/session";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ngebekasinyuk_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 1. Defense-in-Depth Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';"
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // 2. Protect /admin/* routes with Cryptographic Signature Verification (HP2-P0-01)
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(COOKIE_NAME);

    if (!sessionCookie?.value) {
      // Unauthenticated -> redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Cryptographically verify HMAC signature before trusting session contents
    const session = await verifySession(sessionCookie.value);

    if (!session) {
      // Invalid signature, tampered payload, or expired session -> reject
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check role: must be ADMIN
    if (session.role !== "ADMIN") {
      // Forbidden: regular buyers or sellers cannot access /admin
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets/* (public assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
  ],
};
