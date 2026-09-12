import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { getServerSession } from "@/lib/auth/session";
import { OrderTransitionSchema } from "@/lib/validations";
import {
  assertTransition,
  OrderStatus,
  OrderStateTransitionError,
} from "@/domain/order/OrderStateMachine";
import { EscrowLedgerService } from "@/domain/escrow/EscrowLedgerService";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." }, { status: 401 });
    }

    const { id: orderId } = await context.params;
    const body = await request.json();
    const validated = OrderTransitionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { toStatus, shippingCourier, shippingAirwayBill, reason } = validated.data;

    // Fetch order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true },
    });

    if (!order) {
      return NextResponse.json({ error: "ORDER_NOT_FOUND", message: "Pesanan tidak ditemukan." }, { status: 404 });
    }

    // Enforce state machine rules
    try {
      assertTransition(order.status as OrderStatus, toStatus as OrderStatus, {
        actorId: session.id,
        actorRole: session.role,
        order: {
          id: order.id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          status: order.status as OrderStatus,
          shippingAirwayBill: order.shippingAirwayBill,
          inspectionExpiresAt: order.inspectionExpiresAt,
        },
      });
    } catch (err) {
      if (err instanceof OrderStateTransitionError) {
        return NextResponse.json(
          { error: err.code, message: err.message, fromStatus: err.fromStatus, toStatus: err.toStatus },
          { status: 422 }
        );
      }
      throw err;
    }

    // If transitioning to COMPLETED, execute authoritative escrow release!
    if (toStatus === "COMPLETED") {
      if (session.role !== "BUYER" && session.role !== "ADMIN") {
        return NextResponse.json(
          { error: "FORBIDDEN", message: "Penjual tidak diizinkan melepaskan dana escrow sendiri." },
          { status: 403 }
        );
      }

      const releaseResult = await EscrowLedgerService.releaseEscrow({
        orderId: order.id,
        actorId: session.id,
        actorRole: session.role,
      });

      return NextResponse.json({
        success: true,
        orderId: order.id,
        status: "COMPLETED",
        escrowReleased: true,
        releaseResult,
      });
    }

    // For other transitions (SHIPPED, PROCESSING, etc.)
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: toStatus,
      };

      if (toStatus === "SHIPPED") {
        updateData.shippedAt = new Date();
        if (shippingCourier) updateData.shippingCourier = shippingCourier;
        if (shippingAirwayBill) updateData.shippingAirwayBill = shippingAirwayBill;
      } else if (toStatus === "DELIVERED") {
        updateData.deliveredAt = new Date();
        updateData.inspectionStartedAt = new Date();
        updateData.inspectionExpiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      }

      const ord = await tx.order.update({
        where: { id: order.id },
        data: updateData,
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus,
          actorId: session.id,
          actorRole: session.role,
          reason: reason || `Status diubah menjadi ${toStatus} oleh ${session.name}`,
        },
      });

      return ord;
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("[Order/Transition] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memproses perubahan status pesanan." },
      { status: 500 }
    );
  }
}
