// Pluggable media storage interface for product listing images.
// Decouples route handlers from local disk vs object storage (S3/R2).

import crypto from "crypto";
import type { AllowedImageExtension } from "./imageValidation";

export interface StoredObject {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export interface RetrievedObject {
  buffer: Buffer;
  contentType: string;
}

export interface StorageProvider {
  put(key: string, buffer: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<RetrievedObject | null>;
  url(key: string): string;
  delete(key: string): Promise<void>;
}

// Strict UUID-v4 + allowlisted raster extension. Rejects path traversal and user names.
export const SAFE_STORAGE_KEY_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isValidStorageKey(key: string): boolean {
  return SAFE_STORAGE_KEY_REGEX.test(key);
}

export function generateSafeImageStorageKey(extension: AllowedImageExtension): string {
  return `${crypto.randomUUID()}.${extension}`;
}
