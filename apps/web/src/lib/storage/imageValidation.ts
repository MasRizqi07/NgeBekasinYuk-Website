// Magic-byte validation for uploaded listing images.
// Prevents MIME spoofing, SVG/HTML script injection, and oversized uploads.

export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_LISTING_IMAGES_PER_LISTING = 8;

export type AllowedImageMimeType = "image/jpeg" | "image/png" | "image/webp";
export type AllowedImageExtension = "jpg" | "png" | "webp";

export interface ValidatedImageInfo {
  mimeType: AllowedImageMimeType;
  extension: AllowedImageExtension;
  size: number;
}

export class ImageValidationError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ImageValidationError";
    this.code = code;
    this.status = status;
  }
}

function normalizeMimeType(mime?: string | null): string {
  if (!mime) return "";
  const lower = mime.split(";")[0].trim().toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  return lower;
}

/**
 * Inspects file header magic bytes to determine the real image format.
 * Supports only JPEG, PNG, and WebP. Rejects SVG, HTML, scripts, and polyglots.
 */
export function detectImageFormatFromMagicBytes(
  buffer: Buffer
): { mimeType: AllowedImageMimeType; extension: AllowedImageExtension } | null {
  if (buffer.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", extension: "png" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  // WebP: "RIFF" <4 bytes size> "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }

  return null;
}

export function validateUploadedImageBuffer(
  buffer: Buffer,
  claimedMimeType?: string | null
): ValidatedImageInfo {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ImageValidationError(
      "EMPTY_IMAGE",
      "File gambar kosong atau tidak terbaca.",
      400
    );
  }

  if (buffer.length > MAX_LISTING_IMAGE_BYTES) {
    throw new ImageValidationError(
      "IMAGE_TOO_LARGE",
      "Ukuran gambar maksimal 5 MB per file.",
      413
    );
  }

  const detected = detectImageFormatFromMagicBytes(buffer);
  if (!detected) {
    throw new ImageValidationError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Format gambar tidak valid. Hanya JPEG, PNG, dan WebP yang diizinkan.",
      400
    );
  }

  const normalizedClaimed = normalizeMimeType(claimedMimeType);
  if (
    normalizedClaimed &&
    normalizedClaimed !== "application/octet-stream" &&
    normalizedClaimed !== detected.mimeType
  ) {
    throw new ImageValidationError(
      "MIME_MISMATCH",
      "Tipe file gambar tidak sesuai dengan isi file sebenarnya.",
      400
    );
  }

  return {
    mimeType: detected.mimeType,
    extension: detected.extension,
    size: buffer.length,
  };
}

export const MIME_TYPE_BY_EXTENSION: Record<AllowedImageExtension, AllowedImageMimeType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
