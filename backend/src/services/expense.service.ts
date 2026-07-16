import { Prisma, ExpenseCategory, ExpenseType } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';

/* ─── Create expense ─────────────────────────────────────────────────────── */

export async function createExpense(
  masjidId: string,
  actorId: string,
  input: {
    expenseType: ExpenseType;
    category: ExpenseCategory;
    amount: number;
    description?: string;
    // MOSQUE_PAID
    fundAccountId?: string;
    // PERSONAL_PAID
    paidByUserId?: string;
  },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ApiError(400, 'amount must be a positive number.');
  }

  const amt = new Prisma.Decimal(input.amount);

  if (input.expenseType === 'MOSQUE_PAID') {
    if (!input.fundAccountId) throw new ApiError(400, 'fundAccountId is required for MOSQUE_PAID expenses.');

    return prisma.$transaction(async (tx) => {
      const account = await tx.fundAccount.findFirst({
        where: { id: input.fundAccountId!, masjidId, active: true },
        select: { id: true, name: true, currentBalance: true },
      });
      if (!account) throw new ApiError(404, 'Money source not found or inactive.');

      if (new Prisma.Decimal(account.currentBalance).lessThan(amt)) {
        throw new ApiError(400, `Insufficient balance in ${account.name}.`);
      }

      const expense = await tx.expense.create({
        data: {
          masjidId,
          expenseType: 'MOSQUE_PAID',
          status: 'SETTLED',
          category: input.category,
          amount: amt,
          ...(input.description ? { description: input.description } : {}),
          fundAccountId: account.id,
          recordedByUserId: actorId,
        },
      });

      await tx.fundAccount.update({
        where: { id: account.id },
        data: { currentBalance: { decrement: amt } },
      });

      await tx.treasuryLedger.create({
        data: {
          masjidId,
          accountId: account.id,
          entryType: 'EXPENSE',
          direction: 'DEBIT',
          amount: amt,
          note: `${input.category}${input.description ? ` — ${input.description}` : ''}`,
          referenceId: expense.id,
          referenceType: 'EXPENSE',
          createdByUserId: actorId,
        },
      });

      await logAudit({
        masjidId, actorId,
        action: 'EXPENSE_RECORDED',
        entityType: 'Expense', entityId: expense.id,
        newValue: { type: 'MOSQUE_PAID', category: input.category, amount: amt.toFixed(2), account: account.name },
      }, tx);

      return expense;
    });
  }

  // PERSONAL_PAID
  if (!input.paidByUserId) throw new ApiError(400, 'paidByUserId is required for PERSONAL_PAID expenses.');

  const paidBy = await prisma.user.findFirst({
    where: { id: input.paidByUserId, masjidId },
    select: { id: true, name: true },
  });
  if (!paidBy) throw new ApiError(404, 'Committee member not found.');

  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        masjidId,
        expenseType: 'PERSONAL_PAID',
        status: 'PENDING_REIMB',
        category: input.category,
        amount: amt,
        ...(input.description ? { description: input.description } : {}),
        paidByUserId: paidBy.id,
        recordedByUserId: actorId,
      },
    });

    await logAudit({
      masjidId, actorId,
      action: 'EXPENSE_RECORDED',
      entityType: 'Expense', entityId: expense.id,
      newValue: { type: 'PERSONAL_PAID', category: input.category, amount: amt.toFixed(2), paidBy: paidBy.name },
    }, tx);

    return expense;
  });
}

/* ─── Reimburse expense ──────────────────────────────────────────────────── */

export async function reimburseExpense(
  masjidId: string,
  expenseId: string,
  actorId: string,
  input: { fundAccountId: string; note?: string },
) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, masjidId },
    include: { paidBy: { select: { name: true } } },
  });
  if (!expense) throw new ApiError(404, 'Expense not found.');
  if (expense.expenseType !== 'PERSONAL_PAID') {
    throw new ApiError(400, 'Only PERSONAL_PAID expenses can be reimbursed.');
  }
  if (expense.status === 'REIMBURSED') {
    throw new ApiError(409, 'This expense has already been reimbursed.');
  }

  const amt = new Prisma.Decimal(expense.amount);

  return prisma.$transaction(async (tx) => {
    const account = await tx.fundAccount.findFirst({
      where: { id: input.fundAccountId, masjidId, active: true },
      select: { id: true, name: true, currentBalance: true },
    });
    if (!account) throw new ApiError(404, 'Money source not found or inactive.');

    if (new Prisma.Decimal(account.currentBalance).lessThan(amt)) {
      throw new ApiError(400, `Insufficient balance in ${account.name} for reimbursement.`);
    }

    const updated = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: 'REIMBURSED',
        reimbursedAt: new Date(),
        reimbursedFromId: account.id,
      },
    });

    await tx.fundAccount.update({
      where: { id: account.id },
      data: { currentBalance: { decrement: amt } },
    });

    await tx.treasuryLedger.create({
      data: {
        masjidId,
        accountId: account.id,
        entryType: 'REIMBURSEMENT',
        direction: 'DEBIT',
        amount: amt,
        note: `Reimb. to ${expense.paidBy?.name ?? 'member'}${input.note ? ` — ${input.note}` : ''}`,
        referenceId: expenseId,
        referenceType: 'EXPENSE',
        createdByUserId: actorId,
      },
    });

    await logAudit({
      masjidId, actorId,
      action: 'EXPENSE_REIMBURSED',
      entityType: 'Expense', entityId: expenseId,
      newValue: { fundAccount: account.name, amount: amt.toFixed(2) },
    }, tx);

    return updated;
  });
}

/* ─── List expenses ──────────────────────────────────────────────────────── */

export async function listExpenses(
  masjidId: string,
  options: { status?: string; category?: ExpenseCategory } = {},
) {
  return prisma.expense.findMany({
    where: {
      masjidId,
      ...(options.status   ? { status:   options.status   as 'SETTLED' | 'PENDING_REIMB' | 'REIMBURSED' } : {}),
      ...(options.category ? { category: options.category } : {}),
    },
    select: {
      id: true,
      expenseType: true,
      status: true,
      category: true,
      amount: true,
      description: true,
      createdAt: true,
      reimbursedAt: true,
      fundAccount:    { select: { id: true, name: true, type: true } },
      reimbursedFrom: { select: { id: true, name: true } },
      paidBy:         { select: { id: true, name: true } },
      recordedBy:     { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

/* ─── Pending reimbursement summary (used in treasury snapshot) ──────────── */

export async function getPendingReimbursementsSummary(masjidId: string) {
  const result = await prisma.expense.aggregate({
    where: { masjidId, status: 'PENDING_REIMB' },
    _sum:   { amount: true },
    _count: { id: true },
  });

  return {
    total: (result._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    count: result._count.id,
  };
}
