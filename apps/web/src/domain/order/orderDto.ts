// Unified Order DTO Mapper
// Shared between GET /api/orders/[id] and POST /api/orders (Ladder Rung 2)

import type { Prisma } from "@prisma/client";

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    buyer: true;
    seller: true;
    listing: {
      include: {
        seller: true;
      };
    };
    paymentAttempts?: true;
  };
}>;

export function mapOrderToDto(order: OrderWithRelations) {
  const latestPayment = order.paymentAttempts && order.paymentAttempts.length > 0
    ? order.paymentAttempts[0]
    : null;

  return {
    ...order,
    buyerName: order.buyer?.name || "Pembeli",
    buyerPhone: order.buyer?.phone || "081234567890",
    courier: order.shippingCourier || "SiCepat",
    trackingNumber: order.shippingAirwayBill || "",
    paymentMethod: latestPayment?.paymentMethod || "BCA_VA",
    vaNumber: latestPayment?.vaNumber || "8077098765432101",
    qrString: latestPayment?.qrString || undefined,
    paymentAttemptId: latestPayment?.id,
    reviewGiven: false,
  };
}
