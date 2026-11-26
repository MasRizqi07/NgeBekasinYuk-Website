import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import {
  validateUploadedImageBuffer,
  ImageValidationError,
  MAX_LISTING_IMAGE_BYTES,
} from "@/lib/storage/imageValidation";
import {
  generateSafeImageStorageKey,
  isValidStorageKey,
} from "@/lib/storage/StorageProvider";
import { LocalDiskProvider } from "@/lib/storage/LocalDiskProvider";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const JPEG_HEADER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01,
]);
const WEBP_HEADER = Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "binary");

describe("Image validation & LocalDiskProvider", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("AC10.8: accepts valid PNG, JPEG, and WebP magic bytes", () => {
    expect(validateUploadedImageBuffer(PNG_HEADER, "image/png")).toEqual({
      mimeType: "image/png",
      extension: "png",
      size: PNG_HEADER.length,
    });
    expect(validateUploadedImageBuffer(JPEG_HEADER, "image/jpeg")).toEqual({
      mimeType: "image/jpeg",
      extension: "jpg",
      size: JPEG_HEADER.length,
    });
    expect(validateUploadedImageBuffer(WEBP_HEADER, "image/webp")).toEqual({
      mimeType: "image/webp",
      extension: "webp",
      size: WEBP_HEADER.length,
    });
  });

  it("AC10.8: rejects non-PNG bytes labeled image/png and SVG payloads", () => {
    const fakePng = Buffer.from("not a real png script payload", "utf8");
    expect(() => validateUploadedImageBuffer(fakePng, "image/png")).toThrowError(
      ImageValidationError
    );

    const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(() => validateUploadedImageBuffer(svgPayload, "image/svg+xml")).toThrowError(
      ImageValidationError
    );

    expect(() => validateUploadedImageBuffer(PNG_HEADER, "image/jpeg")).toThrowError(
      ImageValidationError
    );
  });

  it("AC10.8: rejects empty or oversized buffers (> 5 MB)", () => {
    expect(() => validateUploadedImageBuffer(Buffer.alloc(0), "image/png")).toThrowError(
      ImageValidationError
    );
    const oversized = Buffer.alloc(MAX_LISTING_IMAGE_BYTES + 1, 0);
    PNG_HEADER.copy(oversized, 0);
    expect(() => validateUploadedImageBuffer(oversized, "image/png")).toThrowError(
      ImageValidationError
    );
  });

  it("prevents path traversal and stores/reads safe UUID filenames", async () => {
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "ngebekasinyuk-storage-"));
    tempDirs.push(tempRoot);
    const provider = new LocalDiskProvider(tempRoot);

    const safeKey = generateSafeImageStorageKey("png");
    expect(isValidStorageKey(safeKey)).toBe(true);
    expect(isValidStorageKey("../secret.png")).toBe(false);
    expect(isValidStorageKey("foo/bar.png")).toBe(false);
    expect(isValidStorageKey("not-a-uuid.svg")).toBe(false);

    const stored = await provider.put(safeKey, PNG_HEADER, "image/png");
    expect(stored.url).toBe(`/api/listings/images/${safeKey}`);

    const fetched = await provider.get(safeKey);
    expect(fetched?.contentType).toBe("image/png");
    expect(fetched?.buffer.equals(PNG_HEADER)).toBe(true);

    expect(await provider.get("../secret.png")).toBeNull();
    await expect(provider.put("../escape.png", PNG_HEADER, "image/png")).rejects.toThrow();

    await provider.delete(safeKey);
    expect(await provider.get(safeKey)).toBeNull();
  });
});
