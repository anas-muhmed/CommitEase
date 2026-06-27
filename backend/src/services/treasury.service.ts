import { Prisma, FundAccountType, LedgerDirection } from '@prisma/client';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

type TreasuryEntryFilter = 'INCOME' | 'EXPENSE' | 'REIMBURSEMENT' | 'RESERVE_IN' | 'RESERVE_OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'REVERSAL';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';

/* ─── Fund Accounts ───────────────────────────────────────────────────────── */

export async function createFundAccount(
  masjidId: string,
  data: { name: string; type: FundAccountType },
  actorId: string,
) {
  const existing = await prisma.fundAccount.findFirst({
    where: { masjidId, name: { equals: data.name, mode: 'insensitive' }, active: true },
  });
  if (existing) throw new ApiError(409, `A fund account named "${data.name}" already exists.`);

  return prisma.$transaction(async (tx) => {
    const account = await tx.fundAccount.create({
      data: { masjidId, name: data.name, type: data.type, createdByUserId: actorId },
    });

    await logAudit({
      masjidId, actorId,
      action: 'FUND_ACCOUNT_CREATED',
      entityType: 'FundAccount', entityId: account.id,
      newValue: { name: data.name, type: data.type, balance: '0.00' },
    }, tx);

    return account;
  });
}

export async function listFundAccounts(masjidId: string) {
  const accounts = await prisma.fundAccount.findMany({
    where: { masjidId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, type: true, currentBalance: true, active: true, createdAt: true, updatedAt: true },
  });

  const ledgerCounts = await prisma.treasuryLedger.groupBy({
    by: ['accountId'],
    where: { accountId: { in: accounts.map(a => a.id) } },
    _count: { id: true },
  });
  const ledgerMap = new Map(ledgerCounts.map(l => [l.accountId, l._count.id]));

  return accounts.map(a => ({
    ...a,
    deleteEligible: new Prisma.Decimal(a.currentBalance).equals(0) && (ledgerMap.get(a.id) ?? 0) === 0,
  }));
}

export async function getFundAccount(masjidId: string, id: string) {
  const account = await prisma.fundAccount.findFirst({ where: { id, masjidId } });
  if (!account) throw new ApiError(404, 'Fund account not found.');
  return account;
}

export async function updateFundAccount(
  masjidId: string,
  id: string,
  data: { name?: string; active?: boolean },
  actorId: string,
) {
  const account = await prisma.fundAccount.findFirst({ where: { id, masjidId } });
  if (!account) throw new ApiError(404, 'Fund account not found.');

  if (data.active === false && new Prisma.Decimal(account.currentBalance).greaterThan(0)) {
    throw new ApiError(400, 'Cannot deactivate an account with a non-zero balance. Clear the balance first.');
  }

  if (data.name && data.name.toLowerCase() !== account.name.toLowerCase()) {
    const dupe = await prisma.fundAccount.findFirst({
      where: { masjidId, name: { equals: data.name, mode: 'insensitive' }, id: { not: id } },
    });
    if (dupe) throw new ApiError(409, `An account named "${data.name}" already exists.`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fundAccount.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    await logAudit({
      masjidId, actorId,
      action: data.active === false ? 'FUND_ACCOUNT_DEACTIVATED' : 'FUND_ACCOUNT_UPDATED',
      entityType: 'FundAccount', entityId: id,
      oldValue: { name: account.name, active: account.active },
      newValue: { name: updated.name, active: updated.active },
    }, tx);

    return updated;
  });
}

