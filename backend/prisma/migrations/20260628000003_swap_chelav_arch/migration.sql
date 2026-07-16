-- Architectural correction: move chelav exemption from per-member flag
-- to plan-level flag. chelavParticipation on Member was wrong source of truth.

-- Drop per-member flag (was always default true, not yet in use in production)
ALTER TABLE "Member" DROP COLUMN IF EXISTS "chelavParticipation";

-- Add plan-level exemption flag (false = participates in chelav rotation)
ALTER TABLE "ContributionPlan" ADD COLUMN "chelavExempt" BOOLEAN NOT NULL DEFAULT false;
