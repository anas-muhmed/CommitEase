-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('MOSQUE_PAID', 'PERSONAL_PAID');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('SETTLED', 'PENDING_REIMB', 'REIMBURSED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('UTILITIES', 'MAINTENANCE', 'SUPPLIES', 'SALARIES', 'EVENTS', 'DONATIONS', 'OTHER');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "fundAccountId" TEXT;

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "masjidId" TEXT NOT NULL,
    "expenseType" "ExpenseType" NOT NULL,
    "status" "ExpenseStatus" NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "fundAccountId" TEXT,
    "paidByUserId" TEXT,
    "reimbursedAt" TIMESTAMP(3),
    "reimbursedFromId" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_masjidId_createdAt_idx" ON "Expense"("masjidId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_masjidId_status_idx" ON "Expense"("masjidId", "status");

-- CreateIndex
CREATE INDEX "Payment_fundAccountId_idx" ON "Payment"("fundAccountId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fundAccountId_fkey" FOREIGN KEY ("fundAccountId") REFERENCES "FundAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_masjidId_fkey" FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_fundAccountId_fkey" FOREIGN KEY ("fundAccountId") REFERENCES "FundAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_reimbursedFromId_fkey" FOREIGN KEY ("reimbursedFromId") REFERENCES "FundAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
