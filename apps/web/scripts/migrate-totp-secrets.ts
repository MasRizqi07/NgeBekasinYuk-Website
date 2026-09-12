/**
 * Operational Data Migration: Encrypt Legacy Plaintext TOTP Seeds
 *
 * Scans for any user records holding unencrypted seeds, generates AES-256-GCM
 * cryptographic envelopes, and persists them prior to dropping the legacy column.
 */
import { prisma } from "../src/server/db/prisma";
import { encryptSensitiveSecret } from "../src/lib/security/encryption";

export async function hasLegacyTotpColumn(): Promise<boolean> {
  try {
    const res = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'totpSecret'
      ) as exists;`
    );
    return Boolean(res[0]?.exists);
  } catch {
    return false;
  }
}

export async function migrateLegacyTotpSecrets(): Promise<{ migrated: number; errors: number }> {
  console.log("[Migration] Starting legacy TOTP encryption check...");

  const columnExists = await hasLegacyTotpColumn();
  if (!columnExists) {
    console.log("[Migration] Column 'totpSecret' does not exist in 'User' table (already dropped or fresh installation).");
    return { migrated: 0, errors: 0 };
  }

  let legacyUsers: Array<{ id: string; totpSecret?: string | null }> = [];
  try {
    legacyUsers = await prisma.$queryRawUnsafe<Array<{ id: string; totpSecret?: string | null }>>(
      `SELECT id, "totpSecret" FROM "User" WHERE "totpSecret" IS NOT NULL AND "totpSecretCiphertext" IS NULL;`
    );
  } catch (err) {
    console.error("[Migration] Failed to query legacy TOTP secrets:", err);
    return { migrated: 0, errors: 1 };
  }

  let migrated = 0;
  let errors = 0;

  for (const user of legacyUsers) {
    if (!user.totpSecret) continue;
    try {
      const encrypted = encryptSensitiveSecret(user.totpSecret);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          totpSecretCiphertext: encrypted.ciphertext,
          totpSecretIv: encrypted.iv,
          totpSecretTag: encrypted.tag,
          totpSecretKeyVersion: encrypted.keyVersion,
          isTotpEnrolled: true,
        },
      });
      migrated++;
      console.log(`[Migration] Encrypted TOTP secret for user: ${user.id}`);
    } catch (err) {
      errors++;
      console.error(`[Migration] Failed to encrypt secret for user: ${user.id}`, err);
    }
  }

  console.log(`[Migration] Completed: ${migrated} migrated, ${errors} errors.`);
  return { migrated, errors };
}

if (require.main === module) {
  migrateLegacyTotpSecrets()
    .then((result) => {
      if (result.errors > 0) {
        console.error(`[Migration] FAILED: ${result.errors} error(s) occurred during legacy TOTP encryption.`);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Fatal error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
