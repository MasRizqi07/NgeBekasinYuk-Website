import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import { attachListingImage } from "@/domain/listing/listingService";
import {
  handleRouteError,
  problemResponse,
  requestPathname,
} from "@/lib/http/problemDetails";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await validateAuthoritativeSession();
    if (!session) {
      return problemResponse({
        error: "UNAUTHORIZED",
        title: "Autentikasi Diperlukan",
        status: 401,
        detail: "Silakan login terlebih dahulu untuk mengunggah foto iklan.",
        instance: requestPathname(request),
      });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return problemResponse({
        error: "INVALID_MULTIPART",
        title: "Form Upload Tidak Valid",
        status: 400,
        detail: "Permintaan unggah harus menggunakan multipart/form-data.",
        instance: requestPathname(request),
      });
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return problemResponse({
        error: "FILE_REQUIRED",
        title: "File Foto Diperlukan",
        status: 400,
        detail: "Field multipart 'file' wajib disertakan.",
        instance: requestPathname(request),
      });
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { id } = await context.params;
    const createdImage = await attachListingImage({
      listingId: id,
      actor: { id: session.id, role: session.role },
      buffer,
      claimedMimeType: fileEntry.type,
    });

    return NextResponse.json(createdImage, { status: 201 });
  } catch (err) {
    return handleRouteError(err, request, "POST /api/listings/[id]/images");
  }
}
