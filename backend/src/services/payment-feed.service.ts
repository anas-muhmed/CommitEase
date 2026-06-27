import { Prisma, PaymentMode, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';

const ALLOWED_STATUSES = new Set<string>(Object.values(PaymentStatus));
const ALLOWED_MODES    = new Set<string>(Object.values(PaymentMode));

export interface PaymentFeedOptions {
  status?:   string;
  mode?:     string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
}

export async function getPaymentFeed(masjidId: string, opts: PaymentFeedOptions = {}) {
  const page  = Math.max(1, opts.page  ?? 1);
  const limit = Math.min(50, Math.max(5, opts.limit ?? 25));
  const skip  = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = { masjidId };

  if (opts.status && ALLOWED_STATUSES.has(opts.status)) {
    where.paymentStatus = opts.status as PaymentStatus;
  }
  if (opts.mode && ALLOWED_MODES.has(opts.mode)) {
    where.paymentMode = opts.mode as PaymentMode;
  }
  if (opts.dateFrom || opts.dateTo) {
    where.createdAt = {
      ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
      ...(opts.dateTo   ? { lt:  new Date(opts.dateTo)   } : {}),
    };
  }

  const select = {
    id:             true,
    amount:         true,
    paymentMode:    true,
    paymentStatus:  true,
    paymentDate:    true,
    note:           true,
    createdAt:      true,
    member:         { select: { id: true, name: true, memberCode: true, phone: true } },
    fundAccount:    { select: { id: true, name: true, type: true } },
    receipt:        { select: { receiptNumber: true, voidedAt: true } },
    reversal:       { select: { reason: true, reversedAt: true } },
    recordedByUser: { select: { name: true } },
    allocations: {
      select: { contributionMonth: true, amountAllocated: true },
      orderBy: { contributionMonth: 'asc' as const },
    },
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, select }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map(p => ({
      ...p,
      amount: p.amount.toFixed(2),
      allocations: p.allocations.map(a => ({
        contributionMonth: a.contributionMonth ? a.contributionMonth.toISOString().slice(0, 7) : null,
        amountAllocated:   a.amountAllocated.toFixed(2),
      })),
    })),
    total,
    page,
    limit,
  };
}

export async function getPaymentKpi(masjidId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  const [collected, pendingCount, reversedToday] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        masjidId,
        paymentStatus: PaymentStatus.SUCCESS,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      _sum:   { amount: true },
      _count: { id: true },
    }),
    prisma.payment.count({
      where: { masjidId, paymentStatus: PaymentStatus.PENDING },
    }),
    prisma.paymentReversal.count({
      where: { masjidId, reversedAt: { gte: todayStart, lt: todayEnd } },
    }),
  ]);

  return {
    todayCollected:     (collected._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    todayCount:         collected._count.id,
    pendingCount,
    reversedTodayCount: reversedToday,
  };
}
