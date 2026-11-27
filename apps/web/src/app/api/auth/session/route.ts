import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  const session = await validateAuthoritativeSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      phone: true,
      createdAt: true,
      sellerProfile: {
        select: {
          storeName: true,
          city: true,
          bio: true,
          rating: true,
          totalSales: true,
        },
      },
    },
  });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      role: session.role,
      isVerified: session.isVerified,
      avatar: session.avatar ?? null,
      phone: profile?.phone ?? null,
      city: profile?.sellerProfile?.city ?? null,
      bio: profile?.sellerProfile?.bio ?? null,
      storeName: profile?.sellerProfile?.storeName ?? null,
      rating: profile?.sellerProfile?.rating ?? null,
      totalSales: profile?.sellerProfile?.totalSales ?? 0,
      joinedDate: profile?.createdAt
        ? profile.createdAt.toLocaleDateString("id-ID", {
            month: "short",
            year: "numeric",
          })
        : null,
    },
  });
}
