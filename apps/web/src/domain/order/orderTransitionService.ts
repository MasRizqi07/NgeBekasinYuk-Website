import { prisma } from "@/server/db/prisma";
import type { OrderStatus, ActorRole } from "@/domain/order/OrderStateMachine";
import { LISTING_STATUS } from "@/domain/listing/listingStatus";

export interface ExecuteOrderTransitionParams {
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  actor: {
    id: string;
    role: ActorRole;
    name: string;
  };
  shippingCourier?: string | null;
  shippingAirwayBill?: string | null;
  reason?: string;
  listingId?: string;
  deliveredAt?: Date | null;
  inspectionStartedAt?: Date | null;
  inspectionExpiresAt?: Date | null;
}

export async function executeOrderTransition(params: ExecuteOrderTransitionParams) {
  const {
    orderId,
    fromStatus,
    toStatus,
    actor,
    shippingCourier,
    shippingAirwayBill,
    reason,
    listingId,
    deliveredAt,
    inspectionStartedAt,
    inspectionExpiresAt,
  } = params;

  return await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      status: toStatus,
    };

    if (toStatus === "SHIPPED") {
      updateData.shippedAt = new Date();
      if (shippingCourier) updateData.shippingCourier = shippingCourier;
      if (shippingAirwayBill) updateData.shippingAirwayBill = shippingAirwayBill;
    } else if (toStatus === "DELIVERED" || toStatus === "INSPECTING") {
      updateData.deliveredAt = deliveredAt || new Date();
      updateData.inspectionStartedAt = inspectionStartedAt || new Date();
      if (!inspectionExpiresAt) {
        updateData.inspectionExpiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      } else {
        updateData.inspectionExpiresAt = inspectionExpiresAt;
      }
    }

    const updateResult = await tx.order.updateMany({
      where: { id: orderId, status: fromStatus },
      data: updateData,
    });

    if (updateResult.count !== 1) {
      return null;
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        actorId: actor.id,
        actorRole: actor.role,
        reason: reason || `Status diubah menjadi ${toStatus} oleh ${actor.name}`,
      },
    });

    if (toStatus === "CANCELLED" && listingId) {
      await tx.productListing.update({
        where: { id: listingId },
        data: { status: LISTING_STATUS.ACTIVE },
      });
    }

    return await tx.order.findUnique({
      where: { id: orderId },
    });
  });
}
