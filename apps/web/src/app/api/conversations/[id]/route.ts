import { NextResponse } from "next/server";
import { getConversationDetail } from "@/domain/chat/chatService";
import { requireChatViewer } from "@/domain/chat/chatRouteHelpers";
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
    const convo = await getConversationDetail(viewerOrResponse, id);

    return NextResponse.json(convo, { status: 200 });
  } catch (err) {
    return handleRouteError(err, request, "GET /api/conversations/[id]");
  }
}
