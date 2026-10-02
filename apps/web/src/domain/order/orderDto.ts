// Unified Order DTO Mapper & Allow-List Selection
// Field-by-field mapping to prevent credential or internal field leakage (Task 3.6.2)

import type { Prisma } from "@prisma/client";

export const orderSelectFields = {
  id: true,
  orderNumber: true,
  buyerId: true,
  sellerId: true,
  listingId: true,
  itemPrice: true,
  shippingFee: true,
  escrowFee: true,
  totalAmount: true,
  status: true,
  shippingCourier: true,
  shippingService: true,
  shippingAirwayBill: true,
  shippingAddress: true,
  paidAt: true,
  shippedAt: true,
  deliveredAt: true,
  inspectionStartedAt: true,
  inspectionExpiresAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  buyer: {
    select: {
      id: true,
      name: true,
      avatar: true,
      isVerified: true,
      phone: true,
    },
  },
  seller: {
    select: {
      id: true,
      name: true,
      avatar: true,
      isVerified: true,
    },
  },
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      price: true,
      originalPrice: true,
      category: true,
      categoryLabel: true,
      brand: true,
      model: true,
      condition: true,
      canNego: true,
      minNegoPrice: true,
      status: true,
      sellerId: true,
      viewsCount: true,
      favoritesCount: true,
      seller: {
        select: {
          id: true,
          name: true,
          avatar: true,
          isVerified: true,
        },
      },
      images: {
        select: {
          id: true,
          url: true,
          isPrimary: true,
          sortOrder: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  },
  paymentAttempts: {
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const satisfies Prisma.OrderSelect;

export type OrderWithAllowedRelations = Prisma.OrderGetPayload<{
  select: typeof orderSelectFields;
}>;

export function mapOrderToDto(order: OrderWithAllowedRelations) {
  const latestPayment =
    order.paymentAttempts && order.paymentAttempts.length > 0
      ? order.paymentAttempts[0]
      : null;

  const rawImages = order.listing?.images;
  const mappedImages: string[] = Array.isArray(rawImages)
    ? rawImages.map((img) => (typeof img === "string" ? img : img.url))
    : [];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    listingId: order.listingId,
    itemPrice: order.itemPrice,
    shippingFee: order.shippingFee,
    escrowFee: order.escrowFee,
    totalAmount: order.totalAmount,
    status: order.status,
    shippingCourier: order.shippingCourier,
    shippingService: order.shippingService,
    shippingAirwayBill: order.shippingAirwayBill,
    shippingAddress: order.shippingAddress,
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    inspectionStartedAt: order.inspectionStartedAt?.toISOString() ?? null,
    inspectionExpiresAt: order.inspectionExpiresAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : String(order.updatedAt),

    buyerName: order.buyer?.name || "Pembeli",
    buyerPhone: order.buyer?.phone || "081234567890",
    courier: order.shippingCourier || "SiCepat",
    trackingNumber: order.shippingAirwayBill || "",
    paymentMethod: latestPayment?.paymentMethod || "BCA_VA",
    vaNumber: latestPayment?.vaNumber || "",
    qrString: latestPayment?.qrString || undefined,
    paymentAttemptId: latestPayment?.id,
    reviewGiven: false,

    buyer: order.buyer
      ? {
          id: order.buyer.id,
          name: order.buyer.name,
          avatar: order.buyer.avatar,
          isVerified: order.buyer.isVerified,
          phone: order.buyer.phone,
        }
      : undefined,

    seller: order.seller
      ? {
          id: order.seller.id,
          name: order.seller.name,
          avatar: order.seller.avatar,
          isVerified: order.seller.isVerified,
        }
      : undefined,

    listing: order.listing
      ? {
          id: order.listing.id,
          slug: order.listing.slug,
          title: order.listing.title,
          description: order.listing.description,
          price: order.listing.price,
          originalPrice: order.listing.originalPrice,
          category: order.listing.category,
          categoryLabel: order.listing.categoryLabel,
          brand: order.listing.brand,
          model: order.listing.model,
          condition: order.listing.condition,
          canNego: order.listing.canNego,
          minNegoPrice: order.listing.minNegoPrice,
          status: order.listing.status,
          sellerId: order.listing.sellerId,
          viewsCount: order.listing.viewsCount,
          favoritesCount: order.listing.favoritesCount,
          seller: order.listing.seller
            ? {
                id: order.listing.seller.id,
                name: order.listing.seller.name,
                avatar: order.listing.seller.avatar,
                isVerified: order.listing.seller.isVerified,
              }
            : undefined,
          images: mappedImages,
        }
      : undefined,

    paymentAttempts: order.paymentAttempts
      ? order.paymentAttempts.map((pa) => ({
          id: pa.id,
          orderId: pa.orderId,
          paymentMethod: pa.paymentMethod,
          amount: pa.amount,
          status: pa.status,
          vaNumber: pa.vaNumber,
          qrString: pa.qrString,
          expiresAt: pa.expiresAt instanceof Date ? pa.expiresAt.toISOString() : String(pa.expiresAt),
          settledAt: pa.settledAt instanceof Date ? pa.settledAt.toISOString() : pa.settledAt ? String(pa.settledAt) : null,
          providerName: pa.providerName,
          isSimulation: pa.isSimulation,
          idempotencyKey: pa.idempotencyKey,
          createdAt: pa.createdAt instanceof Date ? pa.createdAt.toISOString() : String(pa.createdAt),
          updatedAt: pa.updatedAt instanceof Date ? pa.updatedAt.toISOString() : String(pa.updatedAt),
        }))
      : [],
  };
}
