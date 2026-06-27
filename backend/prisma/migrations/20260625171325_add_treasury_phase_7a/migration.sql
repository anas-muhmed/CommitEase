-- CreateEnum
CREATE TYPE "FundAccountType" AS ENUM ('CASH', 'BANK', 'UPI');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('VIEWER', 'PAYMENT_OPERATOR', 'TREASURER', 'ADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMode" ADD VALUE 'BANK_TRANSFER';
ALTER TYPE "PaymentMode" ADD VALUE 'UPI';

-- DropForeignKey
ALTER TABLE "payment_reversals" DROP CONSTRAINT "payment_reversals_masjidId_fkey";

-- DropForeignKey
ALTER TABLE "payment_reversals" DROP CONSTRAINT "payment_reversals_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "payment_reversals" DROP CONSTRAINT "payment_reversals_reversedBy_fkey";

-- DropIndex
DROP INDEX "Receipt_receiptNumber_key";

-- AlterTable
ALTER TABLE "ContributionPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Receipt" ALTER COLUMN "voidedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "committeeRole" "CommitteeRole" NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "payment_reversals" ALTER COLUMN "reversedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FundAccount" (
    "id" TEXT NOT NULL,
    "masjidId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FundAccountType" NOT NULL,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundReserve" (
    "id" TEXT NOT NULL,
    "masjidId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundReserve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundAccount_masjidId_active_idx" ON "FundAccount"("masjidId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FundAccount_masjidId_name_key" ON "FundAccount"("masjidId", "name");

-- CreateIndex
CREATE INDEX "FundReserve_masjidId_active_idx" ON "FundReserve"("masjidId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FundReserve_masjidId_title_key" ON "FundReserve"("masjidId", "title");

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_masjidId_fkey" FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversals" ADD CONSTRAINT "payment_reversals_reversedBy_fkey" FOREIGN KEY ("reversedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundAccount" ADD CONSTRAINT "FundAccount_masjidId_fkey" FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundAccount" ADD CONSTRAINT "FundAccount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundReserve" ADD CONSTRAINT "FundReserve_masjidId_fkey" FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundReserve" ADD CONSTRAINT "FundReserve_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
