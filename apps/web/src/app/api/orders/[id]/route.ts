import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { mapOrderToDto } from "@/domain/order/orderDto";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." }, { status: 401 });
    }

    const { id: orderId } = await context.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        seller: true,
        listing: {
          include: {
            seller: true,
            images: true,
          }
        },
        paymentAttempts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      }
    });

    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    // Authorization check: Only buyer or seller of the order can view it (or admin)
    if (order.buyerId !== session.id && order.sellerId !== session.id && session.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN", message: "Anda tidak memiliki akses ke pesanan ini" }, { status: 403 });
    }

    return NextResponse.json(mapOrderToDto(order));
  } catch (error) {
    console.error("GET /api/orders/[id] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memuat pesanan" },
      { status: 500 }
    );
  }
}
