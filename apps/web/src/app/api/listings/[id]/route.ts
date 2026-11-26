import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import {
  getListingByIdOrSlug,
  updateListing,
} from "@/domain/listing/listingService";
import {
  handleRouteError,
  problemResponse,
  requestPathname,
} from "@/lib/http/problemDetails";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await validateAuthoritativeSession();
    const listing = await getListingByIdOrSlug(id, session);

    if (!listing) {
      return problemResponse({
        error: "NOT_FOUND",
        title: "Iklan Tidak Ditemukan",
        status: 404,
        detail: "Iklan yang Anda cari tidak ditemukan atau sudah diarsipkan.",
        instance: requestPathname(request),
      });
    }

    return NextResponse.json(listing, { status: 200 });
  } catch (err) {
    return handleRouteError(err, request, "GET /api/listings/[id]");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return problemResponse({
        error: "UNAUTHORIZED",
        title: "Autentikasi Diperlukan",
        status: 401,
        detail: "Silakan login terlebih dahulu untuk mengubah iklan.",
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

    const { id } = await context.params;
    const updated = await updateListing({
      id,
      actor: { id: session.id, role: session.role },
      rawBody,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleRouteError(err, request, "PATCH /api/listings/[id]");
  }
}
