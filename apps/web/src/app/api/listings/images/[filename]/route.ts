import { NextResponse } from "next/server";
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

  return new NextResponse(new Uint8Array(retrieved.buffer), {
    status: 200,
    headers: {
      "Content-Type": retrieved.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
