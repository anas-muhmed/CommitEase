import { Prisma, PaymentStatus, ChelavStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getLedger } from './member.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function fmtContribMonth(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const MODE_LABEL: Record<string, string> = {
  CASH: 'Cash', ONLINE: 'Online', BANK_TRANSFER: 'Bank Transfer', UPI: 'UPI',
};

const CHELAV_STATUS_LABEL: Record<ChelavStatus, string> = {
  ASSIGNED:  'Scheduled',
  COMPLETED: 'Completed',
  SKIPPED:   'Missed',
  SWAPPED:   'Changed',
};

// ─── Activity feed builder ────────────────────────────────────────────────────

type PaymentRow = {
  id: string;
  amount: Prisma.Decimal;
  paymentMode: string;
  paymentStatus: PaymentStatus;
  paymentDate: Date | null;
  createdAt: Date;
  allocations: Array<{ contributionMonth: Date | null; amountAllocated: Prisma.Decimal }>;
  receipt: { receiptNumber: string } | null;
  reversal: { reason: string; reversedAt: Date } | null;
};

function buildActivityEntry(p: PaymentRow) {
  const isReversed = p.paymentStatus === PaymentStatus.REVERSED;

  const clearedMonths = p.allocations
    .filter((a) => a.contributionMonth != null)
    .sort((a, b) => a.contributionMonth!.getTime() - b.contributionMonth!.getTime())
    .map((a) => fmtContribMonth(a.contributionMonth!));

  const hasOpeningBalance = p.allocations.some((a) => a.contributionMonth === null);

  let description: string;
  if (isReversed) {
    description = p.reversal?.reason ?? 'This payment was reversed by the committee';
  } else if (clearedMonths.length === 1) {
    description = `Your ${clearedMonths[0]} dues are now clear`;
  } else if (clearedMonths.length > 1) {
    const last = clearedMonths.at(-1)!;
    const rest = clearedMonths.slice(0, -1).join(', ');
    description = `Your ${rest} and ${last} dues are now clear`;
  } else if (hasOpeningBalance) {
    description = 'Opening balance payment recorded';
  } else {
    description = 'Payment recorded';
  }

  return {
    id: p.id,
    type: isReversed ? 'REVERSED' as const : 'PAYMENT' as const,
    amount: p.amount.toFixed(2),
    paymentMode: MODE_LABEL[p.paymentMode] ?? p.paymentMode,
    date: (p.paymentDate ?? p.createdAt).toISOString(),
    description,
    receiptNumber: isReversed ? null : (p.receipt?.receiptNumber ?? null),
  };
}

// ─── getMemberHome ────────────────────────────────────────────────────────────

export async function getMemberHome(memberId: string, masjidId: string) {
  const today = todayUTC();

  const [member, summary, recentPayments, todayChelav, nextTurn] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId, masjidId },
      select: {
        id: true,
        name: true,
        memberCode: true,
        phone: true,
        contributionPlan: { select: { name: true, chelavExempt: true } },
        masjid: { select: { name: true } },
      },
    }),

    prisma.memberFinancialSummary.findUnique({ where: { memberId } }),

    prisma.payment.findMany({
      where: { memberId, masjidId, paymentStatus: { in: [PaymentStatus.SUCCESS, PaymentStatus.REVERSED] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, amount: true, paymentMode: true, paymentStatus: true,
        paymentDate: true, createdAt: true,
        allocations: {
          select: { contributionMonth: true, amountAllocated: true },
          orderBy: { contributionMonth: 'asc' },
        },
        receipt: { select: { receiptNumber: true } },
        reversal: { select: { reason: true, reversedAt: true } },
      },
    }),

    prisma.chelavSchedule.findUnique({
      where: { masjidId_date: { masjidId, date: today } },
      select: { displayLabel: true, status: true, memberId: true },
    }),

    prisma.chelavSchedule.findFirst({
      where: { masjidId, memberId, date: { gte: today }, status: ChelavStatus.ASSIGNED },
      orderBy: { date: 'asc' },
      select: { date: true, displayLabel: true },
    }),
  ]);

  if (!member) throw new ApiError(404, 'Member not found.');

  const outstanding = new Prisma.Decimal(summary?.totalOutstanding ?? 0);
  const isAllClear = outstanding.isZero();

  return {
    member: {
      name: member.name,
      memberCode: member.memberCode,
      phone: member.phone,
      masjidName: member.masjid.name,
      planName: member.contributionPlan.name,
      chelavExempt: member.contributionPlan.chelavExempt,
    },
    financial: {
      totalOutstanding: outstanding.toFixed(2),
      overdueMonths: summary?.overdueMonths ?? 0,
      lastPaymentAt: summary?.lastPaymentAt?.toISOString() ?? null,
      isAllClear,
    },
    recentActivity: recentPayments.map(buildActivityEntry),
    chelav: member.contributionPlan.chelavExempt ? null : {
      today: todayChelav
        ? {
            displayLabel: todayChelav.displayLabel,
            status: CHELAV_STATUS_LABEL[todayChelav.status],
            isMe: todayChelav.memberId === memberId,
          }
        : null,
      nextTurn: nextTurn
        ? { date: nextTurn.date.toISOString(), displayLabel: nextTurn.displayLabel }
        : null,
    },
  };
}

