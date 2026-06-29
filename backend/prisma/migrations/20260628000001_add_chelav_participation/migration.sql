-- AlterTable: add chelavParticipation to Member (default true = participates)
ALTER TABLE "Member" ADD COLUMN "chelavParticipation" BOOLEAN NOT NULL DEFAULT true;
