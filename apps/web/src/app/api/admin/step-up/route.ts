import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { prisma } from "@/server/db/prisma";
import { AuditLogger } from "@/domain/audit/AuditLogger";
import {
  verifyTotpCode,
  createStepUpGrant,
  DEV_ADMIN_TOTP_SEED,
} from "@/lib/auth/totp";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

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
    const { code, action = "DISPUTE_VERDICT" } = body;

    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "INVALID_FORMAT", message: "Kode TOTP harus berupa 6 digit angka." },
        { status: 400 }
      );
    }

    // Retrieve admin's configured TOTP secret
    const adminUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true },
    });

    if (!adminUser) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
    }

    // Determine TOTP secret: from DB or dev fixture if not in production
    // (In schema migration we will have totpSecret on User)
    const secret =
      (adminUser as { totpSecret?: string | null }).totpSecret ||
      (env.NODE_ENV !== "production" ? DEV_ADMIN_TOTP_SEED : null);

    if (!secret) {
      return NextResponse.json(
        {
          error: "TOTP_NOT_ENROLLED",
          message: "Akun Administrator belum mengaktifkan 2FA TOTP. Hubungi security administrator.",
        },
        { status: 400 }
      );
    }

    const verification = verifyTotpCode({
      secret,
      code,
      adminId: session.id,
    });

    if (!verification.valid) {
      const reason =
        verification.error === "REPLAY_ATTEMPT"
          ? "Replay attempt detected (OTP code already used)"
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

    // Create signed short-lived step-up grant token
    const grantToken = await createStepUpGrant(session.id, action);

    await AuditLogger.log({
      userId: session.id,
      action: "ADMIN_STEP_UP",
      targetType: "User",
      targetId: session.id,
      details: { result: "SUCCESS", action, grantExpiresInSeconds: env.ADMIN_STEP_UP_TTL_SECONDS },
    });

    return NextResponse.json({
      success: true,
      grantToken,
      expiresIn: env.ADMIN_STEP_UP_TTL_SECONDS,
    });
  } catch (error) {
    console.error("[Admin/StepUp] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal memproses otorisasi 2FA." },
      { status: 500 }
    );
  }
}
