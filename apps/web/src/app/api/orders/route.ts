import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { CreateOrderSchema } from "@/lib/validations";
import { calculateShippingFee } from "@/domain/shipping/shippingService";
import { calculateEscrowBreakdown } from "@/domain/money";
import { generateInternalId, generateOrderNumber } from "@/domain/id";
import { defaultPaymentProvider } from "@/domain/payment/PaymentProvider";
import { mapOrderToDto } from "@/domain/order/orderDto";

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
      try {
        const cachedResult = JSON.parse(existingKey.result);
        return NextResponse.json(cachedResult, { status: 201 });
      } catch {
        // Corrupted cache fallback: continue processing
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

    if (listing.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "LISTING_NOT_ACTIVE",
          message: "Barang sudah tidak aktif atau sedang dalam transaksi lain.",
        },
        { status: 422 }
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

        // e. Fetch Order with full relations for response DTO
        const completeOrder = await tx.order.findUniqueOrThrow({
          where: { id: newOrder.id },
          include: {
            buyer: true,
            seller: true,
            listing: {
              include: {
                seller: true,
              },
            },
            paymentAttempts: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        const dto = mapOrderToDto(completeOrder);

        // f. Save Idempotency Key record
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            resource: "Order",
            resourceId: newOrder.id,
            action: "CREATE_ORDER",
            result: JSON.stringify(dto),
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
          return NextResponse.json(JSON.parse(replayKey.result), { status: 201 });
        }
      }
      throw txError;
    }
  } catch (error) {
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
        include: {
          buyer: true,
          seller: true,
          listing: {
            include: {
              seller: true,
            },
          },
          paymentAttempts: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    const mappedOrders = orders.map((order) => mapOrderToDto(order));

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

