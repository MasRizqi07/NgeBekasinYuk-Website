import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcryptjs";
import { LoginSchema } from "@/lib/validations";
import { setServerSessionCookie } from "@/lib/auth/session";
import { AuditLogger } from "@/domain/audit/AuditLogger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = LoginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = validated.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await AuditLogger.log({
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: email,
        details: { reason: "User not found" },
      });
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", message: "Email atau kata sandi tidak cocok." },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      await AuditLogger.log({
        userId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        details: { reason: "Incorrect password" },
      });
      return NextResponse.json(
        { error: "INVALID_CREDENTIALS", message: "Email atau kata sandi tidak cocok." },
        { status: 401 }
      );
    }

    // Set secure server session cookie
    await setServerSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "BUYER" | "SELLER" | "ADMIN",
      isVerified: user.isVerified,
      avatar: user.avatar,
    });

    await AuditLogger.log({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      targetType: "User",
      targetId: user.id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("[Auth/Login] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
