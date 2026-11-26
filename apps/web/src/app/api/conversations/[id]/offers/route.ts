import { NextResponse } from "next/server";
import { createOffer } from "@/domain/chat/offerService";
import {
  parseJsonBody,
  requireChatViewer,
} from "@/domain/chat/chatRouteHelpers";
import { handleRouteError } from "@/lib/http/problemDetails";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerOrResponse = await requireChatViewer(request);
    if (viewerOrResponse instanceof NextResponse) {
      return viewerOrResponse;
    }

    const bodyOrResponse = await parseJsonBody(request);
    if (bodyOrResponse instanceof NextResponse) {
      return bodyOrResponse;
    }

    const { id } = await context.params;
    const result = await createOffer(viewerOrResponse, id, bodyOrResponse);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(
      err,
      request,
      "POST /api/conversations/[id]/offers"
    );
  }
}
