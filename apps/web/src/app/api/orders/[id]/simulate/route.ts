import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { executeOrderTransition } from "@/domain/order/orderTransitionService";
import { env } from "@/lib/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Production / Demo Guard: 404 in production or when demo providers disabled (D4, HP3-P1-03)
  if (env.APP_ENV === "production" || !env.DEMO_PAYMENT_PROVIDER) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Endpoint tidak ditemukan atau dinonaktifkan di environment ini." },
      { status: 404 }
    );
  }

  try {
    // 2. Authoritative session check
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { id: orderId } = await context.params;

    // 3. Fetch order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: "ORDER_NOT_FOUND", message: "Pesanan tidak ditemukan." },
        { status: 404 }
      );
    }

    // 4. Participant Authorization: Only buyer, seller, or admin can simulate transitions
    if (order.buyerId !== session.id && order.sellerId !== session.id && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Hanya pembeli atau penjual pesanan yang dapat menjalankan simulasi." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || (body.toStatus === "SHIPPED" ? "SIMULATE_SHIPPED" : body.toStatus === "INSPECTING" ? "SIMULATE_DELIVERED" : null);

    if (!action) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Aksi simulasi tidak valid. Gunakan SIMULATE_SHIPPED atau SIMULATE_DELIVERED." },
        { status: 400 }
      );
    }

    if (action === "SIMULATE_SHIPPED") {
      if (order.status !== "FUNDED") {
        return NextResponse.json(
          {
            error: "INVALID_ORDER_TRANSITION",
            message: `Pesanan harus dalam status FUNDED untuk disimulasikan kirim resi. Status saat ini: ${order.status}`,
            fromStatus: order.status,
            toStatus: "SHIPPED",
          },
          { status: 422 }
        );
      }

      const shippingCourier = body.shippingCourier || "JT Express Regular";
      const shippingAirwayBill = body.shippingAirwayBill || `JT${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const updatedOrder = await executeOrderTransition({
        orderId: order.id,
        fromStatus: "FUNDED",
        toStatus: "SHIPPED",
        actor: {
          id: session.id,
          role: "SYSTEM",
          name: `[Demo Simulation] ${session.name}`,
        },
        shippingCourier,
        shippingAirwayBill,
        reason: "Simulasi pengiriman pesanan (Demo Courier)",
        listingId: order.listingId,
      });

      if (!updatedOrder) {
        return NextResponse.json(
          { error: "ORDER_STATE_CHANGED", message: "Status pesanan telah berubah. Silakan muat ulang." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        order: updatedOrder,
      });
    }

    if (action === "SIMULATE_DELIVERED") {
      if (order.status !== "SHIPPED" && order.status !== "DELIVERED") {
        return NextResponse.json(
          {
            error: "INVALID_ORDER_TRANSITION",
            message: `Pesanan harus dalam status SHIPPED untuk disimulasikan paket tiba. Status saat ini: ${order.status}`,
            fromStatus: order.status,
            toStatus: "INSPECTING",
          },
          { status: 422 }
        );
      }

      let currentOrder = order;

      // If in SHIPPED, step 1: transition to DELIVERED
      if (currentOrder.status === "SHIPPED") {
        const deliveredOrder = await executeOrderTransition({
          orderId: currentOrder.id,
          fromStatus: "SHIPPED",
          toStatus: "DELIVERED",
          actor: {
            id: session.id,
            role: "SYSTEM",
            name: `[Demo Simulation] ${session.name}`,
          },
          reason: "Simulasi konfirmasi kurir paket telah tiba (Demo Courier)",
          listingId: currentOrder.listingId,
        });

        if (!deliveredOrder) {
          return NextResponse.json(
            { error: "ORDER_STATE_CHANGED", message: "Status pesanan telah berubah. Silakan muat ulang." },
            { status: 409 }
          );
        }

        currentOrder = deliveredOrder;
      }

      // Step 2: transition DELIVERED -> INSPECTING
      const inspectingOrder = await executeOrderTransition({
        orderId: currentOrder.id,
        fromStatus: "DELIVERED",
        toStatus: "INSPECTING",
        actor: {
          id: session.id,
          role: "SYSTEM",
          name: `[Demo Simulation] ${session.name}`,
        },
        reason: "Simulasi inisiasi periode inspeksi pembeli 2x24 jam (Demo Escrow)",
        listingId: currentOrder.listingId,
        deliveredAt: currentOrder.deliveredAt,
      });

      if (!inspectingOrder) {
        return NextResponse.json(
          { error: "ORDER_STATE_CHANGED", message: "Status pesanan telah berubah. Silakan muat ulang." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        order: inspectingOrder,
      });
    }

    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Aksi tidak dikenali." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Order/Simulate] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Terjadi kesalahan internal pada simulasi pesanan." },
      { status: 500 }
    );
  }
}
