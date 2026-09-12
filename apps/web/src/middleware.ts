// NgeBekasinYuk Server Route Guard & Security Headers Middleware
// Enforces server boundary access controls for /admin routes and sets defense-in-depth headers.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ngebekasinyuk_session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // 1. Defense-in-Depth Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // 2. Protect /admin/* routes
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get(COOKIE_NAME);

    if (!sessionCookie?.value) {
      // Unauthenticated -> redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const parts = sessionCookie.value.split(".");
      if (parts.length !== 2) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
      }

      // Decode payload
      const json = atob(parts[0].replace(/-/g, "+").replace(/_/g, "/"));
      const session = JSON.parse(json);

      // Check expiration
      if (session.expiresAt && session.expiresAt < Math.floor(Date.now() / 1000)) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
      }

      // Check role: must be ADMIN
      if (session.role !== "ADMIN") {
        // Forbidden: regular buyers or sellers cannot access /admin
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
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
