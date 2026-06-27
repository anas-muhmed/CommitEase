-- CreateEnum
CREATE TYPE "TreasuryEntryType" AS ENUM ('INCOME', 'EXPENSE', 'REIMBURSEMENT', 'RESERVE_IN', 'RESERVE_OUT', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- AlterTable
ALTER TABLE "FundReserve" ADD COLUMN     "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restricted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TreasuryLedger" (
    "id" TEXT NOT NULL,
    "masjidId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "entryType" "TreasuryEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreasuryLedger_masjidId_createdAt_idx" ON "TreasuryLedger"("masjidId", "createdAt");

-- CreateIndex
CREATE INDEX "TreasuryLedger_accountId_createdAt_idx" ON "TreasuryLedger"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "TreasuryLedger_masjidId_entryType_createdAt_idx" ON "TreasuryLedger"("masjidId", "entryType", "createdAt");

-- AddForeignKey
ALTER TABLE "TreasuryLedger" ADD CONSTRAINT "TreasuryLedger_masjidId_fkey" FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryLedger" ADD CONSTRAINT "TreasuryLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FundAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryLedger" ADD CONSTRAINT "TreasuryLedger_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
