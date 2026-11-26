import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { relistListing } from "@/domain/listing/listingService";
import {
  handleRouteError,
  problemResponse,
  requestPathname,
} from "@/lib/http/problemDetails";

export async function POST(
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
        detail: "Silakan login terlebih dahulu untuk menayangkan ulang iklan.",
        instance: requestPathname(request),
      });
    }

    const { id } = await context.params;
    const relisted = await relistListing({
      id,
      actor: { id: session.id, role: session.role },
    });

    return NextResponse.json(relisted, { status: 200 });
  } catch (err) {
    return handleRouteError(err, request, "POST /api/listings/[id]/relist");
  }
}
