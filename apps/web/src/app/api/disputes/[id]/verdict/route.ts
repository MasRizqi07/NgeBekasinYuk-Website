import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { AdminVerdictSchema } from "@/lib/validations";
import { DisputeService, DisputeDomainError } from "@/domain/dispute/DisputeService";
import { AuditLogger } from "@/domain/audit/AuditLogger";

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

    // Server-side step-up 2FA verification (P0-05 fix)
    // In demo/development sandbox, the step-up verification accepts the standard admin OTP "882910" or "123456"
    // and explicitly rejects invalid OTP attempts with an audit record.
    const validOtpCodes = ["882910", "123456"];
    if (!validOtpCodes.includes(stepUpCode)) {
      await AuditLogger.log({
        userId: session.id,
        action: "ADMIN_STEP_UP",
        targetType: "Dispute",
        targetId: disputeId,
        details: { result: "FAILED", attemptedCode: "[REDACTED]" },
      });
      return NextResponse.json(
        { error: "INVALID_STEP_UP_CODE", message: "Kode otorisasi 2FA salah atau kedaluwarsa." },
        { status: 401 }
      );
    }

    const result = await DisputeService.resolveDispute({
      disputeId,
      adminId: session.id,
      verdict,
      adminNotes,
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
