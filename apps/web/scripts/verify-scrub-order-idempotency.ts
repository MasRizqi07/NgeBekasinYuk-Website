/**
 * Idempotency Key Result Scrub Verification Script (Task 3.6.2)
 *
 * Verifies that zero CREATE_ORDER idempotency keys contain sensitive secrets.
 * Exits with non-zero code if any row still contains hashedPassword, hashedPin, or totpSecret.
 */

import { prisma } from "../src/server/db/prisma";

const LEAKED_FIELD_PATTERNS = ["hashedPassword", "hashedPin", "totpSecret"];

export async function verifyScrubOrderIdempotency(): Promise<{ contaminatedCount: number; totalCount: number }> {
  const keys = await prisma.idempotencyKey.findMany({
    where: { action: "CREATE_ORDER" },
    select: {
      key: true,
      result: true,
    },
  });

  const totalCount = keys.length;
  let contaminatedCount = 0;

  for (const row of keys) {
    const isContaminated = LEAKED_FIELD_PATTERNS.some((pattern) =>
      row.result.includes(pattern)
    );
    if (isContaminated) {
      contaminatedCount++;
    }
  }

  if (contaminatedCount > 0) {
    console.error(
      `[Verify Scrub Idempotency] FAILED: Found ${contaminatedCount} of ${totalCount} CREATE_ORDER key(s) containing exposed credentials.`
    );
    return { contaminatedCount, totalCount };
  }

  console.log(
    `[Verify Scrub Idempotency] SUCCESS: All ${totalCount} CREATE_ORDER key(s) are clean (zero exposed credentials).`
  );
  return { contaminatedCount: 0, totalCount };
}

if (require.main === module) {
  verifyScrubOrderIdempotency()
    .then(({ contaminatedCount }) => {
      if (contaminatedCount > 0) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Verify Scrub Idempotency] Execution error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
