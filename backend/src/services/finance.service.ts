import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getLedger } from './member.service';
import { getTreasurySnapshot } from './treasury.service';

// ─── Shared batch member-ledger computation ───────────────────────────────────
// Runs in batches of 20 to avoid flooding the DB connection pool.

const LEDGER_BATCH_SIZE = 20;

export type MemberLedgerPair = {
  member: { id: string; memberCode: string; name: string; phone: string };
  ledger: Awaited<ReturnType<typeof getLedger>>;
};

export async function computeActiveMemberLedgers(masjidId: string): Promise<MemberLedgerPair[]> {
  const members = await prisma.member.findMany({
    where: { masjidId, active: true },
    select: { id: true, memberCode: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  });

  const results: MemberLedgerPair[] = [];

  for (let i = 0; i < members.length; i += LEDGER_BATCH_SIZE) {
    const batch = members.slice(i, i + LEDGER_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (m) => ({ member: m, ledger: await getLedger(masjidId, m.id) })),
    );
    results.push(...batchResults);
  }

  return results;
}

// ─── Central financial summary ────────────────────────────────────────────────
// Single source of truth consumed by both the dashboard and the finance page.
// Computes treasury snapshot (balances, reserves, reimbursements) in parallel
// with member ledger aggregation (pendingDues).

export async function getFinancialSummary(masjidId: string) {
  const [snapshot, activeMemberCount, summaryCount] = await Promise.all([
    getTreasurySnapshot(masjidId),
    prisma.member.count({ where: { masjidId, active: true } }),
    prisma.memberFinancialSummary.count({ where: { masjidId, member: { active: true } } }),
  ]);

  let pendingDues: string;
  let allLedgers: MemberLedgerPair[] = [];

  if (activeMemberCount > 0 && summaryCount === activeMemberCount) {
    const agg = await prisma.memberFinancialSummary.aggregate({
      where: { masjidId, member: { active: true } },
      _sum: { totalOutstanding: true },
    });
    pendingDues = (agg._sum.totalOutstanding ?? new Prisma.Decimal(0)).toFixed(2);
  } else {
    allLedgers = await computeActiveMemberLedgers(masjidId);
    pendingDues = allLedgers
      .reduce((sum, { ledger }) => sum.add(new Prisma.Decimal(ledger.totalOutstanding)), new Prisma.Decimal(0))
      .toFixed(2);
  }

  return { ...snapshot, pendingDues, allLedgers };
}
