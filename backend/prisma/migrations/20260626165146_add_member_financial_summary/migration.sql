-- CreateTable
CREATE TABLE "MemberFinancialSummary" (
    "memberId" TEXT NOT NULL,
    "masjidId" TEXT NOT NULL,
    "totalOutstanding" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overdueMonths" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "healthGrade" TEXT NOT NULL DEFAULT 'EXCELLENT',
    "lastPaymentAt" TIMESTAMP(3),
    "totalPaidLifetime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidThisMonth" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberFinancialSummary_pkey" PRIMARY KEY ("memberId")
);

-- CreateIndex
CREATE INDEX "MemberFinancialSummary_masjidId_idx" ON "MemberFinancialSummary"("masjidId");

-- AddForeignKey
ALTER TABLE "MemberFinancialSummary" ADD CONSTRAINT "MemberFinancialSummary_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberFinancialSummary" ADD CONSTRAINT "MemberFinancialSummary_masjidId_fkey" FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
