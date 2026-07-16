-- Allow contributionMonth to be NULL so opening-balance allocations can be stored.
-- A NULL contributionMonth means the allocation clears part of the member's
-- legacy openingDueBalance rather than a specific calendar month's dues.
ALTER TABLE "PaymentAllocation" ALTER COLUMN "contributionMonth" DROP NOT NULL;
