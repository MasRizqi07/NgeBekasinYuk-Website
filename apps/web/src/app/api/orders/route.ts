import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { CreateOrderSchema } from "@/lib/validations";
import { calculateShippingFee } from "@/domain/shipping/shippingService";
import { calculateEscrowBreakdown } from "@/domain/money";
import { generateInternalId, generateOrderNumber } from "@/domain/id";
import { defaultPaymentProvider } from "@/domain/payment/PaymentProvider";
import { mapOrderToDto, orderSelectFields } from "@/domain/order/orderDto";
import {
  LISTING_STATUS,
  TERMINAL_ORDER_STATUSES,
  isPendingOrderExpired,
} from "@/domain/listing/listingStatus";

export async function POST(request: Request) {
  try {
    // 1. Authoritative Session Validation
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // 2. Enforce Required Idempotency-Key Header
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      return NextResponse.json(
        {
          error: "IDEMPOTENCY_KEY_REQUIRED",
          message: "Header Idempotency-Key wajib disertakan untuk pembuatan pesanan.",
        },
        { status: 400 }
      );
    }

    // 3. Fast-path check: Check for existing completed operation under this idempotency key
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existingKey && new Date() < existingKey.expiresAt) {
      let orderId = existingKey.resourceId;
      if (!orderId) {
        try {
          const parsed = JSON.parse(existingKey.result);
          orderId = parsed.orderId || parsed.id;
        } catch {
          // ignore corrupted JSON
        }
      }

      if (orderId) {
        const replayedOrder = await prisma.order.findUnique({
          where: { id: orderId },
          select: orderSelectFields,
        });

        if (replayedOrder) {
          if (replayedOrder.buyerId === session.id || session.role === "ADMIN") {
            return NextResponse.json(mapOrderToDto(replayedOrder, session), { status: 201 });
          }
          return NextResponse.json(
            { error: "FORBIDDEN", message: "Anda tidak memiliki akses ke pesanan ini." },
            { status: 403 }
          );
        }
      }
    }

    // 4. Strict Body Validation (Rejects any untrusted/client-tampered pricing or status fields)
    const rawBody = await request.json().catch(() => ({}));
    const validated = CreateOrderSchema.safeParse(rawBody);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Data pesanan tidak valid atau terdapat atribut terlarang.",
          details: validated.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { listingId, shippingAddress, courier, paymentMethod, offerId } = validated.data;

    // 5. Load and Validate Listing from Postgres
    const listing = await prisma.productListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "LISTING_NOT_FOUND", message: "Barang tidak ditemukan." },
        { status: 404 }
      );
    }

    // 6. Anti-Self-Dealing: Seller cannot buy own listing
    if (listing.sellerId === session.id) {
      return NextResponse.json(
        {
          error: "CANNOT_BUY_OWN_LISTING",
          message: "Anda tidak dapat membeli barang dagangan milik sendiri.",
        },
        { status: 403 }
      );
    }

    // 7. Price Determination & Offer Support Check (DECISION D1)
    let itemPrice = listing.price;
    if (offerId) {
      const offer = await prisma.priceOffer.findUnique({
        where: { id: offerId },
        include: { conversation: true },
      });

      if (
        !offer ||
        offer.status !== "ACCEPTED" ||
        offer.conversation.buyerId !== session.id ||
        offer.conversation.listingId !== listing.id ||
        new Date() > offer.expiresAt
      ) {
        return NextResponse.json(
          {
            error: "OFFER_NOT_SUPPORTED",
            message: "Penawaran harga tidak valid atau belum didukung di server.",
          },
          { status: 422 }
        );
      }
      itemPrice = offer.offerPrice;
    }

    // 8. Server-Authoritative Fee Calculation
    const shippingFee = calculateShippingFee(courier);
    const breakdown = calculateEscrowBreakdown(itemPrice, shippingFee, 0);
    const escrowFee = breakdown.escrowFee;
    const totalAmount = breakdown.totalBuyerPays;

    const orderId = generateInternalId("ord");
    const orderNumber = generateOrderNumber();

    // 9. Atomic Postgres Transaction
    try {
      const createdDto = await prisma.$transaction(async (tx) => {
        // Atomic Listing Reservation (Task 7.1 / I1 Concurrency Defense)
        // 1. Normal path: Attempt atomic reservation on ACTIVE listing
        const reserveAttempt = await tx.productListing.updateMany({
          where: {
            id: listing.id,
            status: LISTING_STATUS.ACTIVE,
          },
          data: {
            status: LISTING_STATUS.RESERVED,
          },
        });

        if (reserveAttempt.count !== 1) {
          // 2. Expiry recovery path: Check if listing is RESERVED by a stale expired unpaid order
          const blockingOrder = await tx.order.findFirst({
            where: {
              listingId: listing.id,
              status: { notIn: [...TERMINAL_ORDER_STATUSES] },
            },
            include: {
              paymentAttempts: {
                where: { status: "PENDING" },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          });

          if (!blockingOrder || !isPendingOrderExpired(blockingOrder)) {
            throw new Error("LISTING_NOT_ACTIVE");
          }

          // Compare-and-set cancel on stale order
          const cancelResult = await tx.order.updateMany({
            where: {
              id: blockingOrder.id,
              status: "PENDING_PAYMENT",
            },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
            },
          });

          if (cancelResult.count !== 1) {
            throw new Error("LISTING_NOT_ACTIVE");
          }

          // Record status history strictly when CAS wins
          await tx.orderStatusHistory.create({
            data: {
              orderId: blockingOrder.id,
              fromStatus: "PENDING_PAYMENT",
              toStatus: "CANCELLED",
              actorId: "SYSTEM",
              actorRole: "SYSTEM",
              reason: "Batas waktu pembayaran pesanan telah kadaluwarsa (lazy expiry).",
            },
          });

          // Mark stale pending payment attempts as EXPIRED
          await tx.paymentAttempt.updateMany({
            where: {
              orderId: blockingOrder.id,
              status: "PENDING",
            },
            data: {
              status: "EXPIRED",
            },
          });

          // Listing remains RESERVED and passes directly to new order without ACTIVE flicker
        }

        // a. Create Order in PENDING_PAYMENT state
        const newOrder = await tx.order.create({
          data: {
            id: orderId,
            orderNumber,
            buyerId: session.id,
            sellerId: listing.sellerId,
            listingId: listing.id,
            itemPrice,
            shippingFee,
            escrowFee,
            totalAmount,
            status: "PENDING_PAYMENT",
            shippingCourier: courier,
            shippingAddress,
          },
        });

        // b. Record Initial Order State History
        await tx.orderStatusHistory.create({
          data: {
            orderId: newOrder.id,
            fromStatus: "NONE",
            toStatus: "PENDING_PAYMENT",
            actorId: session.id,
            actorRole: session.role || "BUYER",
            reason: "Pesanan dibuat oleh pembeli, menunggu pembayaran",
          },
        });

        // c. Create Initial Payment Attempt via defaultPaymentProvider
        await defaultPaymentProvider.createPayment(
          {
            orderId: newOrder.id,
            amount: totalAmount,
            paymentMethod,
          },
          tx
        );

        // d. Immutable Audit Log Entry
        await tx.auditLog.create({
          data: {
            userId: session.id,
            action: "ORDER_CREATED",
            targetType: "Order",
            targetId: newOrder.id,
            details: JSON.stringify({
              orderNumber: newOrder.orderNumber,
              totalAmount,
              itemPrice,
              shippingFee,
              courier,
              paymentMethod,
            }),
          },
        });

        // e. Fetch Order with allow-list relations for response DTO
        const completeOrder = await tx.order.findUniqueOrThrow({
          where: { id: newOrder.id },
          select: orderSelectFields,
        });

        const dto = mapOrderToDto(completeOrder, session);

        // f. Save Idempotency Key record (Task 3.6.2: store minimal reference without credentials)
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            resource: "Order",
            resourceId: newOrder.id,
            action: "CREATE_ORDER",
            result: JSON.stringify({ orderId: newOrder.id }),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
          },
        });

        return dto;
      });

      return NextResponse.json(createdDto, { status: 201 });
    } catch (txError: unknown) {
      // Concurrency collision handler: if concurrent transaction saved idempotency key first
      if (
        txError &&
        typeof txError === "object" &&
        "code" in txError &&
        txError.code === "P2002"
      ) {
        const replayKey = await prisma.idempotencyKey.findUnique({
          where: { key: idempotencyKey },
        });
        if (replayKey) {
          let orderId = replayKey.resourceId;
          if (!orderId) {
            try {
              const parsed = JSON.parse(replayKey.result);
              orderId = parsed.orderId || parsed.id;
            } catch {
              // ignore
            }
          }
          if (orderId) {
            const replayedOrder = await prisma.order.findUnique({
              where: { id: orderId },
              select: orderSelectFields,
            });
            if (replayedOrder) {
              return NextResponse.json(mapOrderToDto(replayedOrder, session), { status: 201 });
            }
          }
        }

        // Database-level uniqueness collision (e.g. D8 partial unique index on Order.listingId)
        return NextResponse.json(
          {
            error: "LISTING_NOT_ACTIVE",
            message: "Barang sudah tidak aktif atau sedang dalam transaksi lain.",
          },
          { status: 422 }
        );
      }
      throw txError;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "LISTING_NOT_ACTIVE" || error.message === "LISTING_ALREADY_RESERVED")
    ) {
      return NextResponse.json(
        {
          error: "LISTING_NOT_ACTIVE",
          message: "Barang sudah tidak aktif atau sedang dalam transaksi lain.",
        },
        { status: 422 }
      );
    }

    console.error("POST /api/orders Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal membuat pesanan." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    // Scope to user's orders (buyer or seller), unless admin
    const whereClause: Record<string, unknown> =
      session.role === "ADMIN"
        ? {}
        : {
            OR: [
              { buyerId: session.id },
              { sellerId: session.id },
            ],
          };

    if (status && status !== "ALL") {
      if (status === "SHIPPED") {
        whereClause.status = { in: ["FUNDED", "SHIPPED"] };
      } else {
        whereClause.status = status;
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        select: orderSelectFields,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    const mappedOrders = orders.map((order) => mapOrderToDto(order, session));

    return NextResponse.json({
      orders: mappedOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/orders Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memuat daftar pesanan." },
      { status: 500 }
    );
  }
}

