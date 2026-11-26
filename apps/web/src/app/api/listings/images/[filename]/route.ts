import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { LISTING_STATUS } from "@/domain/listing/listingStatus";
import { isValidStorageKey } from "@/lib/storage/StorageProvider";
import { defaultListingStorage } from "@/lib/storage/LocalDiskProvider";
import { problemResponse, requestPathname } from "@/lib/http/problemDetails";

export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  if (!isValidStorageKey(filename)) {
    return problemResponse({
      error: "NOT_FOUND",
      title: "Foto Tidak Ditemukan",
      status: 404,
      detail: "Nama berkas foto tidak valid atau tidak ditemukan.",
      instance: requestPathname(request),
    });
  }

  const imageUrl = `/api/listings/images/${encodeURIComponent(filename)}`;
  const imageRecord = await prisma.listingImage.findFirst({
    where: { url: imageUrl },
    select: {
      listing: {
        select: {
          status: true,
          sellerId: true,
        },
      },
    },
  });

  if (!imageRecord) {
    return problemResponse({
      error: "NOT_FOUND",
      title: "Foto Tidak Ditemukan",
      status: 404,
      detail: "Berkas foto tidak tersedia.",
      instance: requestPathname(request),
    });
  }

  if (imageRecord.listing.status === LISTING_STATUS.ARCHIVED) {
    const session = await validateAuthoritativeSession();
    const canView =
      Boolean(session) &&
      (session!.id === imageRecord.listing.sellerId ||
        session!.role === "ADMIN");
    if (!canView) {
      return problemResponse({
        error: "NOT_FOUND",
        title: "Foto Tidak Ditemukan",
        status: 404,
        detail: "Berkas foto tidak tersedia.",
        instance: requestPathname(request),
      });
    }
  }

  const retrieved = await defaultListingStorage.get(filename);
  if (!retrieved) {
    return problemResponse({
      error: "NOT_FOUND",
      title: "Foto Tidak Ditemukan",
      status: 404,
      detail: "Berkas foto tidak tersedia.",
      instance: requestPathname(request),
    });
  }

  const cacheControl =
    imageRecord.listing.status === LISTING_STATUS.ARCHIVED
      ? "private, no-store"
      : "public, max-age=31536000, immutable";

  return new NextResponse(new Uint8Array(retrieved.buffer), {
    status: 200,
    headers: {
      "Content-Type": retrieved.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cacheControl,
    },
  });
}