// Adjust balance — creates an ADJUSTMENT ledger entry for every change.
export async function setOpeningBalance(
  masjidId: string,
  id: string,
  amount: number,
  actorId: string,
  note?: string,
) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, 'Balance must be a non-negative number.');
  }

  const account = await prisma.fundAccount.findFirst({ where: { id, masjidId } });
  if (!account) throw new ApiError(404, 'Fund account not found.');

  const prevDecimal = new Prisma.Decimal(account.currentBalance);
  const newDecimal  = new Prisma.Decimal(amount);
  const delta       = newDecimal.sub(prevDecimal);
  const direction   = delta.greaterThanOrEqualTo(0) ? 'CREDIT' : 'DEBIT' as const;
  const absAmount   = delta.abs();
  const ledgerNote  = note?.trim() || `Balance adjusted. Previous: ₹${prevDecimal.toFixed(2)}`;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fundAccount.update({
      where: { id },
      data: { currentBalance: newDecimal },
    });

    await tx.treasuryLedger.create({
      data: {
        masjidId,
        accountId: id,
        entryType: 'ADJUSTMENT',
        direction,
        amount: absAmount,
        note: ledgerNote,
        createdByUserId: actorId,
      },
    });

    await logAudit({
      masjidId, actorId,
      action: 'FUND_ACCOUNT_BALANCE_ADJUSTED',
      entityType: 'FundAccount', entityId: id,
      oldValue: { balance: prevDecimal.toFixed(2) },
      newValue: { balance: amount.toFixed(2), note: ledgerNote },
    }, tx);

    return updated;
  });
}

// Transfer funds between two active accounts — dual ledger entries.
export async function transferFunds(
  masjidId: string,
  fromId: string,
  toId: string,
  amount: number,
  note: string,
  actorId: string,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Transfer amount must be a positive number.');
  }
  if (fromId === toId) {
    throw new ApiError(400, 'Source and destination cannot be the same account.');
  }

  return prisma.$transaction(async (tx) => {
    const from = await tx.fundAccount.findFirst({ where: { id: fromId, masjidId, active: true } });
    if (!from) throw new ApiError(404, 'Source money source not found or inactive.');

    const to = await tx.fundAccount.findFirst({ where: { id: toId, masjidId, active: true } });
    if (!to) throw new ApiError(404, 'Destination money source not found or inactive.');

    const fromBal = new Prisma.Decimal(from.currentBalance);
    const amt     = new Prisma.Decimal(amount);
    if (fromBal.lessThan(amt)) {
      throw new ApiError(400, `Insufficient balance. ${from.name} has ₹${fromBal.toFixed(2)}.`);
    }

    await tx.fundAccount.update({ where: { id: fromId }, data: { currentBalance: { decrement: amt } } });
    await tx.fundAccount.update({ where: { id: toId },   data: { currentBalance: { increment: amt } } });

    const refId = randomUUID();
    await tx.treasuryLedger.create({
      data: {
        masjidId, accountId: fromId, entryType: 'TRANSFER', direction: 'DEBIT',
        amount: amt,
        note: `To ${to.name}${note ? ` — ${note}` : ''}`,
        referenceId: refId, referenceType: 'TRANSFER',
        createdByUserId: actorId,
      },
    });
    await tx.treasuryLedger.create({
      data: {
        masjidId, accountId: toId, entryType: 'TRANSFER', direction: 'CREDIT',
        amount: amt,
        note: `From ${from.name}${note ? ` — ${note}` : ''}`,
        referenceId: refId, referenceType: 'TRANSFER',
        createdByUserId: actorId,
      },
    });

    await logAudit({
      masjidId, actorId,
      action: 'FUND_TRANSFER',
      entityType: 'FundAccount', entityId: fromId,
      newValue: { from: from.name, to: to.name, amount: amt.toFixed(2), note },
    }, tx);

    return { fromId, toId, amount: amt.toFixed(2) };
  });
}

// Permanently remove a money source — only when balance=0 and no ledger history.
export async function deleteFundAccount(masjidId: string, id: string, actorId: string) {
  const account = await prisma.fundAccount.findFirst({ where: { id, masjidId } });
  if (!account) throw new ApiError(404, 'Fund account not found.');

  if (!new Prisma.Decimal(account.currentBalance).equals(0)) {
    throw new ApiError(400, 'Cannot delete a money source with a non-zero balance.');
  }

  const ledgerCount = await prisma.treasuryLedger.count({ where: { accountId: id } });
  if (ledgerCount > 0) {
    throw new ApiError(400, 'Cannot delete a money source that has ledger history. Archive it instead.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.fundAccount.delete({ where: { id } });
    await logAudit({
      masjidId, actorId,
      action: 'FUND_ACCOUNT_DELETED',
      entityType: 'FundAccount', entityId: id,
      oldValue: { name: account.name, type: account.type },
    }, tx);
  });

  return { deleted: true };
}

/* ─── Treasury snapshot (used by dashboard) ───────────────────────────────── */

