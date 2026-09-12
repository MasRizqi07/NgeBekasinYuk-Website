import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { AdminVerdictSchema } from "@/lib/validations";
import { DisputeService, DisputeDomainError } from "@/domain/dispute/DisputeService";
import { AuditLogger } from "@/domain/audit/AuditLogger";
import { verifyTotpCode, verifyStepUpGrant, DEV_ADMIN_TOTP_SEED } from "@/lib/auth/totp";
import { prisma } from "@/server/db/prisma";
import { env } from "@/lib/env";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." }, { status: 401 });
    }

    // Role check: Only ADMIN can resolve disputes
    if (session.role !== "ADMIN") {
      await AuditLogger.log({
        userId: session.id,
        action: "ADMIN_VERDICT",
        targetType: "Dispute",
        targetId: (await context.params).id,
        details: { blocked: true, reason: "Non-admin attempted verdict execution" },
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Hanya Administrator resmi yang berhak memutuskan sengketa." },
        { status: 403 }
      );
    }

    const { id: disputeId } = await context.params;
    const body = await request.json();
    const validated = AdminVerdictSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { verdict, adminNotes, stepUpCode } = validated.data;

    // Genuine RFC 6238 TOTP or Step-Up Grant verification (HP2-P0-03)
    let isAuthorized = false;

    if (stepUpCode.includes(".")) {
      // 1. Validate signed short-lived step-up grant token
      const grantResult = await verifyStepUpGrant(stepUpCode, session.id, "DISPUTE_VERDICT");
      if (grantResult.valid) {
        isAuthorized = true;
      }
    } else if (/^\d{6}$/.test(stepUpCode)) {
      // 2. Validate rotating 6-digit TOTP code
      const adminUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, totpSecret: true, isTotpEnrolled: true },
      });

      const secret =
        adminUser?.totpSecret ||
        (env.NODE_ENV !== "production" ? DEV_ADMIN_TOTP_SEED : null);

      if (secret) {
        const totpCheck = verifyTotpCode({
          secret,
          code: stepUpCode,
          adminId: session.id,
        });
        if (totpCheck.valid) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      await AuditLogger.log({
        userId: session.id,
        action: "ADMIN_STEP_UP",
        targetType: "Dispute",
        targetId: disputeId,
        details: { result: "FAILED", reason: "Invalid, expired, or replayed TOTP authorization", attemptedCode: "[REDACTED]" },
      });
      return NextResponse.json(
        { error: "INVALID_STEP_UP_CODE", message: "Kode otorisasi 2FA salah, telah digunakan (replay), atau kedaluwarsa." },
        { status: 401 }
      );
    }

    const result = await DisputeService.resolveDispute({
      disputeId,
      adminId: session.id,
      verdict,
      adminNotes,
    });

    await AuditLogger.log({
      userId: session.id,
      action: "ADMIN_VERDICT",
      targetType: "Dispute",
      targetId: disputeId,
      details: { verdict, result: "SUCCESS" },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DisputeDomainError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 422 }
      );
    }

    console.error("[Dispute/Verdict] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal mengeksekusi putusan sengketa." },
      { status: 500 }
    );
  }
}
