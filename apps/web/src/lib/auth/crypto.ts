// Universal Web Crypto HMAC-SHA256 utilities
// Compatible with both Next.js Edge Runtime (middleware) and Node.js server handlers.

const textEncoder = new TextEncoder();

/**
 * Imports a raw secret string as an HMAC-SHA256 CryptoKey.
 */
async function getHmacKey(secret: string): Promise<CryptoKey> {
  const keyData = textEncoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Converts an ArrayBuffer to a hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Converts a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (isNaN(byte)) return null;
    bytes[i / 2] = byte;
  }
  return bytes;
}

/**
 * Constant-time comparison between two hex strings to prevent timing attacks.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Signs string data with HMAC-SHA256 using Web Crypto API, returning a hex string.
 */
export async function signHmacSha256(data: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, textEncoder.encode(data));
  return bufferToHex(signatureBuffer);
}

/**
 * Cryptographically verifies an HMAC-SHA256 signature using Web Crypto API.
 */
export async function verifyHmacSha256(
  data: string,
  signatureHex: string,
  secret: string
): Promise<boolean> {
  try {
    const signatureBytes = hexToBytes(signatureHex);
    if (!signatureBytes) return false;

    const key = await getHmacKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      textEncoder.encode(data)
    );
  } catch {
    return false;
  }
}
