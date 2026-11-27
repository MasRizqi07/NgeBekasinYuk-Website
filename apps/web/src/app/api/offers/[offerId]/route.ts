import { NextResponse } from "next/server";
import { requireChatViewer } from "@/domain/chat/chatRouteHelpers";
import { getBuyerOfferForCheckout } from "@/domain/chat/offerService";
import { handleRouteError } from "@/lib/http/problemDetails";

export async function GET(
  request: Request,
  context: { params: Promise<{ offerId: string }> }
) {
  try {
    const viewerOrResponse = await requireChatViewer(request);
    if (viewerOrResponse instanceof NextResponse) {
      return viewerOrResponse;
    }

    const { offerId } = await context.params;
    const result = await getBuyerOfferForCheckout(viewerOrResponse, offerId);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleRouteError(err, request, "GET /api/offers/[offerId]");
  }
}
