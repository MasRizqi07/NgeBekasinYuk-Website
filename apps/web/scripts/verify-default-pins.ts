/**
 * Preflight Safety Verification: Confirm Zero Insecure Default PINs ("123456") Remain
 *
 * Scans for any user records whose hashedPin matches default "123456".
 * Exits with non-zero exit code if any users verify against "123456".
 */
import { prisma } from "../src/server/db/prisma";
import bcrypt from "bcryptjs";

export async function verifyDefaultPins(): Promise<{ defaultPinCount: number }> {
  console.log('[Verification] Scanning database for any remaining default PINs ("123456")...');

  const usersWithPin = await prisma.user.findMany({
    where: {
      hashedPin: { not: null },
    },
    select: {
      id: true,
      hashedPin: true,
    },
  });

  let defaultPinCount = 0;

  for (const user of usersWithPin) {
    if (!user.hashedPin) continue;
    const isDefault = await bcrypt.compare("123456", user.hashedPin);
    if (isDefault) {
      defaultPinCount++;
    }
  }

  if (defaultPinCount > 0) {
    console.error(
      `[Verification] FAILED: Found ${defaultPinCount} user(s) still configured with default PIN ("123456")!`
    );
  } else {
    console.log(
      `[Verification] SUCCESS: 0 users configured with default PIN ("123456"). Database is clean.`
    );
  }

  return { defaultPinCount };
}

if (require.main === module) {
  verifyDefaultPins()
    .then(({ defaultPinCount }) => {
      prisma.$disconnect().finally(() => {
        if (defaultPinCount > 0) {
          process.exit(1);
        }
      });
    })
    .catch((err) => {
      console.error("[Verification] Error checking database:", err);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
