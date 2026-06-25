-- Phase 7: Payment Integrity Layer
-- Adds PaymentReversal table and voidedAt to Receipt.
-- PaymentReversal.paymentId is UNIQUE — enforces one reversal per payment (Rule 1).

-- Add voidedAt to Receipt (nullable; NULL = active, non-NULL = voided).
ALTER TABLE "Receipt" ADD COLUMN "voidedAt" TIMESTAMPTZ;

-- Create PaymentReversal table.
CREATE TABLE "payment_reversals" (
  "id"         TEXT        NOT NULL,
  "paymentId"  TEXT        NOT NULL,
  "masjidId"   TEXT        NOT NULL,
  "reversedBy" TEXT        NOT NULL,
  "reason"     TEXT        NOT NULL,
  "reversedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "payment_reversals_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "payment_reversals_paymentId_key" UNIQUE ("paymentId"),

  CONSTRAINT "payment_reversals_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id"),
  CONSTRAINT "payment_reversals_masjidId_fkey"
    FOREIGN KEY ("masjidId")  REFERENCES "Masjid"("id"),
  CONSTRAINT "payment_reversals_reversedBy_fkey"
    FOREIGN KEY ("reversedBy") REFERENCES "User"("id")
);
