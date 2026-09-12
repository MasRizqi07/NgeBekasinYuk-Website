-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "lastTotpStep" INTEGER,
ADD COLUMN     "totpSecretCiphertext" TEXT,
ADD COLUMN     "totpSecretIv" TEXT,
ADD COLUMN     "totpSecretKeyVersion" INTEGER DEFAULT 1,
ADD COLUMN     "totpSecretTag" TEXT;

-- CreateTable
CREATE TABLE "AdminStepUpGrant" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminStepUpGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminStepUpGrant_adminId_idx" ON "AdminStepUpGrant"("adminId");

-- CreateIndex
CREATE INDEX "AdminStepUpGrant_action_resourceId_idx" ON "AdminStepUpGrant"("action", "resourceId");

-- AddForeignKey
ALTER TABLE "AdminStepUpGrant" ADD CONSTRAINT "AdminStepUpGrant_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
