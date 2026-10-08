/**
 * Operational Data Migration: Revoke Insecure Default PINs ("123456")
 *
 * Scans for all user records whose hashedPin matches default "123456",
 * clears hashedPin to null, resets attempt counters, and logs an AuditLog row.
 *
 * WARNING: Running --apply against a seeded database un-sets the demo PIN
 * ("123456") for seeded demo users, requiring them to set a new PIN via /api/wallet/pin.
 */
import { prisma } from "../src/server/db/prisma";
import bcrypt from "bcryptjs";

export async function migrateDefaultPins(apply: boolean): Promise<{ scanned: number; matching: number; revoked: number }> {
  console.log(`[Migration] Scanning users for insecure default PIN ("123456")... Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  const usersWithPin = await prisma.user.findMany({
    where: {
      hashedPin: { not: null },
    },
    select: {
      id: true,
      hashedPin: true,
    },
  });

  let matching = 0;
  let revoked = 0;

  for (const user of usersWithPin) {
    if (!user.hashedPin) continue;
    const isDefault = await bcrypt.compare("123456", user.hashedPin);
    if (isDefault) {
      matching++;
      if (apply) {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: {
              hashedPin: null,
              pinFailedAttempts: 0,
              pinLockedUntil: null,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: user.id,
              action: "PIN_DEFAULT_REVOKED",
              targetType: "User",
              targetId: user.id,
              details: JSON.stringify({ reason: "INSECURE_DEFAULT_PIN_CLEARED" }),
            },
          });
        });
        revoked++;
      }
    }
  }

  console.log(`[Migration] Scanned ${usersWithPin.length} user(s) with PIN.`);
  console.log(`[Migration] Found ${matching} user(s) matching insecure default PIN ("123456").`);
  if (apply) {
    console.log(`[Migration] Successfully revoked PIN for ${revoked} user(s).`);
  } else {
    console.log(`[Migration] DRY RUN: No database modifications made. Use --apply to execute.`);
  }

  return { scanned: usersWithPin.length, matching, revoked };
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  migrateDefaultPins(apply)
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("[Migration] Error:", err);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
