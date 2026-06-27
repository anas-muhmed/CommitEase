import crypto from 'crypto';
import { Prisma, PaymentMode, PaymentStatus, FundAccountType } from '@prisma/client';
import { Workbook } from 'exceljs';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';

// ─── Member code generation ───────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateMemberCode(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const byte of bytes) {
    suffix += CODE_CHARS[byte % CODE_CHARS.length]!;
  }
  return `M-${suffix}`;
}

function isMemberCodeConflict(err: Prisma.PrismaClientKnownRequestError): boolean {
  const target = err.meta?.['target'];
  if (Array.isArray(target)) return (target as string[]).some((t) => String(t).includes('memberCode'));
  if (typeof target === 'string') return target.includes('memberCode');
  return false;
}

// ─── Due engine helpers ───────────────────────────────────────────────────────

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return `${String(year)}-${String(month).padStart(2, '0')}`;
}

// Returns the first day (UTC midnight) of each month from start through end (inclusive).
function generateMonths(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(new Date(Date.UTC(year, month, 1)));
    month++;
    if (month > 11) { month = 0; year++; }
  }

  return months;
}

// Finds the last entry whose effectiveFrom is <= atDate.
// Entries must be sorted ASC by effectiveFrom.
function findActiveEntry<T extends { effectiveFrom: Date }>(
  entries: readonly T[],
  atDate: Date,
): T | undefined {
  let result: T | undefined;
  for (const entry of entries) {
    if (entry.effectiveFrom <= atDate) result = entry;
  }
  return result;
}

// ─── Shared select ────────────────────────────────────────────────────────────

