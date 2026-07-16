-- Adds a per-masjid receipt sequence counter for atomic, race-free receipt
-- number generation. The UPSERT pattern (ON CONFLICT DO UPDATE SET lastNumber + 1)
-- inside a Prisma transaction serializes concurrent writes without a table lock.

CREATE TABLE "ReceiptSequence" (
    "masjidId"   TEXT    NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("masjidId"),
    CONSTRAINT "ReceiptSequence_masjidId_fkey" FOREIGN KEY ("masjidId")
        REFERENCES "Masjid"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
