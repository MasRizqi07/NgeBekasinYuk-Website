/**
 * Pre-Migration Safety Check: Verify Zero Duplicate Active Orders per Listing
 *
 * Scans the database to ensure no listing has more than one active (non-terminal) order.
 * Terminal orders are: CANCELLED, REFUNDED, COMPLETED.
 *
 * Exits with code 0 if database is clean (safe to apply partial unique index).
 * Exits with code 1 if any duplicate active orders are found.
 */
import { prisma } from "../src/server/db/prisma";

export async function checkActiveOrderDuplicates(): Promise<{
  clean: boolean;
  duplicateCount: number;
  duplicates: Array<{ listingId: string; activeOrderCount: number }>;
}> {
  console.log('[Check] Scanning database for duplicate active orders per listing...');

  const rows = await prisma.$queryRawUnsafe<Array<{ listingId: string; activeOrderCount: number | bigint }>>(`
    SELECT "listingId", count(*)::int as "activeOrderCount"
    FROM "Order"
    WHERE status NOT IN ('CANCELLED', 'REFUNDED', 'COMPLETED')
    GROUP BY "listingId"
    HAVING count(*) > 1
  `);

  const duplicates = rows.map((r) => ({
    listingId: r.listingId,
    activeOrderCount: Number(r.activeOrderCount),
  }));

  if (duplicates.length > 0) {
    console.error(
      `[Check] FAILED: Found ${duplicates.length} listing(s) with multiple active orders:`
    );
    for (const d of duplicates) {
      console.error(`  - Listing ${d.listingId}: ${d.activeOrderCount} active orders`);
    }
    return { clean: false, duplicateCount: duplicates.length, duplicates };
  }

  console.log('[Check] SUCCESS: Zero duplicate active orders found. Database is clean for D8 index.');
  return { clean: true, duplicateCount: 0, duplicates: [] };
}

if (require.main === module) {
  checkActiveOrderDuplicates()
    .then(({ clean }) => {
      prisma.$disconnect().finally(() => {
        if (!clean) {
          process.exit(1);
        }
      });
    })
    .catch((err) => {
      console.error("[Check] Error during verification:", err);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
