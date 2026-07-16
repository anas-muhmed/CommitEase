-- CreateEnum
CREATE TYPE "ChelavStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'SKIPPED', 'SWAPPED');

-- CreateTable
CREATE TABLE "ChelavSchedule" (
    "id" TEXT NOT NULL,
    "masjidId" TEXT NOT NULL,
    "memberId" TEXT,
    "displayLabel" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ChelavStatus" NOT NULL DEFAULT 'ASSIGNED',
    "notes" TEXT,
    "swappedWithId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChelavSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChelavSchedule_masjidId_date_key" ON "ChelavSchedule"("masjidId", "date");

-- CreateIndex
CREATE INDEX "ChelavSchedule_masjidId_date_idx" ON "ChelavSchedule"("masjidId", "date");

-- AddForeignKey
ALTER TABLE "ChelavSchedule" ADD CONSTRAINT "ChelavSchedule_masjidId_fkey"
  FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChelavSchedule" ADD CONSTRAINT "ChelavSchedule_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
