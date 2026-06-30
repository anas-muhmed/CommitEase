/**
 * Seed chelav schedule for June 2026 — run with:
 *   npx ts-node --transpile-only scripts/seed-chelav.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAMES = [
  'Anas Mohammed', 'Sinan Ali', 'Rashid Koya', 'Muhammed Basheer',
  'Ibrahim Hassan', 'Faisal Rahman', 'Omar Farooq', 'Khalid Noor',
  'Yusuf Salim', 'Abdul Kareem',
];

async function main() {
  // Use the first active masjid found
  const masjid = await prisma.masjid.findFirst({ where: { status: 'ACTIVE' } });
  if (!masjid) {
    console.error('No active masjid found. Make sure you have logged in and set up a masjid first.');
    process.exit(1);
  }
  console.log(`Seeding chelav for masjid: ${masjid.name} (${masjid.id})`);

  const entries: { masjidId: string; displayLabel: string; date: Date; status: 'ASSIGNED' | 'COMPLETED' | 'SKIPPED' | 'SWAPPED' }[] = [];
  for (let day = 1; day <= 30; day++) {
    const date = new Date(Date.UTC(2026, 5, day)); // June = month 5 (0-indexed)
    const label = NAMES[(day - 1) % NAMES.length]!;
    entries.push({ masjidId: masjid.id, displayLabel: label, date, status: 'ASSIGNED' });
  }

  // Upsert so re-running doesn't fail
  let count = 0;
  for (const e of entries) {
    await prisma.chelavSchedule.upsert({
      where: { masjidId_date: { masjidId: e.masjidId, date: e.date } },
      create: e,
      update: { displayLabel: e.displayLabel },
    });
    count++;
  }

  console.log(`✓ Seeded ${count} chelav entries for June 2026`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