const MEMBER_SELECT = {
  id: true,
  masjidId: true,
  memberCode: true,
  name: true,
  phone: true,
  address: true,
  contributionStartDate: true,
  contributionPlanId: true,
  contributionPlan: { select: { id: true, name: true } },
  openingDueBalance: true,
  appActivated: true,
  lastLoginAt: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateMemberInput {
  name: string;
  phone: string;
  contributionStartDate: string;
  memberCode?: string;
  address?: string;
  openingDueBalance?: number;
  contributionPlanId?: string;
}

// ─── Plan resolution ──────────────────────────────────────────────────────────

async function resolveContributionPlanId(
  masjidId: string,
  contributionPlanId: string | undefined,
): Promise<string> {
  if (contributionPlanId !== undefined) {
    const plan = await prisma.contributionPlan.findUnique({
      where: { id: contributionPlanId, masjidId },
      select: { id: true, active: true },
    });
    if (!plan) throw new ApiError(400, 'Contribution plan not found or does not belong to this masjid.');
    if (!plan.active) throw new ApiError(400, 'Cannot assign member to an inactive contribution plan.');
    return plan.id;
  }

  // Default: oldest active plan (the "General Member" plan is always created first).
  const defaultPlan = await prisma.contributionPlan.findFirst({
    where: { masjidId, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!defaultPlan) throw new ApiError(400, 'No active contribution plan found. Please create a plan first.');
  return defaultPlan.id;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createMember(
  masjidId: string,
  actorId: string,
  input: CreateMemberInput,
) {
  const contributionStartDate = new Date(input.contributionStartDate);
  if (isNaN(contributionStartDate.getTime())) {
    throw new ApiError(400, 'contributionStartDate must be a valid ISO date string (e.g. 2024-01-01).');
  }

  const planId = await resolveContributionPlanId(masjidId, input.contributionPlanId);

  const baseData = {
    masjidId,
    contributionPlanId: planId,
    name: input.name,
    phone: input.phone,
    contributionStartDate,
    ...(input.address !== undefined && { address: input.address }),
    ...(input.openingDueBalance !== undefined && { openingDueBalance: input.openingDueBalance }),
  };

  const runCreate = async (tx: Prisma.TransactionClient, memberCode: string) => {
    const member = await tx.member.create({
      data: { ...baseData, memberCode },
      select: MEMBER_SELECT,
    });
    // Initial plan history record — effectiveFrom = contributionStartDate so the
    // due engine can resolve the correct fee for every month from the start.
    await tx.memberPlanHistory.create({
      data: { memberId: member.id, contributionPlanId: planId, effectiveFrom: contributionStartDate },
    });
    await logAudit(
      { masjidId, actorId, action: 'MEMBER_CREATED', entityType: 'Member', entityId: member.id,
        newValue: { memberCode: member.memberCode, name: member.name, planId } },
      tx,
    );
    return member;
  };

  // Caller-provided code — P2002 on phone/code bubbles to errorHandler as 409.
  if (input.memberCode !== undefined) {
    return prisma.$transaction((tx: Prisma.TransactionClient) =>
      runCreate(tx, input.memberCode!),
    );
  }

  // Auto-generate — retry once on memberCode collision only.
  for (let attempt = 0; attempt < 2; attempt++) {
    const memberCode = generateMemberCode();
    try {
      return await prisma.$transaction((tx: Prisma.TransactionClient) => runCreate(tx, memberCode));
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        isMemberCodeConflict(err) &&
        attempt === 0
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new ApiError(500, 'Failed to generate a unique member code. Please try again.');
}

export async function listMembers(
  masjidId: string,
  query: { page?: number; limit?: number; search?: string; active?: boolean },
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.MemberWhereInput = {
    masjidId,
    ...(query.active !== undefined && { active: query.active }),
    ...(query.search !== undefined && query.search.trim() !== '' && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { memberCode: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [members, total] = await prisma.$transaction([
    prisma.member.findMany({
      where,
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.member.count({ where }),
  ]);

  return { members, total, page, limit };
}

export async function getMemberById(masjidId: string, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: MEMBER_SELECT,
  });
  if (!member) throw new ApiError(404, 'Member not found.');
  return member;
}

export async function updateMember(
  masjidId: string,
  memberId: string,
  actorId: string,
  input: {
    name?: string;
    phone?: string;
    address?: string;
    contributionStartDate?: string;
    openingDueBalance?: number;
  },
) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: {
      id: true, name: true, phone: true, address: true,
      contributionStartDate: true, openingDueBalance: true,
    },
  });
  if (!existing) throw new ApiError(404, 'Member not found.');

  let contributionStartDate: Date | undefined;
  if (input.contributionStartDate !== undefined) {
    contributionStartDate = new Date(input.contributionStartDate);
    if (isNaN(contributionStartDate.getTime())) {
      throw new ApiError(400, 'contributionStartDate must be a valid ISO date string.');
    }
  }

  const affectsDues = input.openingDueBalance !== undefined || input.contributionStartDate !== undefined;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: memberId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.address !== undefined && { address: input.address }),
        ...(contributionStartDate !== undefined && { contributionStartDate }),
        ...(input.openingDueBalance !== undefined && { openingDueBalance: input.openingDueBalance }),
      },
      select: MEMBER_SELECT,
    });

    await logAudit({
      masjidId, actorId, action: 'MEMBER_UPDATED', entityType: 'Member', entityId: memberId,
      oldValue: {
        name: existing.name, phone: existing.phone, address: existing.address ?? null,
        contributionStartDate: existing.contributionStartDate.toISOString(),
      },
      newValue: {
        name: updated.name, phone: updated.phone, address: updated.address ?? null,
        contributionStartDate: updated.contributionStartDate.toISOString(),
      },
    }, tx);

    return updated;
  }).then(result => {
    // Re-cache summary whenever opening balance or start date changes, since those
    // affect totalOutstanding and overdueMonths in the precomputed table.
    if (affectsDues) void upsertMemberSummary(masjidId, memberId);
    return result;
  });
}

export async function deactivateMember(masjidId: string, memberId: string, actorId: string) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: { id: true, active: true },
  });
  if (!existing) throw new ApiError(404, 'Member not found.');
  if (!existing.active) throw new ApiError(409, 'Member is already inactive.');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: memberId },
      data: { active: false },
      select: { id: true, memberCode: true, name: true, active: true },
    });

    await logAudit({
      masjidId, actorId, action: 'MEMBER_DEACTIVATED', entityType: 'Member', entityId: memberId,
      oldValue: { active: true }, newValue: { active: false },
    }, tx);

    return updated;
  });
}

// ─── Health score engine ──────────────────────────────────────────────────────

export type HealthGrade = 'EXCELLENT' | 'GOOD' | 'RISK' | 'CRITICAL';

