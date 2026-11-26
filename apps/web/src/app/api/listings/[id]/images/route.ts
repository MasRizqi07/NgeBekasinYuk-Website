import { NextResponse } from "next/server";
import { validateAuthoritativeSession } from "@/lib/auth/authoritativeSession";
import {
  attachListingImage,
  authorizeListingImageUpload,
  ListingServiceError,
} from "@/domain/listing/listingService";
import {
  handleRouteError,
  problemResponse,
  requestPathname,
} from "@/lib/http/problemDetails";

// Allow 6 MB raw multipart envelope overhead around the strict 5 MB file cap.
const MAX_MULTIPART_BODY_BYTES = 6 * 1024 * 1024;

async function readBoundedRequestBody(request: Request): Promise<Buffer> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BODY_BYTES) {
      throw new ListingServiceError(
        "PAYLOAD_TOO_LARGE",
        "Ukuran Permintaan Terlalu Besar",
        "Ukuran unggahan maksimal 5 MB per foto.",
        413
      );
    }
  }

  if (!request.body) {
    return Buffer.alloc(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MULTIPART_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new ListingServiceError(
          "PAYLOAD_TOO_LARGE",
          "Ukuran Permintaan Terlalu Besar",
          "Ukuran unggahan maksimal 5 MB per foto.",
          413
        );
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

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

    const { id } = await context.params;
    const actor = { id: session.id, role: session.role };

    // Authorize listing existence, ownership, and photo count limit before reading body.
    await authorizeListingImageUpload({ listingId: id, actor });

    const boundedBuffer = await readBoundedRequestBody(request);
    let formData: FormData;
    try {
      const contentType = request.headers.get("content-type") || "";
      const boundedReq = new Request(request.url, {
        method: "POST",
        headers: { "content-type": contentType },
        body: new Uint8Array(boundedBuffer),
      });
      formData = await boundedReq.formData();
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

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ||
      request.headers.get("idempotency-key");

    const createdImage = await attachListingImage({
      listingId: id,
      actor,
      buffer,
      claimedMimeType: fileEntry.type,
      idempotencyKey,
    });

    return NextResponse.json(createdImage, { status: 201 });
  } catch (err) {
    return handleRouteError(err, request, "POST /api/listings/[id]/images");
  }
}
