import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/server/db/prisma";
import { migrateLegacyTotpSecrets, hasLegacyTotpColumn } from "../../scripts/migrate-totp-secrets";
import { verifyTotpMigration } from "../../scripts/verify-totp-migration";
import { getAdminDecryptedTotpSecret } from "@/lib/auth/totp";

describe("Operational Migration Upgrade Safety (FINAL-OPS-01)", () => {
  const testUserId = `usr-legacy-test-${Date.now()}`;
  const legacyPlaintextSeed = "JBSWY3DPEHPK3PXP";

  afterAll(async () => {
    // Ensure cleanup of any created test users and ensure column is dropped if added
    try {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch {
      // ignore
    }
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" DROP COLUMN IF EXISTS "totpSecret";`);
    } catch {
      // ignore
    }
  });

  it("verifies clean preflight state on modern schema with dropped plaintext column", async () => {
    // On the current schema, totpSecret column is dropped
    const preflight = await verifyTotpMigration();
    expect(preflight.unmigratedCount).toBe(0);
  });

  it("safely backfills legacy Pass #2 plaintext TOTP seeds to AES-256-GCM before drop column", async () => {
    // 1. Simulate Pass #2 schema state by adding legacy totpSecret column
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" text;`);
    const columnExists = await hasLegacyTotpColumn();
    expect(columnExists).toBe(true);

    // 2. Insert a simulated Pass #2 legacy user holding plaintext seed without ciphertext
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `legacy-${Date.now()}@ngebekasinyuk.id`,
        name: "Legacy Admin User",
        role: "ADMIN",
        hashedPassword: "test-hashed-password",
      },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "totpSecret" = '${legacyPlaintextSeed}' WHERE id = '${testUserId}';`
    );

    // 3. Preflight verification MUST catch this unmigrated user and reject migration #3
    const preflightBefore = await verifyTotpMigration();
    expect(preflightBefore.unmigratedCount).toBeGreaterThanOrEqual(1);

    // 4. Run the operational migration backfill script
    const migrationResult = await migrateLegacyTotpSecrets();
    expect(migrationResult.errors).toBe(0);
    expect(migrationResult.migrated).toBeGreaterThanOrEqual(1);

    // 5. Preflight verification MUST now pass with 0 unmigrated records
    const preflightAfter = await verifyTotpMigration();
    expect(preflightAfter.unmigratedCount).toBe(0);

    // 6. Verify that the encrypted envelope was created properly and can be decrypted
    const migratedUser = await prisma.user.findUniqueOrThrow({
      where: { id: testUserId },
    });
    expect(migratedUser.totpSecretCiphertext).toBeTruthy();
    expect(migratedUser.totpSecretIv).toBeTruthy();
    expect(migratedUser.totpSecretTag).toBeTruthy();
    expect(migratedUser.totpSecretKeyVersion).toBe(1);
    expect(migratedUser.isTotpEnrolled).toBe(true);

    const decrypted = getAdminDecryptedTotpSecret(migratedUser);
    expect(decrypted).toBe(legacyPlaintextSeed);

    // 7. Apply migration #3 simulation (DROP COLUMN "totpSecret")
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" DROP COLUMN IF EXISTS "totpSecret";`);
    const columnExistsAfterDrop = await hasLegacyTotpColumn();
    expect(columnExistsAfterDrop).toBe(false);

    // 8. Verify data preservation: Decrypted secret remains fully accessible with zero data loss
    const userAfterDrop = await prisma.user.findUniqueOrThrow({
      where: { id: testUserId },
    });
    const decryptedAfterDrop = getAdminDecryptedTotpSecret(userAfterDrop);
    expect(decryptedAfterDrop).toBe(legacyPlaintextSeed);

    // 9. Preflight check on clean schema succeeds
    const finalPreflight = await verifyTotpMigration();
    expect(finalPreflight.unmigratedCount).toBe(0);
  });
});
