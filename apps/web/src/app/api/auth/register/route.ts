import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import bcrypt from "bcryptjs";
import { RegisterSchema } from "@/lib/validations";
import { setServerSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = RegisterSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, phone, role } = validated.data;

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "EMAIL_EXISTS", message: "Email sudah terdaftar. Silakan login." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Default demo hashed PIN 123456
    const hashedPin = await bcrypt.hash("123456", 10);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          phone,
          role,
          hashedPassword,
          hashedPin,
          wallet: {
            create: {
              activeBalance: 0,
              heldBalance: 0,
            },
          },
        },
      });

      if (role === "SELLER") {
        const slug = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString().slice(-4)}`;
        await tx.sellerProfile.create({
          data: {
            userId: newUser.id,
            storeName: `${name} Store`,
            storeSlug: slug,
            city: "Jakarta",
          },
        });
      }

      return newUser;
    });

    await setServerSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "BUYER" | "SELLER" | "ADMIN",
      isVerified: user.isVerified,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Auth/Register] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Gagal mendaftarkan akun." },
      { status: 500 }
    );
  }
}