export function computeHealthScore(
  rows: Array<{ outstanding: string; paid: string; monthlyDue: string }>,
  effectiveOpeningDue: Prisma.Decimal,
  advanceCredit: Prisma.Decimal = new Prisma.Decimal(0),
): { score: number; grade: HealthGrade; overdueMonths: number } {
  const total = rows.length;

  // Apply advance credit FIFO so overpaid members don't show false overdue months.
  let remainingAdvance = advanceCredit;
  let overdueMonths = 0;
  let fullyPaidMonths = 0;

  for (const r of rows) {
    let outstanding = new Prisma.Decimal(r.outstanding);
    const monthlyDue = new Prisma.Decimal(r.monthlyDue);

    if (remainingAdvance.greaterThan(0) && outstanding.greaterThan(0)) {
      const covered = remainingAdvance.lessThanOrEqualTo(outstanding) ? remainingAdvance : outstanding;
      outstanding = outstanding.sub(covered);
      remainingAdvance = remainingAdvance.sub(covered);
    }

    if (outstanding.greaterThan(0)) {
      overdueMonths++;
    } else if (monthlyDue.greaterThan(0)) {
      fullyPaidMonths++;
    }
  }

  if (total === 0 && effectiveOpeningDue.equals(0)) {
    return { score: 100, grade: 'EXCELLENT', overdueMonths: 0 };
  }

  let score = total > 0 ? Math.round((fullyPaidMonths / total) * 100) : 100;

  if (overdueMonths > 6) score = Math.min(score, 39);
  else if (overdueMonths > 2) score = Math.min(score, 64);

  if (effectiveOpeningDue.greaterThan(0)) score = Math.max(0, score - 8);

  score = Math.max(0, Math.min(100, score));

  const grade: HealthGrade = score >= 85 ? 'EXCELLENT' : score >= 65 ? 'GOOD' : score >= 40 ? 'RISK' : 'CRITICAL';
  return { score, grade, overdueMonths };
}

// ─── Due engine ───────────────────────────────────────────────────────────────

export interface ComputeDuesInput {
  openingDueBalance: Prisma.Decimal;
  planHistory: ReadonlyArray<{
    effectiveFrom: Date;
    contributionPlan: {
      name: string;
      feeHistory: ReadonlyArray<{ monthlyFee: Prisma.Decimal; effectiveFrom: Date }>;
    };
  }>;
  paidByMonth: ReadonlyMap<string, Prisma.Decimal>;
  openingBalancePaid: Prisma.Decimal;
  totalPaidFromPayments: Prisma.Decimal;
  contributionStartDate: Date;
  asOfDate?: Date;
}

export interface DuesComputation {
  openingDueBalance: string;
  openingBalancePaid: string;
  effectiveOpeningDue: string;
  rows: Array<{ month: string; planName: string; monthlyDue: string; paid: string; outstanding: string }>;
  totalDue: string;
  totalPaid: string;
  totalOutstanding: string;
  advanceBalance: string;
  overdueMonths: number;
  healthScore: number;
  healthGrade: HealthGrade;
}

// Pure function: no DB access. Both getLedger() and listMembersEnriched() call this
// so the dues formula lives in exactly one place.
export function computeMemberDues(input: ComputeDuesInput): DuesComputation {
  const {
    openingDueBalance, planHistory, paidByMonth, openingBalancePaid,
    totalPaidFromPayments, contributionStartDate, asOfDate = new Date(),
  } = input;

  const effectiveOpeningDue = openingDueBalance.sub(openingBalancePaid).greaterThan(0)
    ? openingDueBalance.sub(openingBalancePaid)
    : new Prisma.Decimal(0);

  const months = generateMonths(contributionStartDate, asOfDate);
  const rows: DuesComputation['rows'] = [];
  let totalMonthlyDue = new Prisma.Decimal(0);

  for (const monthStart of months) {
    const planEntry = findActiveEntry(planHistory, monthStart);
    if (!planEntry) continue;

    const feeEntry = findActiveEntry(planEntry.contributionPlan.feeHistory, monthStart);
    const monthlyDue = feeEntry ? feeEntry.monthlyFee : new Prisma.Decimal(0);
    const key = monthKey(monthStart);
    const paid = paidByMonth.get(key) ?? new Prisma.Decimal(0);

    totalMonthlyDue = totalMonthlyDue.add(monthlyDue);

    rows.push({
      month: key,
      planName: planEntry.contributionPlan.name,
      monthlyDue: monthlyDue.toFixed(2),
      paid: paid.toFixed(2),
      outstanding: monthlyDue.sub(paid).toFixed(2),
    });
  }

  // Use totalPaidFromPayments (Payment.aggregate) — not allocation sum — so
  // advance credit (unallocated overpayment surplus) is correctly accounted for.
  const totalDue = openingDueBalance.add(totalMonthlyDue);
  const net = totalDue.sub(totalPaidFromPayments);
  const totalOutstanding = net.greaterThan(0) ? net : new Prisma.Decimal(0);
  const advanceBalance = net.lessThan(0) ? new Prisma.Decimal(0).sub(net) : new Prisma.Decimal(0);

  const { score, grade, overdueMonths } = computeHealthScore(rows, effectiveOpeningDue, advanceBalance);

  return {
    openingDueBalance: openingDueBalance.toFixed(2),
    openingBalancePaid: openingBalancePaid.toFixed(2),
    effectiveOpeningDue: effectiveOpeningDue.toFixed(2),
    rows,
    totalDue: totalDue.toFixed(2),
    totalPaid: totalPaidFromPayments.toFixed(2),
    totalOutstanding: totalOutstanding.toFixed(2),
    advanceBalance: advanceBalance.toFixed(2),
    overdueMonths,
    healthScore: score,
    healthGrade: grade,
  };
}

