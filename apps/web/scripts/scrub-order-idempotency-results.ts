/**
 * Idempotency Key Result Sanitization Script (Task 3.6.2)
 *
 * Removes leaked credential rows from IdempotencyKey.result where action = 'CREATE_ORDER'.
 * Replaces full order DTOs with minimal JSON reference: {"orderId": "<resourceId>"}.
 *
 * Usage:
 *   tsx ./scripts/scrub-order-idempotency-results.ts            (Dry run, default)
 *   tsx ./scripts/scrub-order-idempotency-results.ts --apply    (Execute updates)
 */

import { prisma } from "../src/server/db/prisma";

const LEAKED_FIELD_PATTERNS = ["hashedPassword", "hashedPin", "totpSecret"];

export async function scrubOrderIdempotency(apply = false) {
  const keys = await prisma.idempotencyKey.findMany({
    where: { action: "CREATE_ORDER" },
    select: {
      key: true,
      resourceId: true,
      result: true,
    },
  });

  const totalInspected = keys.length;
  let contaminatedCount = 0;
  let scrubbedCount = 0;

  for (const row of keys) {
    const isContaminated = LEAKED_FIELD_PATTERNS.some((pattern) =>
      row.result.includes(pattern)
    );

    if (isContaminated) {
      contaminatedCount++;
      if (apply) {
        const cleanResult = JSON.stringify({ orderId: row.resourceId });
        await prisma.idempotencyKey.update({
          where: { key: row.key },
          data: { result: cleanResult },
        });
        scrubbedCount++;
      }
    }
  }

  console.log(`[Scrub Order Idempotency] Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[Scrub Order Idempotency] Total CREATE_ORDER keys inspected: ${totalInspected}`);
  console.log(`[Scrub Order Idempotency] Contaminated keys detected: ${contaminatedCount}`);
  if (apply) {
    console.log(`[Scrub Order Idempotency] Successfully scrubbed keys: ${scrubbedCount}`);
  } else {
    console.log(`[Scrub Order Idempotency] Keys pending scrub (dry-run): ${contaminatedCount}`);
  }

  return { totalInspected, contaminatedCount, scrubbedCount };
}

if (require.main === module) {
  const isApply = process.argv.includes("--apply");
  scrubOrderIdempotency(isApply)
    .catch((err) => {
      console.error("[Scrub Order Idempotency] Execution failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
