import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { AdminVerdictSchema } from "@/lib/validations";
import { DisputeService, DisputeDomainError } from "@/domain/dispute/DisputeService";
import { AuditLogger } from "@/domain/audit/AuditLogger";
import {
  consumeStepUpGrant,
  verifyAndRecordTotpCode,
  getAdminDecryptedTotpSecret,
} from "@/lib/auth/totp";
import { prisma } from "@/server/db/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authoritative session validation against PostgreSQL (HP3-P0-01)
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." }, { status: 401 });
    }

    // Role check: Only active ADMIN in database can resolve disputes
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

    // 2. Authoritative Step-Up Verification & One-Time Grant Consumption (HP3-P0-04, HP3-P0-02)
    let isAuthorized = false;
    let authFailureReason = "Invalid or expired authorization";

    if (stepUpCode.includes(".")) {
      // Consume single-use step-up grant token in PostgreSQL
      const grantResult = await consumeStepUpGrant({
        grantToken: stepUpCode,
        expectedAdminId: session.id,
        expectedAction: "DISPUTE_VERDICT",
        expectedResourceId: disputeId,
      });

      if (grantResult.valid) {
        isAuthorized = true;
      } else {
        authFailureReason = grantResult.reason || "Step-up grant invalid or already consumed";
      }
    } else if (/^\d{6}$/.test(stepUpCode)) {
      // Validate rotating 6-digit TOTP code directly with persistent distributed replay protection
      const adminUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: {
          id: true,
          totpSecret: true,
          totpSecretCiphertext: true,
          totpSecretIv: true,
          totpSecretTag: true,
          isTotpEnrolled: true,
        },
      });

      const secret = adminUser ? getAdminDecryptedTotpSecret(adminUser) : null;

      if (secret) {
        const totpCheck = await verifyAndRecordTotpCode({
          adminId: session.id,
          secret,
          code: stepUpCode,
        });

        if (totpCheck.valid) {
          isAuthorized = true;
        } else {
          authFailureReason =
            totpCheck.error === "REPLAY_ATTEMPT"
              ? "Kode TOTP sudah pernah digunakan (replay)"
              : "Kode TOTP salah atau kedaluwarsa";
        }
      }
    }

    if (!isAuthorized) {
      await AuditLogger.log({
        userId: session.id,
        action: "ADMIN_STEP_UP",
        targetType: "Dispute",
        targetId: disputeId,
        details: { result: "FAILED", reason: authFailureReason, attemptedCode: "[REDACTED]" },
      });
      return NextResponse.json(
        {
          error: "INVALID_STEP_UP_CODE",
          message: `Otorisasi 2FA gagal: ${authFailureReason}.`,
        },
        { status: 401 }
      );
    }

    // 3. Atomically execute dispute resolution
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
        { status: 400 }
      );
    }

    console.error("[Dispute/Verdict] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memproses putusan sengketa." },
      { status: 500 }
    );
  }
}
