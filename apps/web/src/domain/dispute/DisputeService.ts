// NgeBekasinYuk Dispute Service
// Persisted tri-party dispute mediation with atomic admin resolution.

import { prisma } from "@/server/db/prisma";
import { EscrowLedgerService } from "@/domain/escrow/EscrowLedgerService";
import { buildIdempotencyKey, generateDisputeNumber } from "@/domain/id";

export class DisputeDomainError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DisputeDomainError";
    this.code = code;
  }
}

export interface OpenDisputeParams {
  orderId: string;
  buyerId: string;
  reason: string;
  description: string;
  evidences?: Array<{
    fileUrl: string;
    fileType: string;
    fileSize: number;
    description?: string;
  }>;
}

export interface ResolveDisputeParams {
  disputeId: string;
  adminId: string;
  verdict: "RELEASE_SELLER" | "REFUND_BUYER";
  adminNotes: string;
  stepUpToken?: string;
  customIdempotencyKey?: string;
}

export class DisputeService {
  /**
   * Opens a dispute for an order currently in inspection.
   * Atomically transitions order to DISPUTED and freezes escrow account.
   */
  static async openDispute(params: OpenDisputeParams) {
    const { orderId, buyerId, reason, description, evidences = [] } = params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { escrowAccount: true, dispute: true },
    });

    if (!order) {
      throw new DisputeDomainError("ORDER_NOT_FOUND", "Order tidak ditemukan");
    }

    if (order.buyerId !== buyerId) {
      throw new DisputeDomainError(
        "FORBIDDEN_NOT_BUYER",
        "Hanya pembeli pemilik order yang berhak membuka komplain sengketa"
      );
    }

    if (order.status !== "INSPECTING") {
      throw new DisputeDomainError(
        "INVALID_STATUS",
        `Sengketa hanya dapat diajukan saat status masa uji (INSPECTING). Status saat ini: ${order.status}`
      );
    }

    if (order.inspectionExpiresAt && new Date() > order.inspectionExpiresAt) {
      throw new DisputeDomainError(
        "INSPECTION_EXPIRED",
        "Masa uji 2x24 jam telah berakhir. Sengketa tidak dapat diajukan secara otomatis."
      );
    }

    if (order.dispute) {
      throw new DisputeDomainError(
        "DISPUTE_ALREADY_EXISTS",
        "Sengketa untuk pesanan ini sudah pernah dibuka"
      );
    }

    const disputeNumber = generateDisputeNumber();

    return await prisma.$transaction(async (tx) => {
      // 1. Update Order status to DISPUTED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "DISPUTED",
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "INSPECTING",
          toStatus: "DISPUTED",
          actorId: buyerId,
          actorRole: "BUYER",
          reason: `Pembeli mengajukan sengketa: ${reason}`,
        },
      });

      // 2. Freeze Escrow Account
      if (order.escrowAccount) {
        await tx.escrowAccount.update({
          where: { id: order.escrowAccount.id },
          data: {
            status: "FROZEN_DISPUTE",
          },
        });
      }

      // 3. Create Dispute record with evidences & initial chat message
      const dispute = await tx.dispute.create({
        data: {
          disputeNumber,
          orderId: order.id,
          reason,
          description,
          status: "OPEN",
          evidences: {
            create: evidences.map((e) => ({
              uploadedBy: buyerId,
              uploaderRole: "BUYER",
              fileUrl: e.fileUrl,
              fileType: e.fileType,
              fileSize: e.fileSize,
              description: e.description,
            })),
          },
          messages: {
            create: [
              {
                senderId: buyerId,
                senderName: "Pembeli",
                senderRole: "BUYER",
                message: description,
              },
            ],
          },
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: buyerId,
          action: "DISPUTE_OPENED",
          targetType: "Dispute",
          targetId: dispute.id,
          details: JSON.stringify({
            disputeNumber,
            orderId: order.id,
            reason,
          }),
        },
      });

      return dispute;
    });
  }

  /**
   * Resolves a dispute with an authoritative admin verdict.
   * Atomically executes financial resolution (release or refund) and commits decision.
   */
  static async resolveDispute(params: ResolveDisputeParams) {
    const { disputeId, adminId, verdict, adminNotes, customIdempotencyKey } = params;

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        order: {
          include: {
            escrowAccount: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new DisputeDomainError("DISPUTE_NOT_FOUND", "Sengketa tidak ditemukan");
    }

    if (dispute.status === "RESOLVED_BUYER" || dispute.status === "RESOLVED_SELLER" || dispute.status === "CLOSED") {
      throw new DisputeDomainError(
        "DISPUTE_ALREADY_RESOLVED",
        `Sengketa ini telah diputuskan sebelumnya dengan status: ${dispute.status}`
      );
    }

    const idempotencyKey =
      customIdempotencyKey ||
      buildIdempotencyKey("DISPUTE_VERDICT", dispute.id, verdict);

    const newDisputeStatus =
      verdict === "RELEASE_SELLER" ? "RESOLVED_SELLER" : "RESOLVED_BUYER";

    // 1. Update dispute status and record decision
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: newDisputeStatus,
        verdict,
        adminNotes,
        decidedByAdminId: adminId,
        decidedAt: new Date(),
      },
    });

    // 2. Execute authoritative financial transaction based on verdict
    if (verdict === "RELEASE_SELLER") {
      await EscrowLedgerService.releaseEscrow({
        orderId: dispute.orderId,
        actorId: adminId,
        actorRole: "ADMIN",
        overrideDispute: true,
        customIdempotencyKey: `VERDICT-REL-${idempotencyKey}`,
      });
    } else {
      await EscrowLedgerService.refundEscrow({
        orderId: dispute.orderId,
        actorId: adminId,
        actorRole: "ADMIN",
        reason: `Putusan admin sengketa #${dispute.disputeNumber}: ${adminNotes}`,
        customIdempotencyKey: `VERDICT-REF-${idempotencyKey}`,
      });
    }

    // 3. Append admin security audit log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "ADMIN_VERDICT",
        targetType: "Dispute",
        targetId: dispute.id,
        details: JSON.stringify({
          disputeNumber: dispute.disputeNumber,
          verdict,
          adminNotes,
          idempotencyKey,
        }),
      },
    });

    return {
      success: true,
      disputeId: dispute.id,
      disputeNumber: dispute.disputeNumber,
      verdict,
      status: newDisputeStatus,
      idempotencyKey,
    };
  }
}
