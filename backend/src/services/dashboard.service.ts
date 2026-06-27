import { Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { getFinancialSummary, computeActiveMemberLedgers } from './finance.service';

// ─── Severity classification ──────────────────────────────────────────────────

type OverdueSeverity = 'mild' | 'serious' | 'critical';

function classifySeverity(overdueMonthCount: number): OverdueSeverity {
  if (overdueMonthCount <= 2) return 'mild';
  if (overdueMonthCount <= 5) return 'serious';
  return 'critical';
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(masjidId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

  // Fast SQL stats — run in parallel with financial summary (which includes treasury + member ledgers).
  const [
    activeMembers,
    inactiveMembers,
    collectionThisMonth,
    collectionThisYear,
    recentPayments,
    recentReversals,
    financialSummary,
  ] = await Promise.all([
    prisma.member.count({ where: { masjidId, active: true } }),

    prisma.member.count({ where: { masjidId, active: false } }),

    prisma.payment.aggregate({
      where: {
        masjidId,
        paymentStatus: PaymentStatus.SUCCESS,
        paymentDate: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    prisma.payment.aggregate({
      where: {
        masjidId,
        paymentStatus: PaymentStatus.SUCCESS,
        paymentDate: { gte: yearStart, lt: yearEnd },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    prisma.payment.findMany({
      where: { masjidId, paymentStatus: PaymentStatus.SUCCESS },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
        createdAt: true,
        member: { select: { id: true, name: true, memberCode: true } },
        receipt: { select: { receiptNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    prisma.paymentReversal.findMany({
      where: { masjidId },
      select: {
        id: true,
        reason: true,
        reversedAt: true,
        payment: { select: { amount: true, member: { select: { name: true, memberCode: true } } } },
        actor: { select: { name: true } },
      },
      orderBy: { reversedAt: 'desc' },
      take: 5,
    }),

    getFinancialSummary(masjidId),
  ]);

  const { allLedgers, pendingDues, ...treasury } = financialSummary;

  return {
    members: { active: activeMembers, inactive: inactiveMembers },
    collection: {
      thisMonth: {
        totalAmount: (collectionThisMonth._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        paymentCount: collectionThisMonth._count._all,
      },
      thisYear: {
        totalAmount: (collectionThisYear._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        paymentCount: collectionThisYear._count._all,
      },
    },
    totalOutstandingAllMembers: pendingDues,
    recentPayments,
    recentReversals,
    treasury,
  };
}

// ─── Monthly collection report ────────────────────────────────────────────────

export async function getCollectionReport(masjidId: string, year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [payments, reversals] = await Promise.all([
    prisma.payment.findMany({
      where: {
        masjidId,
        paymentStatus: PaymentStatus.SUCCESS,
        paymentDate: { gte: yearStart, lt: yearEnd, not: null },
      },
      select: { amount: true, paymentDate: true },
    }),

    prisma.paymentReversal.findMany({
      where: { masjidId, reversedAt: { gte: yearStart, lt: yearEnd } },
      select: { reversedAt: true, payment: { select: { amount: true } } },
    }),
  ]);

  // Pre-populate all 12 months so months with no activity appear as zeros.
  type MonthBucket = {
    collected: Prisma.Decimal;
    paymentCount: number;
    reversedAmount: Prisma.Decimal;
    reversalCount: number;
  };
  const monthMap = new Map<string, MonthBucket>();
  for (let m = 0; m < 12; m++) {
    monthMap.set(`${String(year)}-${String(m + 1).padStart(2, '0')}`, {
      collected: new Prisma.Decimal(0),
      paymentCount: 0,
      reversedAmount: new Prisma.Decimal(0),
      reversalCount: 0,
    });
  }

  for (const p of payments) {
    if (!p.paymentDate) continue;
    const key = `${String(p.paymentDate.getUTCFullYear())}-${String(p.paymentDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    bucket.collected = bucket.collected.add(p.amount);
    bucket.paymentCount++;
  }

  for (const r of reversals) {
    const key = `${String(r.reversedAt.getUTCFullYear())}-${String(r.reversedAt.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    bucket.reversedAmount = bucket.reversedAmount.add(r.payment.amount);
    bucket.reversalCount++;
  }

  return Array.from(monthMap.entries()).map(([month, b]) => ({
    month,
    totalCollected: b.collected.toFixed(2),
    paymentCount: b.paymentCount,
    reversedAmount: b.reversedAmount.toFixed(2),
    reversalCount: b.reversalCount,
  }));
}

// ─── Overdue members report ───────────────────────────────────────────────────

export async function getOverdueReport(masjidId: string) {
  type OverdueMember = {
    memberId: string;
    memberCode: string;
    name: string;
    phone: string;
    totalOutstanding: string;
    overdueMonths: number;
    severity: OverdueSeverity;
  };

  const overdue: OverdueMember[] = [];
  let summaryMild = 0, summarySerious = 0, summaryCritical = 0;
  let grandTotalOutstanding = new Prisma.Decimal(0);

  const [activeMemberCount, summaryCount] = await Promise.all([
    prisma.member.count({ where: { masjidId, active: true } }),
    prisma.memberFinancialSummary.count({ where: { masjidId, member: { active: true } } }),
  ]);

  if (activeMemberCount > 0 && summaryCount === activeMemberCount) {
    // Fast path: read from pre-computed summary table (O(1) per query).
    const summaries = await prisma.memberFinancialSummary.findMany({
      where: {
        masjidId,
        member: { active: true },
        totalOutstanding: { gt: 0 },
      },
      include: {
        member: { select: { memberCode: true, name: true, phone: true } },
      },
    });

    for (const s of summaries) {
      const outstanding = new Prisma.Decimal(s.totalOutstanding);
      const severity = classifySeverity(s.overdueMonths);
      overdue.push({
        memberId: s.memberId,
        memberCode: s.member.memberCode,
        name: s.member.name,
        phone: s.member.phone,
        totalOutstanding: outstanding.toFixed(2),
        overdueMonths: s.overdueMonths,
        severity,
      });
      grandTotalOutstanding = grandTotalOutstanding.add(outstanding);
      if (severity === 'mild') summaryMild++;
      else if (severity === 'serious') summarySerious++;
      else summaryCritical++;
    }
  } else {
    // Fallback: compute from ledgers for masjids where summaries are incomplete.
    const allLedgers = await computeActiveMemberLedgers(masjidId);
    for (const { member, ledger } of allLedgers) {
      const outstanding = new Prisma.Decimal(ledger.totalOutstanding);
      if (outstanding.lessThanOrEqualTo(0)) continue;
      const overdueMonths = ledger.rows.filter(
        (r) => new Prisma.Decimal(r.outstanding).greaterThan(0),
      ).length;
      const severity = classifySeverity(overdueMonths);
      overdue.push({
        memberId: member.id,
        memberCode: member.memberCode,
        name: member.name,
        phone: member.phone,
        totalOutstanding: outstanding.toFixed(2),
        overdueMonths,
        severity,
      });
      grandTotalOutstanding = grandTotalOutstanding.add(outstanding);
      if (severity === 'mild') summaryMild++;
      else if (severity === 'serious') summarySerious++;
      else summaryCritical++;
    }
  }

  // Sort: critical first, then by outstanding amount descending.
  const severityOrder: Record<OverdueSeverity, number> = { critical: 0, serious: 1, mild: 2 };
  overdue.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return new Prisma.Decimal(b.totalOutstanding).comparedTo(new Prisma.Decimal(a.totalOutstanding));
  });

  return {
    members: overdue,
    summary: {
      total: overdue.length,
      mild: summaryMild,
      serious: summarySerious,
      critical: summaryCritical,
      totalOutstanding: grandTotalOutstanding.toFixed(2),
    },
  };
}
