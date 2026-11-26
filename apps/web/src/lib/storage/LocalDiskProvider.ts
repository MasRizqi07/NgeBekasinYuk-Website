import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  MIME_TYPE_BY_EXTENSION,
  type AllowedImageExtension,
} from "./imageValidation";
import {
  isValidStorageKey,
  type RetrievedObject,
  type StorageProvider,
  type StoredObject,
} from "./StorageProvider";

function resolveDefaultUploadRoot(): string {
  if (process.env.LISTING_UPLOAD_DIR) {
    return path.resolve(process.env.LISTING_UPLOAD_DIR);
  }
  const cwd = process.cwd();
  if (path.basename(cwd) === "web") {
    return path.resolve(cwd, ".uploads", "listings");
  }
  if (existsSync(path.join(cwd, "apps", "web"))) {
    return path.resolve(cwd, "apps", "web", ".uploads", "listings");
  }
  return path.resolve(cwd, ".uploads", "listings");
}

function getSafeFilePath(rootDir: string, key: string): string {
  if (!isValidStorageKey(key)) {
    throw new Error("Invalid storage key");
  }
  const resolvedRoot = path.resolve(rootDir);
  const target = path.resolve(resolvedRoot, key);
  if (!target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Path traversal detected");
  }
  return target;
}

function contentTypeFromKey(key: string): string {
  const ext = key.split(".").pop() as AllowedImageExtension | undefined;
  if (ext && ext in MIME_TYPE_BY_EXTENSION) {
    return MIME_TYPE_BY_EXTENSION[ext];
  }
  return "application/octet-stream";
}

export class LocalDiskProvider implements StorageProvider {
  private readonly customRootDir?: string;

  constructor(rootDir?: string) {
    this.customRootDir = rootDir ? path.resolve(rootDir) : undefined;
  }

  private getRootDir(): string {
    return this.customRootDir ?? resolveDefaultUploadRoot();
  }

  public url(key: string): string {
    if (!isValidStorageKey(key)) {
      throw new Error("Invalid storage key");
    }
    return `/api/listings/images/${encodeURIComponent(key)}`;
  }

  public async put(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<StoredObject> {
    const rootDir = this.getRootDir();
    const targetPath = getSafeFilePath(rootDir, key);
    await mkdir(rootDir, { recursive: true });
    await writeFile(targetPath, buffer, { flag: "w" });

    return {
      key,
      url: this.url(key),
      contentType,
      size: buffer.length,
    };
  }

  public async get(key: string): Promise<RetrievedObject | null> {
    if (!isValidStorageKey(key)) {
      return null;
    }
    const targetPath = getSafeFilePath(this.getRootDir(), key);
    try {
      const buffer = await readFile(targetPath);
      return {
        buffer,
        contentType: contentTypeFromKey(key),
      };
    } catch {
      return null;
    }
  }

  public async delete(key: string): Promise<void> {
    if (!isValidStorageKey(key)) {
      return;
    }
    const targetPath = getSafeFilePath(this.getRootDir(), key);
    try {
      await unlink(targetPath);
    } catch {
      // Ignore missing files on cleanup
    }
  }
}

export const defaultListingStorage: StorageProvider = new LocalDiskProvider();
