/**
 * Preflight Safety Verification: Confirm Zero Unencrypted TOTP Secrets Remain
 *
 * Runs before applying migration #3 (DROP COLUMN "totpSecret").
 * Exits with code 1 if any users possess a plaintext seed without an encrypted envelope.
 */
import { prisma } from "../src/server/db/prisma";

export async function verifyTotpMigration(): Promise<{ unmigratedCount: number }> {
  try {
    const colRes = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'totpSecret'
      ) as exists;`
    );
    const hasColumn = Boolean(colRes[0]?.exists);
    if (!hasColumn) {
      console.log("[Preflight Safety Check] SUCCESS: Column 'totpSecret' does not exist or has already been dropped.");
      return { unmigratedCount: 0 };
    }

    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int as count FROM "User" WHERE "totpSecret" IS NOT NULL AND "totpSecretCiphertext" IS NULL;`
    );
    const count = Number(result[0]?.count ?? 0);
    if (count > 0) {
      console.error(
        `[Preflight Safety Check] FAILED: Found ${count} user(s) with plaintext TOTP seeds but no ciphertext! Do NOT apply drop-column migration.`
      );
      return { unmigratedCount: count };
    }
    console.log("[Preflight Safety Check] SUCCESS: 0 unmigrated plaintext TOTP records found.");
    return { unmigratedCount: 0 };
  } catch (err) {
    console.error("[Preflight Safety Check] Error checking database:", err);
    throw err;
  }
}

if (require.main === module) {
  verifyTotpMigration()
    .then(({ unmigratedCount }) => {
      if (unmigratedCount > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Preflight Safety Check] Error executing check:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