export async function getLedger(masjidId: string, memberId: string) {
  const [member, allocations, totalPaidAgg, lastPayment] = await Promise.all([
    prisma.member.findUnique({
      where: { id: memberId, masjidId },
      select: {
        id: true, memberCode: true, name: true, active: true,
        contributionStartDate: true, openingDueBalance: true,
        memberPlanHistory: {
          orderBy: { effectiveFrom: 'asc' },
          select: {
            effectiveFrom: true,
            contributionPlan: {
              select: {
                id: true, name: true,
                feeHistory: {
                  orderBy: { effectiveFrom: 'asc' },
                  select: { monthlyFee: true, effectiveFrom: true },
                },
              },
            },
          },
        },
      },
    }),

    prisma.paymentAllocation.findMany({
      where: { payment: { memberId, masjidId, paymentStatus: PaymentStatus.SUCCESS } },
      select: { contributionMonth: true, amountAllocated: true },
    }),

    // Authoritative total paid — includes advance credit not in allocations.
    prisma.payment.aggregate({
      where: { memberId, masjidId, paymentStatus: PaymentStatus.SUCCESS },
      _sum: { amount: true },
    }),

    prisma.payment.findFirst({
      where: { memberId, masjidId, paymentStatus: PaymentStatus.SUCCESS },
      select: { paymentDate: true, createdAt: true },
      orderBy: { paymentDate: 'desc' },
    }),
  ]);

  if (!member) throw new ApiError(404, 'Member not found.');

  const paidByMonth = new Map<string, Prisma.Decimal>();
  let openingBalancePaid = new Prisma.Decimal(0);
  for (const alloc of allocations) {
    if (alloc.contributionMonth === null) {
      openingBalancePaid = openingBalancePaid.add(alloc.amountAllocated);
    } else {
      const key = monthKey(alloc.contributionMonth);
      paidByMonth.set(key, (paidByMonth.get(key) ?? new Prisma.Decimal(0)).add(alloc.amountAllocated));
    }
  }

  const totalPaidFromPayments = totalPaidAgg._sum.amount ?? new Prisma.Decimal(0);
  const lastPaymentDate = (lastPayment?.paymentDate ?? lastPayment?.createdAt)?.toISOString() ?? null;

  const dues = computeMemberDues({
    openingDueBalance: member.openingDueBalance,
    planHistory: member.memberPlanHistory,
    paidByMonth,
    openingBalancePaid,
    totalPaidFromPayments,
    contributionStartDate: member.contributionStartDate,
  });

  return {
    memberId: member.id,
    memberCode: member.memberCode,
    name: member.name,
    active: member.active,
    lastPaymentDate,
    ...dues,
  };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_TO_MODE: Record<FundAccountType, PaymentMode> = {
  CASH: PaymentMode.CASH,
  BANK: PaymentMode.BANK_TRANSFER,
  UPI:  PaymentMode.UPI,
};

export async function recordPayment(
  masjidId: string,
  memberId: string,
  actorId: string,
  input: { amount: number; paymentDate: string; note?: string; fundAccountId?: string },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ApiError(400, 'amount must be a positive number.');
  }

  const paymentDate = new Date(input.paymentDate);
  if (isNaN(paymentDate.getTime())) {
    throw new ApiError(400, 'paymentDate must be a valid ISO date string.');
  }

  // Verify member exists and belongs to this masjid.
  const memberCheck = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: { id: true, active: true },
  });
  if (!memberCheck) throw new ApiError(404, 'Member not found.');

  // Auto-select default fund account so every payment is treasury-tracked.
  const resolvedFundAccountId = input.fundAccountId ?? await (async () => {
    const def = await prisma.fundAccount.findFirst({
      where: { masjidId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return def?.id;
  })();

  // FIFO allocation: old due first, then oldest monthly dues, remainder = advance.
  const ledger = await getLedger(masjidId, memberId);

  let remaining = new Prisma.Decimal(input.amount);
  const allocations: Array<{ contributionMonth: Date | null; amountAllocated: Prisma.Decimal }> = [];

  // Priority 1: clear outstanding opening balance (null month = old-due allocation).
  const effectiveOldDue = new Prisma.Decimal(ledger.effectiveOpeningDue);
  if (effectiveOldDue.greaterThan(0)) {
    const toOld = remaining.lessThanOrEqualTo(effectiveOldDue) ? remaining : effectiveOldDue;
    allocations.push({ contributionMonth: null, amountAllocated: toOld });
    remaining = remaining.sub(toOld);
  }

  // Priority 2: clear oldest monthly dues (FIFO).
  for (const row of ledger.rows) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const outstanding = new Prisma.Decimal(row.outstanding);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    const allocated = remaining.lessThanOrEqualTo(outstanding) ? remaining : outstanding;
    allocations.push({
      contributionMonth: new Date(`${row.month}-01T00:00:00.000Z`),
      amountAllocated: allocated,
    });
    remaining = remaining.sub(allocated);
  }
  // remaining = advance credit (excess beyond all dues — no allocation record needed)

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Verify fund account inside the transaction for consistency.
    let fundAccount: { id: string; name: string; type: FundAccountType } | null = null;
    if (resolvedFundAccountId) {
      fundAccount = await tx.fundAccount.findFirst({
        where: { id: resolvedFundAccountId, masjidId, active: true },
        select: { id: true, name: true, type: true },
      });
      if (!fundAccount) throw new ApiError(404, 'Selected money source not found or inactive.');
    }

    const paymentMode = fundAccount ? ACCOUNT_TYPE_TO_MODE[fundAccount.type] : PaymentMode.CASH;

    // Atomic receipt counter via UPSERT — prevents TOCTOU race under concurrent writes.
    await tx.$executeRaw`
      INSERT INTO "ReceiptSequence" ("masjidId", "lastNumber")
      VALUES (${masjidId}, 1)
      ON CONFLICT ("masjidId") DO UPDATE
      SET "lastNumber" = "ReceiptSequence"."lastNumber" + 1
    `;
    const seq = await tx.receiptSequence.findUniqueOrThrow({
      where: { masjidId },
      select: { lastNumber: true },
    });
    const receiptNumber = `RCP-${String(seq.lastNumber).padStart(5, '0')}`;

    const payment = await tx.payment.create({
      data: {
        masjidId,
        memberId,
        amount: input.amount,
        paymentMode,
        paymentStatus: PaymentStatus.SUCCESS,
        paymentDate,
        recordedByUserId: actorId,
        ...(input.note !== undefined && { note: input.note }),
        ...(fundAccount ? { fundAccountId: fundAccount.id } : {}),
        allocations: {
          create: allocations.map((a) => ({
            contributionMonth: a.contributionMonth,
            amountAllocated: a.amountAllocated,
          })),
        },
      },
      select: {
        id: true, amount: true, paymentMode: true, paymentStatus: true,
        paymentDate: true, note: true, createdAt: true,
        allocations: { select: { contributionMonth: true, amountAllocated: true } },
      },
    });

    // If a money source was selected, credit it and write a INCOME ledger entry.
    if (fundAccount) {
      await tx.fundAccount.update({
        where: { id: fundAccount.id },
        data: { currentBalance: { increment: new Prisma.Decimal(input.amount) } },
      });
      await tx.treasuryLedger.create({
        data: {
          masjidId,
          accountId: fundAccount.id,
          entryType: 'INCOME',
          direction: 'CREDIT',
          amount: new Prisma.Decimal(input.amount),
          note: `Payment received — ${input.note ?? receiptNumber}`,
          referenceId: payment.id,
          referenceType: 'PAYMENT',
          createdByUserId: actorId,
        },
      });
    }

    const receipt = await tx.receipt.create({
      data: { masjidId, paymentId: payment.id, receiptNumber },
      select: { id: true, receiptNumber: true, generatedAt: true },
    });

    await logAudit({
      masjidId, actorId, action: 'PAYMENT_RECORDED', entityType: 'Payment', entityId: payment.id,
      newValue: {
        amount: String(input.amount),
        receiptNumber,
        allocatedMonths: allocations.length,
        unallocated: remaining.toFixed(2),
        ...(fundAccount ? { fundAccount: fundAccount.name } : {}),
      },
    }, tx);

    return { payment, receipt, unallocatedAmount: remaining.toFixed(2) };
  }).then(result => {
    // Refresh the precomputed summary after transaction commits
    void upsertMemberSummary(masjidId, memberId);
    return result;
  });
}