// ─── getMemberHistory ─────────────────────────────────────────────────────────

export async function getMemberHistory(memberId: string, masjidId: string) {
  const [ledger, payments] = await Promise.all([
    getLedger(masjidId, memberId),

    prisma.payment.findMany({
      where: { memberId, masjidId, paymentStatus: { in: [PaymentStatus.SUCCESS, PaymentStatus.REVERSED] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, amount: true, paymentMode: true, paymentStatus: true,
        paymentDate: true, createdAt: true, note: true,
        receipt: { select: { receiptNumber: true, generatedAt: true, voidedAt: true } },
        reversal: { select: { reason: true, reversedAt: true } },
        allocations: {
          select: { contributionMonth: true, amountAllocated: true },
          orderBy: { contributionMonth: 'asc' },
        },
      },
    }),
  ]);

  // Build monthly record from ledger rows with human-readable status labels
  const monthlyRecord = ledger.rows.map((row) => {
    const outstanding = parseFloat(row.outstanding);
    const monthlyDue = parseFloat(row.monthlyDue);
    const paid = parseFloat(row.paid);

    let status: 'Paid' | 'Partial' | 'Pending' | 'Overdue';
    if (outstanding <= 0) {
      status = 'Paid';
    } else if (paid > 0 && paid < monthlyDue) {
      status = 'Partial';
    } else {
      // Overdue if more than 1 month in the past
      const [year, month] = row.month.split('-').map(Number) as [number, number];
      const monthEnd = new Date(Date.UTC(year!, month!, 1)); // first of next month
      status = monthEnd < todayUTC() ? 'Overdue' : 'Pending';
    }

    return { month: row.month, planName: row.planName, monthlyDue: row.monthlyDue, paid: row.paid, outstanding: row.outstanding, status };
  }).reverse(); // most recent first

  const receipts = payments.map((p) => ({
    id: p.id,
    amount: p.amount.toFixed(2),
    paymentMode: MODE_LABEL[p.paymentMode] ?? p.paymentMode,
    paymentStatus: p.paymentStatus,
    date: (p.paymentDate ?? p.createdAt).toISOString(),
    note: p.note ?? null,
    receiptNumber: p.receipt?.receiptNumber ?? null,
    generatedAt: p.receipt?.generatedAt?.toISOString() ?? null,
    isReversed: p.paymentStatus === PaymentStatus.REVERSED,
    reversalReason: p.reversal?.reason ?? null,
    clearedMonths: p.allocations
      .filter((a) => a.contributionMonth != null)
      .map((a) => fmtContribMonth(a.contributionMonth!)),
  }));

  return {
    summary: {
      totalOutstanding: ledger.totalOutstanding,
      totalPaid: ledger.totalPaid,
      overdueMonths: ledger.overdueMonths,
      healthGrade: ledger.healthGrade,
    },
    monthlyRecord,
    receipts,
  };
}

// ─── getMemberReceiptDetail ───────────────────────────────────────────────────

export async function getMemberReceiptDetail(memberId: string, masjidId: string, receiptId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: receiptId, memberId, masjidId },
    select: {
      id: true, amount: true, paymentMode: true, paymentStatus: true,
      paymentDate: true, createdAt: true, note: true,
      receipt: { select: { receiptNumber: true, generatedAt: true } },
      reversal: { select: { reason: true, reversedAt: true } },
      allocations: {
        select: { contributionMonth: true, amountAllocated: true },
        orderBy: { contributionMonth: 'asc' },
      },
    },
  });

  if (!payment) throw new ApiError(404, 'Receipt not found.');

  return {
    id: payment.id,
    receiptNumber: payment.receipt?.receiptNumber ?? null,
    amount: payment.amount.toFixed(2),
    paymentMode: MODE_LABEL[payment.paymentMode] ?? payment.paymentMode,
    date: (payment.paymentDate ?? payment.createdAt).toISOString(),
    status: payment.paymentStatus as string,
    note: payment.note ?? null,
    isReversed: payment.paymentStatus === PaymentStatus.REVERSED,
    reversalReason: payment.reversal?.reason ?? null,
    allocations: payment.allocations
      .filter((a) => a.contributionMonth != null)
      .map((a) => ({
        month: fmtContribMonth(a.contributionMonth!),
        amount: a.amountAllocated.toFixed(2),
      })),
  };
}

// ─── getMemberChelav ──────────────────────────────────────────────────────────

export async function getMemberChelav(memberId: string, masjidId: string, year: number, month: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0)); // last day of month

  const entries = await prisma.chelavSchedule.findMany({
    where: { masjidId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, displayLabel: true, status: true, memberId: true, notes: true },
  });

  return {
    year,
    month,
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      displayLabel: e.displayLabel,
      status: CHELAV_STATUS_LABEL[e.status],
      isMe: e.memberId === memberId,
      notes: e.notes ?? null,
    })),
  };
}
