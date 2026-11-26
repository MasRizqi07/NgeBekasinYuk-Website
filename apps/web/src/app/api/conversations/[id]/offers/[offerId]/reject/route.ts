import { handleOfferActionRoute } from "@/domain/chat/chatRouteHelpers";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; offerId: string }> }
) {
  return handleOfferActionRoute(request, context, "reject");
}
