import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { prisma } from "@/server/db/prisma";
import { SetWalletPinSchema, isTriviallyWeakPin } from "@/lib/validations";
import bcrypt from "bcryptjs";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export async function GET() {
  const session = await validateAuthoritativeSession();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { hashedPin: true },
  });

  return NextResponse.json({
    hasPin: !!user?.hashedPin,
  });
}

export async function POST(request: Request) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = SetWalletPinSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        hashedPassword: true,
        hashedPin: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    const now = new Date();

    // 1. Lockout protection (Task 4.2)
    if (user.pinLockedUntil && user.pinLockedUntil > now) {
      return NextResponse.json(
        {
          error: "ACCOUNT_LOCKED",
          message: `Akun terkunci sementara karena percobaan gagal berulang kali. Coba lagi setelah ${user.pinLockedUntil.toLocaleTimeString("id-ID")}.`,
        },
        { status: 401 }
      );
    }

    // 2. Re-verify password against hashedPassword with attempt braking
    const passwordMatch = await bcrypt.compare(validated.data.password, user.hashedPassword);
    if (!passwordMatch) {
      const newAttempts = user.pinFailedAttempts + 1;
      const shouldLock = newAttempts >= MAX_ATTEMPTS;
      const lockUntil = shouldLock ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          pinFailedAttempts: newAttempts,
          pinLockedUntil: lockUntil,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: shouldLock ? "PIN_LOCKED" : "PASSWORD_ATTEMPT_FAILED",
          targetType: "User",
          targetId: user.id,
          details: JSON.stringify({
            attemptCount: newAttempts,
            locked: shouldLock,
          }),
        },
      });

      if (shouldLock) {
        return NextResponse.json(
          {
            error: "ACCOUNT_LOCKED",
            message: "Akun telah terkunci selama 15 menit karena 5 kali salah memasukkan password.",
          },
          { status: 401 }
        );
      }

      const remaining = MAX_ATTEMPTS - newAttempts;
      return NextResponse.json(
        {
          error: "INVALID_CREDENTIALS",
          message: `Password tidak sesuai. Sisa kesempatan: ${remaining} kali sebelum akun terkunci.`,
        },
        { status: 401 }
      );
    }

    // 3. Reject weak PINs (422)
    if (isTriviallyWeakPin(validated.data.pin)) {
      return NextResponse.json(
        {
          error: "PIN_TOO_WEAK",
          message: "Kombinasi PIN terlalu mudah ditebak. Hindari angka berurutan atau berulang.",
        },
        { status: 422 }
      );
    }

    // 4. Allowed only when hashedPin is null (409)
    if (user.hashedPin !== null) {
      return NextResponse.json(
        {
          error: "PIN_ALREADY_SET",
          message: "PIN transaksi sudah pernah dibuat.",
        },
        { status: 409 }
      );
    }

    // 5. Hash PIN and persist atomically
    const newHashedPin = await bcrypt.hash(validated.data.pin, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          hashedPin: newHashedPin,
          pinFailedAttempts: 0,
          pinLockedUntil: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PIN_SET",
          targetType: "User",
          targetId: user.id,
          details: JSON.stringify({ success: true }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "PIN transaksi berhasil diatur.",
    });
  } catch (error) {
    console.error("[Wallet/Pin] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal mengatur PIN transaksi." },
      { status: 500 }
    );
  }
}
