-- Expand-only migration: add persistent login brute-force attempt counter and lock window
ALTER TABLE "User"
ADD COLUMN "loginFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loginLockedUntil" TIMESTAMP(3);
