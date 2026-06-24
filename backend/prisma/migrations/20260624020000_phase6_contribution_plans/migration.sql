-- Phase 6: Contribution Plans
-- Replaces the per-masjid flat fee with per-plan fees so different member
-- categories (e.g. Chelav vs General) can carry different rates.
-- Migration strategy:
--   1. Create ContributionPlan and MemberPlanHistory tables
--   2. Auto-create one "General Member" plan per existing masjid
--   3. Migrate contribution_fee_history rows to reference that plan
--   4. Add contributionPlanId (NOT NULL) to Member, assign to default plan
--   5. Add FK constraints after data is populated
--   6. Change Receipt.receiptNumber uniqueness from global to per-masjid

-- ─── 1. ContributionPlan ──────────────────────────────────────────────────────

CREATE TABLE "ContributionPlan" (
  "id"          TEXT        NOT NULL,
  "masjidId"    TEXT        NOT NULL,
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "active"      BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContributionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContributionPlan_masjidId_name_key"
  ON "ContributionPlan"("masjidId", "name");

-- ─── 2. MemberPlanHistory ─────────────────────────────────────────────────────

CREATE TABLE "MemberPlanHistory" (
  "id"                 TEXT        NOT NULL,
  "memberId"           TEXT        NOT NULL,
  "contributionPlanId" TEXT        NOT NULL,
  "effectiveFrom"      TIMESTAMP(3) NOT NULL,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberPlanHistory_pkey" PRIMARY KEY ("id")
);

-- ─── 3. Seed default plan per existing masjid ─────────────────────────────────
-- gen_random_uuid() is available in PostgreSQL 13+ (pgcrypto or pg built-in).

INSERT INTO "ContributionPlan" ("id", "masjidId", "name", "active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  "id",
  'General Member',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Masjid";

-- ─── 4. Migrate ContributionFeeHistory: drop masjidId, add contributionPlanId ─

ALTER TABLE "contribution_fee_history"
  ADD COLUMN "contributionPlanId" TEXT;

-- Point existing fee rows to the newly-created default plan for their masjid.
UPDATE "contribution_fee_history" cfh
SET "contributionPlanId" = cp."id"
FROM "ContributionPlan" cp
WHERE cp."masjidId" = cfh."masjidId"
  AND cp."name"    = 'General Member';

ALTER TABLE "contribution_fee_history"
  ALTER COLUMN "contributionPlanId" SET NOT NULL;

-- Remove the old masjid relation.
ALTER TABLE "contribution_fee_history"
  DROP CONSTRAINT IF EXISTS "contribution_fee_history_masjidId_fkey";

ALTER TABLE "contribution_fee_history"
  DROP COLUMN "masjidId";

-- ─── 5. Add contributionPlanId to Member ──────────────────────────────────────

ALTER TABLE "Member"
  ADD COLUMN "contributionPlanId" TEXT;

-- Assign all existing members to their masjid's default plan.
UPDATE "Member" m
SET "contributionPlanId" = cp."id"
FROM "ContributionPlan" cp
WHERE cp."masjidId" = m."masjidId"
  AND cp."name"     = 'General Member';

ALTER TABLE "Member"
  ALTER COLUMN "contributionPlanId" SET NOT NULL;

-- ─── 6. Add FK constraints ────────────────────────────────────────────────────

ALTER TABLE "ContributionPlan"
  ADD CONSTRAINT "ContributionPlan_masjidId_fkey"
  FOREIGN KEY ("masjidId") REFERENCES "Masjid"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contribution_fee_history"
  ADD CONSTRAINT "contribution_fee_history_contributionPlanId_fkey"
  FOREIGN KEY ("contributionPlanId") REFERENCES "ContributionPlan"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Member"
  ADD CONSTRAINT "Member_contributionPlanId_fkey"
  FOREIGN KEY ("contributionPlanId") REFERENCES "ContributionPlan"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MemberPlanHistory"
  ADD CONSTRAINT "MemberPlanHistory_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MemberPlanHistory"
  ADD CONSTRAINT "MemberPlanHistory_contributionPlanId_fkey"
  FOREIGN KEY ("contributionPlanId") REFERENCES "ContributionPlan"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 7. Receipt: change to per-masjid unique receipt numbers ─────────────────

ALTER TABLE "Receipt"
  DROP CONSTRAINT IF EXISTS "Receipt_receiptNumber_key";

CREATE UNIQUE INDEX "Receipt_masjidId_receiptNumber_key"
  ON "Receipt"("masjidId", "receiptNumber");
