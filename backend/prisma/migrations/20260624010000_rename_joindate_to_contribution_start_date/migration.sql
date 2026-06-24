-- Phase 5: Rename joinDate → contributionStartDate on Member.
-- Dues are calculated from when a member began contributing,
-- not when they joined the community — the old name was ambiguous.
ALTER TABLE "Member" RENAME COLUMN "joinDate" TO "contributionStartDate";
