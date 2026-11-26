import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { respondToOffer } from "@/domain/chat/offerService";
import type { ChatViewer } from "@/domain/chat/chatService";
import {
  handleRouteError,
  problemResponse,
  requestPathname,
} from "@/lib/http/problemDetails";

export async function requireChatViewer(
  request: Request
): Promise<ChatViewer | NextResponse> {
  const session = await validateAuthoritativeSession();
  if (!session) {
    return problemResponse({
      error: "UNAUTHORIZED",
      title: "Autentikasi Diperlukan",
      status: 401,
      detail: "Silakan login terlebih dahulu.",
      instance: requestPathname(request),
    });
  }

  return {
    id: session.id,
    name: session.name,
    role: session.role,
  };
}

export async function parseJsonBody(
  request: Request
): Promise<unknown | NextResponse> {
  try {
    return await request.json();
  } catch {
    return problemResponse({
      error: "INVALID_JSON",
      title: "Payload JSON Tidak Valid",
      status: 400,
      detail: "Body permintaan harus berupa JSON yang valid.",
      instance: requestPathname(request),
    });
  }
}

export async function handleOfferActionRoute(
  request: Request,
  context: { params: Promise<{ id: string; offerId: string }> },
  action: "accept" | "reject" | "counter"
) {
  try {
    const viewerOrResponse = await requireChatViewer(request);
    if (viewerOrResponse instanceof NextResponse) {
      return viewerOrResponse;
    }

    let bodyOrResponse: unknown = undefined;
    if (action === "counter") {
      bodyOrResponse = await parseJsonBody(request);
      if (bodyOrResponse instanceof NextResponse) {
        return bodyOrResponse;
      }
    }

    const { id, offerId } = await context.params;
    const result = await respondToOffer(
      viewerOrResponse,
      id,
      offerId,
      action,
      bodyOrResponse
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(
      err,
      request,
      `POST /api/conversations/[id]/offers/[offerId]/${action}`
    );
  }
}