export async function getPaymentHistory(masjidId: string, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: { id: true },
  });
  if (!member) throw new ApiError(404, 'Member not found.');

  return prisma.payment.findMany({
    where: { memberId, masjidId },
    select: {
      id: true, amount: true, paymentMode: true, paymentStatus: true,
      paymentDate: true, note: true, createdAt: true,
      allocations: {
        select: { contributionMonth: true, amountAllocated: true },
        orderBy: { contributionMonth: 'asc' },
      },
      receipt: { select: { receiptNumber: true, generatedAt: true, voidedAt: true } },
      reversal: { select: { reason: true, reversedAt: true, actor: { select: { name: true } } } },
      recordedByUser: { select: { name: true } },
      fundAccount: { select: { name: true, type: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Enriched member list (3-query batch — no N+1) ────────────────────────────
// Returns all members with computed outstanding, health score, last payment date.
// Used by the members list page for sorting/filtering by financial state.

export async function listMembersEnriched(masjidId: string) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Five parallel queries; paidThisMonth is always live (avoids month-boundary stale).
  const [members, allAllocations, lastPaymentRows, paidThisMonthRows, memberSummaries] = await Promise.all([
    prisma.member.findMany({
      where: { masjidId },
      select: {
        id: true, memberCode: true, name: true, phone: true, address: true,
        active: true, contributionStartDate: true, openingDueBalance: true,
        createdAt: true, contributionPlanId: true,
        contributionPlan: { select: { id: true, name: true } },
        memberPlanHistory: {
          orderBy: { effectiveFrom: 'asc' },
          select: {
            effectiveFrom: true,
            contributionPlan: {
              select: {
                id: true, name: true,
                feeHistory: {
                  orderBy: { effectiveFrom: 'asc' },
                  select: { monthlyFee: true, effectiveFrom: true },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.paymentAllocation.findMany({
      where: { payment: { masjidId, paymentStatus: PaymentStatus.SUCCESS } },
      select: {
        payment: { select: { memberId: true } },
        contributionMonth: true,
        amountAllocated: true,
      },
    }),

    prisma.payment.groupBy({
      by: ['memberId'],
      where: { masjidId, paymentStatus: PaymentStatus.SUCCESS },
      _max: { paymentDate: true },
      _sum: { amount: true },
    }),

    prisma.payment.findMany({
      where: { masjidId, paymentStatus: PaymentStatus.SUCCESS, paymentDate: { gte: monthStart } },
      select: { memberId: true },
      distinct: ['memberId'],
    }),

    // Precomputed summary fast-path — skips per-member computation for most members.
    prisma.memberFinancialSummary.findMany({
      where: { member: { masjidId } },
      select: {
        memberId: true, totalOutstanding: true, overdueMonths: true,
        healthScore: true, healthGrade: true, lastPaymentAt: true, totalPaidLifetime: true,
      },
    }),
  ]);

  // Index maps for the live fallback path.
  const allocsByMember = new Map<string, Map<string, Prisma.Decimal>>();
  const openingPaidByMember = new Map<string, Prisma.Decimal>();
  for (const alloc of allAllocations) {
    const mid = alloc.payment.memberId;
    if (alloc.contributionMonth === null) {
      openingPaidByMember.set(mid, (openingPaidByMember.get(mid) ?? new Prisma.Decimal(0)).add(alloc.amountAllocated));
    } else {
      if (!allocsByMember.has(mid)) allocsByMember.set(mid, new Map());
      const key = monthKey(alloc.contributionMonth);
      allocsByMember.get(mid)!.set(key, (allocsByMember.get(mid)!.get(key) ?? new Prisma.Decimal(0)).add(alloc.amountAllocated));
    }
  }

  const lastPaymentMap = new Map<string, { date: string | null; totalPaid: Prisma.Decimal }>();
  for (const row of lastPaymentRows) {
    lastPaymentMap.set(row.memberId, {
      date: row._max.paymentDate?.toISOString() ?? null,
      totalPaid: row._sum.amount ?? new Prisma.Decimal(0),
    });
  }

  const summaryMap = new Map(memberSummaries.map(s => [s.memberId, s]));
  const paidThisMonthSet = new Set(paidThisMonthRows.map(p => p.memberId));

  let overdueCount = 0, payingOnTimeCount = 0;
  let totalReceivable = new Prisma.Decimal(0);

  const enriched = members.map(m => {
    const summary = summaryMap.get(m.id);
    const lastPmt = lastPaymentMap.get(m.id);
    const paidThisMonth = paidThisMonthSet.has(m.id);

    let totalOutstanding: Prisma.Decimal;
    let overdueMonths: number;
    let healthScore: number;
    let healthGrade: HealthGrade;
    let lastPaymentDate: string | null;
    let totalPaidLifetime: string;

    if (summary) {
      // Fast-path: use precomputed summary (avoids per-member month enumeration).
      totalOutstanding = summary.totalOutstanding;
      overdueMonths = summary.overdueMonths;
      healthScore = summary.healthScore;
      healthGrade = summary.healthGrade as HealthGrade;
      lastPaymentDate = summary.lastPaymentAt?.toISOString() ?? null;
      totalPaidLifetime = summary.totalPaidLifetime.toFixed(2);
    } else {
      // Fallback: live computation (new members, or summary not yet populated).
      const paidByMonth = allocsByMember.get(m.id) ?? new Map<string, Prisma.Decimal>();
      const openingBalancePaid = openingPaidByMember.get(m.id) ?? new Prisma.Decimal(0);
      const totalPaidFromPayments = lastPmt?.totalPaid ?? new Prisma.Decimal(0);

      const dues = computeMemberDues({
        openingDueBalance: m.openingDueBalance,
        planHistory: m.memberPlanHistory,
        paidByMonth,
        openingBalancePaid,
        totalPaidFromPayments,
        contributionStartDate: m.contributionStartDate,
        asOfDate: now,
      });

      totalOutstanding = new Prisma.Decimal(dues.totalOutstanding);
      overdueMonths = dues.overdueMonths;
      healthScore = dues.healthScore;
      healthGrade = dues.healthGrade;
      lastPaymentDate = lastPmt?.date ?? null;
      totalPaidLifetime = dues.totalPaid;
    }

    if (m.active) {
      if (totalOutstanding.greaterThan(0)) {
        overdueCount++;
        totalReceivable = totalReceivable.add(totalOutstanding);
      } else {
        payingOnTimeCount++;
      }
    }

    return {
      id: m.id, memberCode: m.memberCode, name: m.name, phone: m.phone, address: m.address,
      active: m.active, contributionPlanId: m.contributionPlanId, contributionPlan: m.contributionPlan,
      contributionStartDate: m.contributionStartDate.toISOString(),
      openingDueBalance: m.openingDueBalance.toFixed(2),
      createdAt: m.createdAt.toISOString(),
      totalOutstanding: totalOutstanding.toFixed(2),
      overdueMonths, healthScore, healthGrade,
      lastPaymentDate,
      totalPaidLifetime,
      paidThisMonth,
    };
  });

  const activeCount = members.filter(m => m.active).length;
  const payingOnTimePercent = activeCount > 0 ? Math.round((payingOnTimeCount / activeCount) * 100) : 0;

  return {
    members: enriched,
    summary: {
      total: members.length,
      activeMembers: activeCount,
      overdueCount,
      payingOnTimePercent,
      totalReceivable: totalReceivable.toFixed(2),
    },
  };
}

// ─── Reactivate member ────────────────────────────────────────────────────────

export async function reactivateMember(masjidId: string, memberId: string, actorId: string) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: { id: true, active: true },
  });
  if (!existing) throw new ApiError(404, 'Member not found.');
  if (existing.active) throw new ApiError(409, 'Member is already active.');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.member.update({
      where: { id: memberId },
      data: { active: true },
      select: { id: true, memberCode: true, name: true, active: true },
    });
    await logAudit({
      masjidId, actorId, action: 'MEMBER_REACTIVATED', entityType: 'Member', entityId: memberId,
      oldValue: { active: false }, newValue: { active: true },
    }, tx);
    return updated;
  });
}

// ─── Precomputed summary cache ────────────────────────────────────────────────
// Fire-and-forget after payment events. Keeps the MemberFinancialSummary table
// warm so future list queries can skip the full ledger computation.

export async function upsertMemberSummary(masjidId: string, memberId: string): Promise<void> {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // getLedger already runs the payment aggregate; reuse totalPaid from it.
    const [ledger, paidThisMonthRow] = await Promise.all([
      getLedger(masjidId, memberId),
      prisma.payment.findFirst({
        where: { memberId, masjidId, paymentStatus: PaymentStatus.SUCCESS, paymentDate: { gte: monthStart } },
        select: { id: true },
      }),
    ]);

    const summary = {
      masjidId,
      totalOutstanding: new Prisma.Decimal(ledger.totalOutstanding),
      overdueMonths: ledger.overdueMonths,
      healthScore: ledger.healthScore,
      healthGrade: ledger.healthGrade,
      lastPaymentAt: ledger.lastPaymentDate ? new Date(ledger.lastPaymentDate) : null,
      totalPaidLifetime: new Prisma.Decimal(ledger.totalPaid),
      paidThisMonth: !!paidThisMonthRow,
      computedAt: now,
    };

    await prisma.memberFinancialSummary.upsert({
      where: { memberId },
      create: { memberId, ...summary },
      update: summary,
    });
  } catch (err) {
    console.error('[upsertMemberSummary] failed:', err);
  }
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String((value as { text: unknown }).text ?? '').trim();
    if ('result' in value) return cellToString((value as { result?: unknown }).result);
    if ('error' in value) return '';
  }
  return '';
}

export interface BulkImportError {
  row: number;
  message: string;
}

export async function bulkImportMembers(
  masjidId: string,
  actorId: string,
  fileBuffer: Buffer,
): Promise<{ created: number; errors: BulkImportError[] }> {
  const workbook = new Workbook();
  const ab = new ArrayBuffer(fileBuffer.byteLength);
  new Uint8Array(ab).set(fileBuffer);
  await workbook.xlsx.load(ab);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ApiError(400, 'Excel file contains no worksheets.');

  const headerMap = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellToString(cell.value).toLowerCase().replace(/\s+/g, '');
    if (header) headerMap.set(header, colNumber);
  });

  const requiredHeaders = ['name', 'phone', 'contributionstartdate'];
  const missing = requiredHeaders.filter((h) => !headerMap.has(h));
  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Excel file is missing required columns: ${missing.join(', ')}. ` +
      `Expected headers: name, phone, contributionStartDate, ` +
      `memberCode (optional), address (optional), openingDueBalance (optional), planName (optional).`,
    );
  }

  // Pre-load all active plans for plan-name lookup.
  const plans = await prisma.contributionPlan.findMany({
    where: { masjidId, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  const plansByName = new Map(plans.map((p) => [p.name.toLowerCase(), p.id]));
  const defaultPlanId = plans[0]?.id;
  if (!defaultPlanId) throw new ApiError(400, 'No active contribution plan found for this masjid.');

  const errors: BulkImportError[] = [];
  let created = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const getCell = (header: string): string => {
      const col = headerMap.get(header);
      return col !== undefined ? cellToString(row.getCell(col).value) : '';
    };

    const name = getCell('name');
    const phone = getCell('phone');
    const contributionStartDate = getCell('contributionstartdate');
    const memberCodeRaw = getCell('membercode');
    const addressRaw = getCell('address');
    const openingDueBalanceRaw = getCell('openingduebalance');
    const planNameRaw = getCell('planname');

    if (!name && !phone && !contributionStartDate) continue; // blank row

    if (!name) { errors.push({ row: rowNumber, message: 'name is required.' }); continue; }
    if (!phone) { errors.push({ row: rowNumber, message: 'phone is required.' }); continue; }
    if (!contributionStartDate) { errors.push({ row: rowNumber, message: 'contributionStartDate is required.' }); continue; }

    if (isNaN(new Date(contributionStartDate).getTime())) {
      errors.push({ row: rowNumber, message: `contributionStartDate "${contributionStartDate}" is not a valid date (use YYYY-MM-DD).` });
      continue;
    }

    let openingDueBalance: number | undefined;
    if (openingDueBalanceRaw !== '') {
      const parsed = Number(openingDueBalanceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push({ row: rowNumber, message: `openingDueBalance "${openingDueBalanceRaw}" must be a non-negative number.` });
        continue;
      }
      openingDueBalance = parsed;
    }

    let contributionPlanId: string = defaultPlanId;
    if (planNameRaw) {
      const found = plansByName.get(planNameRaw.toLowerCase());
      if (!found) {
        errors.push({ row: rowNumber, message: `Plan "${planNameRaw}" not found or inactive in this masjid.` });
        continue;
      }
      contributionPlanId = found;
    }

    try {
      await createMember(masjidId, actorId, {
        name,
        phone,
        contributionStartDate,
        contributionPlanId,
        ...(memberCodeRaw ? { memberCode: memberCodeRaw } : {}),
        ...(addressRaw ? { address: addressRaw } : {}),
        ...(openingDueBalance !== undefined && { openingDueBalance }),
      });
      created++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        errors.push({ row: rowNumber, message: 'A member with this phone or member code already exists in this masjid.' });
      } else if (err instanceof ApiError) {
        errors.push({ row: rowNumber, message: err.message });
      } else {
        errors.push({ row: rowNumber, message: 'Unexpected error creating member.' });
      }
    }
  }

  return { created, errors };
}
