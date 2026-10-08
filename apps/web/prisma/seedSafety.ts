/**
 * NgeBekasinYuk - Deterministic Seed Safety Guard
 * Prevents execution of deterministic demo seed in production environments (APP_ENV or NODE_ENV).
 * Has zero external dependencies to prevent premature environment schema evaluation.
 */
export function assertSeedEnvironmentIsSafe(): void {
  if (process.env.APP_ENV === "production" || process.env.NODE_ENV === "production") {
    console.error("CRITICAL ERROR: Cannot run deterministic seed in production environment!");
    throw new Error("Seeding aborted: Cannot run deterministic seed in production environment (APP_ENV=production or NODE_ENV=production detected).");
  }
}
