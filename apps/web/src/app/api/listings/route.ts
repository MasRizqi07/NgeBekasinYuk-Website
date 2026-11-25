import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import {
  createListing,
  listListings,
  parseListListingsQuery,
} from "@/domain/listing/listingService";
import {
  handleRouteError,
  problemResponse,
  requestPathname,
} from "@/lib/http/problemDetails";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = parseListListingsQuery(url.searchParams);

    let session = null;
    if (query.mine || query.status !== undefined) {
      session = await validateAuthoritativeSession();
    }

    const result = await listListings(query, session);
    return NextResponse.json(
      {
        object: "list",
        data: result.data,
        pagination: result.pagination,
      },
      { status: 200 }
    );
  } catch (err) {
    return handleRouteError(err, request, "GET /api/listings");
  }
}

export async function POST(request: Request) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return problemResponse({
        error: "UNAUTHORIZED",
        title: "Autentikasi Diperlukan",
        status: 401,
        detail: "Silakan login terlebih dahulu untuk membuat iklan.",
        instance: requestPathname(request),
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return problemResponse({
        error: "INVALID_JSON",
        title: "Payload JSON Tidak Valid",
        status: 400,
        detail: "Body permintaan harus berupa JSON yang valid.",
        instance: requestPathname(request),
      });
    }

    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    const result = await createListing({
      actor: {
        id: session.id,
        name: session.name,
        role: session.role,
      },
      rawBody,
      idempotencyKey,
    });

    return NextResponse.json(result.listing, {
      status: 201,
      headers: result.replayed ? { "X-Idempotency-Replayed": "true" } : undefined,
    });
  } catch (err) {
    return handleRouteError(err, request, "POST /api/listings");
  }
}
