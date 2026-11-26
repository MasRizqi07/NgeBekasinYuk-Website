import { NextResponse } from "next/server";
import {
  pollConversationMessages,
  sendMessage,
} from "@/domain/chat/chatService";
import {
  parseJsonBody,
  requireChatViewer,
} from "@/domain/chat/chatRouteHelpers";
import { handleRouteError } from "@/lib/http/problemDetails";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerOrResponse = await requireChatViewer(request);
    if (viewerOrResponse instanceof NextResponse) {
      return viewerOrResponse;
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const result = await pollConversationMessages(viewerOrResponse, id, {
      after: searchParams.get("after") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(
      err,
      request,
      "GET /api/conversations/[id]/messages"
    );
  }
}

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
    const result = await sendMessage(viewerOrResponse, id, bodyOrResponse);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(
      err,
      request,
      "POST /api/conversations/[id]/messages"
    );
  }
}
