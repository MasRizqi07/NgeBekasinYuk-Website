import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { prisma } from "@/server/db/prisma";
import { AuditLogger } from "@/domain/audit/AuditLogger";
import {
  verifyAndRecordTotpCode,
  createStepUpGrant,
  getAdminDecryptedTotpSecret,
} from "@/lib/auth/totp";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  try {
    // 1. Authoritative session validation against PostgreSQL (HP3-P0-01)
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // Role check: must be active ADMIN in the database
    if (session.role !== "ADMIN") {
      await AuditLogger.log({
        userId: session.id,
        action: "ADMIN_STEP_UP",
        targetType: "User",
        targetId: session.id,
        details: { blocked: true, reason: "Non-admin attempted TOTP step-up" },
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Akses hanya untuk Administrator." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code, action = "DISPUTE_VERDICT", resourceId } = body;

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "INVALID_FORMAT", message: "Kode TOTP harus berupa 6 digit angka." },
        { status: 400 }
      );
    }

    // Sensitive actions strictly require an explicit, non-empty resourceId (AP4-P0-03)
    if (
      action === "DISPUTE_VERDICT" &&
      (!resourceId || typeof resourceId !== "string" || !resourceId.trim())
    ) {
      return NextResponse.json(
        {
          error: "RESOURCE_ID_REQUIRED",
          message: "resourceId (disputeId) wajib disertakan untuk otorisasi DISPUTE_VERDICT.",
        },
        { status: 400 }
      );
    }

    // Retrieve admin's configured TOTP encrypted envelope (HP3-P0-03, AP4-P0-01)
    const adminUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        totpSecretCiphertext: true,
        totpSecretIv: true,
        totpSecretTag: true,
        totpSecretKeyVersion: true,
        isTotpEnrolled: true,
      },
    });

    if (!adminUser) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const secret = getAdminDecryptedTotpSecret(adminUser);

    if (!secret) {
      return NextResponse.json(
        {
          error: "TOTP_NOT_ENROLLED",
          message: "Akun Administrator belum mengaktifkan 2FA TOTP. Hubungi security administrator.",
        },
        { status: 400 }
      );
    }

    // 2. Distributed, PostgreSQL-backed TOTP verification with replay prevention (HP3-P0-02)
    const verification = await verifyAndRecordTotpCode({
      adminId: session.id,
      secret,
      code,
    });

    if (!verification.valid) {
      const reason =
        verification.error === "REPLAY_ATTEMPT"
          ? "Replay attempt detected (OTP code already used in this time window)"
          : "Invalid OTP code";

      await AuditLogger.log({
        userId: session.id,
        action: "ADMIN_STEP_UP",
        targetType: "User",
        targetId: session.id,
        details: { result: "FAILED", reason, attemptedCode: "[REDACTED]" },
      });

      return NextResponse.json(
        {
          error: verification.error || "INVALID_TOTP_CODE",
          message:
            verification.error === "REPLAY_ATTEMPT"
              ? "Kode OTP sudah pernah digunakan. Harap tunggu kode baru (30 detik)."
              : "Kode TOTP salah atau telah kedaluwarsa.",
        },
        { status: 401 }
      );
    }

    // 3. Create persistent, single-use step-up grant in PostgreSQL (HP3-P0-04, AP4-P0-03)
    const cleanResourceId = resourceId && typeof resourceId === "string" ? resourceId.trim() : null;
    const grantToken = await createStepUpGrant(session.id, action, cleanResourceId);

    await AuditLogger.log({
      userId: session.id,
      action: "ADMIN_STEP_UP",
      targetType: "User",
      targetId: session.id,
      details: {
        result: "SUCCESS",
        action,
        resourceId: cleanResourceId,
        grantExpiresInSeconds: env.ADMIN_STEP_UP_TTL_SECONDS,
      },
    });

    return NextResponse.json({
      success: true,
      grantToken,
      expiresIn: env.ADMIN_STEP_UP_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[Admin/StepUp] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Terjadi kesalahan internal pada verifikasi step-up." },
      { status: 500 }
    );
  }
}
