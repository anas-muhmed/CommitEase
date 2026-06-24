-- Phase 4: Role simplification + MasjidStatus enum + MasjidSignupRequest

-- CreateEnum
CREATE TYPE "MasjidStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SignupRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum: drop COMMITTEE_VIEWER and COMMITTEE_EDITOR, add COMMITTEE_ADMIN
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'COMMITTEE_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- AlterTable: replace active Boolean with status MasjidStatus
ALTER TABLE "Masjid" DROP COLUMN "active",
ADD COLUMN     "status" "MasjidStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable: add mustChangePassword to User
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: signup request lead (no tenant created until SUPER_ADMIN approves)
CREATE TABLE "MasjidSignupRequest" (
    "id" TEXT NOT NULL,
    "masjidName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "status" "SignupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasjidSignupRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MasjidSignupRequest" ADD CONSTRAINT "MasjidSignupRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
