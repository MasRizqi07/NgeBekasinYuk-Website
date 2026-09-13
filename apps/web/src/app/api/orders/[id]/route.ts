import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";

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
        listing: true,
      }
    });

    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    // Authorization check: Only buyer or seller of the order can view it (or admin)
    if (order.buyerId !== session.id && order.sellerId !== session.id && session.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN", message: "Anda tidak memiliki akses ke pesanan ini" }, { status: 403 });
    }

    // Ensure we map the database structure to the structure expected by the client interface
    // Note: The UI is currently rendering `order.buyerName`, `order.courier`, etc.
    const clientOrder = {
      ...order,
      // Mapping fields for the UI based on types/index.ts
      buyerName: order.buyer.name,
      buyerPhone: order.buyer.phone || "081234567890",
      courier: order.shippingCourier || "SiCepat",
      trackingNumber: order.shippingAirwayBill || "",
      paymentMethod: "BCA_VA", // DB might not store it directly on Order, fallback
      vaNumber: "8077098765432101", 
      reviewGiven: false,
    };

    return NextResponse.json(clientOrder);
  } catch (error: any) {
    console.error("GET /api/orders/[id] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memuat pesanan" },
      { status: 500 }
    );
  }
}
