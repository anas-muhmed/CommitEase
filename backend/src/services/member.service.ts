import crypto from 'crypto';
import { Prisma, PaymentMode, PaymentStatus } from '@prisma/client';
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

  const updated = await prisma.member.update({
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
  });

  return updated;
}

export async function deactivateMember(masjidId: string, memberId: string, actorId: string) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: { id: true, active: true },
  });
  if (!existing) throw new ApiError(404, 'Member not found.');
  if (!existing.active) throw new ApiError(409, 'Member is already inactive.');

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { active: false },
    select: { id: true, memberCode: true, name: true, active: true },
  });

  await logAudit({
    masjidId, actorId, action: 'MEMBER_DEACTIVATED', entityType: 'Member', entityId: memberId,
    oldValue: { active: true }, newValue: { active: false },
  });

  return updated;
}

// ─── Due engine ───────────────────────────────────────────────────────────────

export async function getLedger(masjidId: string, memberId: string) {
  const member = await prisma.member.findUnique({
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
  });
  if (!member) throw new ApiError(404, 'Member not found.');

  // All SUCCESS payment allocations for this member.
  const allocations = await prisma.paymentAllocation.findMany({
    where: { payment: { memberId, masjidId, paymentStatus: PaymentStatus.SUCCESS } },
    select: { contributionMonth: true, amountAllocated: true },
  });

  // Map "YYYY-MM" → total paid that month.
  const paidByMonth = new Map<string, Prisma.Decimal>();
  for (const alloc of allocations) {
    const key = monthKey(alloc.contributionMonth);
    const prev = paidByMonth.get(key) ?? new Prisma.Decimal(0);
    paidByMonth.set(key, prev.add(alloc.amountAllocated));
  }

  const months = generateMonths(member.contributionStartDate, new Date());

  const rows: Array<{
    month: string;
    planName: string;
    monthlyDue: string;
    paid: string;
    outstanding: string;
  }> = [];

  let totalDue = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);

  for (const monthStart of months) {
    // Point-in-time plan lookup: which plan was the member on at this month?
    const planEntry = findActiveEntry(member.memberPlanHistory, monthStart);
    if (!planEntry) continue; // No plan history seeded yet (shouldn't happen post-Phase 6).

    // Point-in-time fee lookup: what was that plan's fee at this month?
    const feeEntry = findActiveEntry(planEntry.contributionPlan.feeHistory, monthStart);
    const monthlyDue = feeEntry ? feeEntry.monthlyFee : new Prisma.Decimal(0);

    const key = monthKey(monthStart);
    const paid = paidByMonth.get(key) ?? new Prisma.Decimal(0);
    const outstanding = monthlyDue.sub(paid);

    totalDue = totalDue.add(monthlyDue);
    totalPaid = totalPaid.add(paid);

    rows.push({
      month: key,
      planName: planEntry.contributionPlan.name,
      monthlyDue: monthlyDue.toFixed(2),
      paid: paid.toFixed(2),
      outstanding: outstanding.toFixed(2),
    });
  }

  // Opening due balance is historical debt that predates the system.
  // Payments allocate to contribution months (FIFO); opening balance reduces
  // in the total but is not tracked via PaymentAllocation.
  const openingDue = member.openingDueBalance;
  const totalOutstanding = openingDue.add(totalDue).sub(totalPaid);

  return {
    memberId: member.id,
    memberCode: member.memberCode,
    name: member.name,
    openingDueBalance: openingDue.toFixed(2),
    rows,
    totalDue: totalDue.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    totalOutstanding: totalOutstanding.toFixed(2),
  };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function recordPayment(
  masjidId: string,
  memberId: string,
  actorId: string,
  input: { amount: number; paymentDate: string; note?: string },
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

  // FIFO allocation: get outstanding months from the ledger.
  const ledger = await getLedger(masjidId, memberId);

  let remaining = new Prisma.Decimal(input.amount);
  const allocations: Array<{ contributionMonth: Date; amountAllocated: Prisma.Decimal }> = [];

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

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Receipt number is count-based inside the transaction; unique constraint
    // catches any race condition (acceptable for Phase 6 low-volume).
    const receiptCount = await tx.receipt.count({ where: { masjidId } });
    const receiptNumber = `RCP-${String(receiptCount + 1).padStart(5, '0')}`;

    const payment = await tx.payment.create({
      data: {
        masjidId,
        memberId,
        amount: input.amount,
        paymentMode: PaymentMode.CASH,
        paymentStatus: PaymentStatus.SUCCESS,
        paymentDate,
        recordedByUserId: actorId,
        ...(input.note !== undefined && { note: input.note }),
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
      },
    }, tx);

    return { payment, receipt, unallocatedAmount: remaining.toFixed(2) };
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
    },
    orderBy: { createdAt: 'desc' },
  });
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
