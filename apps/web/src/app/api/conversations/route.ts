import { NextResponse } from "next/server";
import {
  createOrGetConversation,
  listConversations,
} from "@/domain/chat/chatService";
import {
  parseJsonBody,
  requireChatViewer,
} from "@/domain/chat/chatRouteHelpers";
import { handleRouteError } from "@/lib/http/problemDetails";

export async function GET(request: Request) {
  try {
    const viewerOrResponse = await requireChatViewer(request);
    if (viewerOrResponse instanceof NextResponse) {
      return viewerOrResponse;
    }

    const { searchParams } = new URL(request.url);
    const result = await listConversations(viewerOrResponse, {
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(err, request, "GET /api/conversations");
  }
}

export async function POST(request: Request) {
  try {
    const viewerOrResponse = await requireChatViewer(request);
    if (viewerOrResponse instanceof NextResponse) {
      return viewerOrResponse;
    }

    const bodyOrResponse = await parseJsonBody(request);
    if (bodyOrResponse instanceof NextResponse) {
      return bodyOrResponse;
    }

    const result = await createOrGetConversation(
      viewerOrResponse,
      bodyOrResponse
    );

    return NextResponse.json(result.conversation, {
      status: result.created ? 201 : 200,
    });
  } catch (err) {
    return handleRouteError(err, request, "POST /api/conversations");
  }
}