export async function getTreasurySnapshot(masjidId: string) {
  const [accounts, reserves, reimbResult] = await Promise.all([
    prisma.fundAccount.findMany({
      where: { masjidId, active: true },
      select: { id: true, name: true, type: true, currentBalance: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.fundReserve.findMany({
      where: { masjidId, active: true },
      select: { id: true, title: true, amount: true, restricted: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.aggregate({
      where: { masjidId, status: 'PENDING_REIMB' },
      _sum:   { amount: true },
      _count: { id: true },
    }),
  ]);

  const totalBalance = accounts.reduce(
    (s, a) => s.add(a.currentBalance),
    new Prisma.Decimal(0),
  );

  const totalReserved = reserves.reduce(
    (s, r) => s.add(r.amount),
    new Prisma.Decimal(0),
  );

  const pendingReimbursements      = reimbResult._sum.amount ?? new Prisma.Decimal(0);
  const pendingReimbursementCount  = reimbResult._count.id;

  const netUsable = totalBalance.sub(pendingReimbursements).sub(totalReserved);

  return {
    hasAccounts: accounts.length > 0,
    totalBalance: totalBalance.toFixed(2),
    netUsable: (netUsable.lessThan(0) ? new Prisma.Decimal(0) : netUsable).toFixed(2),
    pendingReimbursements: pendingReimbursements.toFixed(2),
    pendingReimbursementCount,
    totalReserved: totalReserved.toFixed(2),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: a.currentBalance.toFixed(2),
    })),
    reserves: reserves.map((r) => ({
      id: r.id,
      title: r.title,
      amount: r.amount.toFixed(2),
      restricted: r.restricted,
    })),
  };
}

/* ─── Treasury Ledger ─────────────────────────────────────────────────────── */

export async function getTreasuryLedger(
  masjidId: string,
  options: { accountId?: string; entryType?: TreasuryEntryFilter } = {},
) {
  const { accountId, entryType } = options;

  return prisma.treasuryLedger.findMany({
    where: {
      masjidId,
      ...(accountId ? { accountId } : {}),
      ...(entryType  ? { entryType  } : {}),
    },
    select: {
      id: true,
      accountId: true,
      entryType: true,
      direction: true,
      amount: true,
      note: true,
      referenceId: true,
      referenceType: true,
      createdAt: true,
      account:   { select: { name: true, type: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/* ─── Fund Reserves ───────────────────────────────────────────────────────── */

export async function createFundReserve(
  masjidId: string,
  data: { title: string; purpose?: string; amount: number; restricted?: boolean; approvalRequired?: boolean },
  actorId: string,
) {
  if (!Number.isFinite(data.amount) || data.amount < 0) {
    throw new ApiError(400, 'Reserve amount must be a non-negative number.');
  }

  const existing = await prisma.fundReserve.findFirst({
    where: { masjidId, title: { equals: data.title, mode: 'insensitive' }, active: true },
  });
  if (existing) throw new ApiError(409, `A reserve named "${data.title}" already exists.`);

  return prisma.$transaction(async (tx) => {
    const reserve = await tx.fundReserve.create({
      data: {
        masjidId,
        title: data.title,
        purpose: data.purpose ?? null,
        amount: new Prisma.Decimal(data.amount),
        ...(data.restricted !== undefined && { restricted: data.restricted }),
        ...(data.approvalRequired !== undefined && { approvalRequired: data.approvalRequired }),
        createdByUserId: actorId,
      },
    });

    await logAudit({
      masjidId, actorId,
      action: 'RESERVE_CREATED',
      entityType: 'FundReserve', entityId: reserve.id,
      newValue: { title: data.title, amount: data.amount.toFixed(2), restricted: data.restricted },
    }, tx);

    return reserve;
  });
}

export async function listFundReserves(masjidId: string) {
  return prisma.fundReserve.findMany({
    where: { masjidId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, purpose: true, amount: true, active: true, restricted: true, approvalRequired: true, createdAt: true },
  });
}

export async function updateFundReserve(
  masjidId: string,
  id: string,
  data: { title?: string; purpose?: string; amount?: number; active?: boolean; restricted?: boolean; approvalRequired?: boolean },
  actorId: string,
) {
  const reserve = await prisma.fundReserve.findFirst({ where: { id, masjidId } });
  if (!reserve) throw new ApiError(404, 'Fund reserve not found.');

  if (data.amount !== undefined && (!Number.isFinite(data.amount) || data.amount < 0)) {
    throw new ApiError(400, 'Reserve amount must be a non-negative number.');
  }

  if (data.title && data.title.toLowerCase() !== reserve.title.toLowerCase()) {
    const dupe = await prisma.fundReserve.findFirst({
      where: { masjidId, title: { equals: data.title, mode: 'insensitive' }, id: { not: id } },
    });
    if (dupe) throw new ApiError(409, `A reserve named "${data.title}" already exists.`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fundReserve.update({
      where: { id },
      data: {
        ...(data.title            !== undefined && { title: data.title }),
        ...(data.purpose          !== undefined && { purpose: data.purpose }),
        ...(data.amount           !== undefined && { amount: new Prisma.Decimal(data.amount) }),
        ...(data.active           !== undefined && { active: data.active }),
        ...(data.restricted       !== undefined && { restricted: data.restricted }),
        ...(data.approvalRequired !== undefined && { approvalRequired: data.approvalRequired }),
      },
    });

    await logAudit({
      masjidId, actorId,
      action: data.active === false ? 'RESERVE_DEACTIVATED' : 'RESERVE_UPDATED',
      entityType: 'FundReserve', entityId: id,
      oldValue: { title: reserve.title, amount: reserve.amount.toFixed(2), active: reserve.active },
      newValue: { title: updated.title, amount: updated.amount.toFixed(2), active: updated.active },
    }, tx);

    return updated;
  });
}

/* ─── Ledger Integrity Verification ──────────────────────────────────────── */

// On-demand check: SUM(ledger credits - debits) per account == FundAccount.currentBalance.
// Logs and returns any drift. Does NOT auto-correct — alerts only.
export async function verifyLedgerIntegrity(masjidId: string) {
  const [accounts, ledgerAgg] = await Promise.all([
    prisma.fundAccount.findMany({
      where: { masjidId },
      select: { id: true, name: true, currentBalance: true },
    }),
    prisma.treasuryLedger.groupBy({
      by: ['accountId', 'direction'],
      where: { masjidId },
      _sum: { amount: true },
    }),
  ]);

  const ledgerByAccount = new Map<string, { credits: Prisma.Decimal; debits: Prisma.Decimal }>();
  for (const row of ledgerAgg) {
    const entry = ledgerByAccount.get(row.accountId) ?? {
      credits: new Prisma.Decimal(0),
      debits: new Prisma.Decimal(0),
    };
    const amount = row._sum.amount ?? new Prisma.Decimal(0);
    if (row.direction === ('CREDIT' as LedgerDirection)) {
      entry.credits = entry.credits.add(amount);
    } else {
      entry.debits = entry.debits.add(amount);
    }
    ledgerByAccount.set(row.accountId, entry);
  }

  type AccountCheck = {
    accountId: string;
    name: string;
    currentBalance: string;
    ledgerBalance: string;
    drift: string;
    ok: boolean;
  };

  const checks: AccountCheck[] = [];
  let hasDiscrepancy = false;

  for (const account of accounts) {
    const ledger = ledgerByAccount.get(account.id) ?? {
      credits: new Prisma.Decimal(0),
      debits: new Prisma.Decimal(0),
    };
    const ledgerBalance = ledger.credits.sub(ledger.debits);
    const currentBalance = new Prisma.Decimal(account.currentBalance);
    const drift = currentBalance.sub(ledgerBalance);
    const ok = drift.equals(0);
    if (!ok) hasDiscrepancy = true;
    checks.push({
      accountId: account.id,
      name: account.name,
      currentBalance: currentBalance.toFixed(2),
      ledgerBalance: ledgerBalance.toFixed(2),
      drift: drift.toFixed(2),
      ok,
    });
  }

  if (hasDiscrepancy) {
    logger.warn('treasury.integrity.discrepancy', {
      masjidId,
      discrepancies: checks.filter((c) => !c.ok).map((c) => ({
        account: c.name, drift: c.drift,
      })),
    });
  }

  return {
    ok: !hasDiscrepancy,
    checkedAt: new Date().toISOString(),
    accounts: checks,
  };
}
