import type { RequestHandler } from 'express';
import * as TreasuryService from '../services/treasury.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { FundAccountType } from '@prisma/client';

const VALID_LEDGER_ENTRY_TYPES = [
  'INCOME', 'EXPENSE', 'REIMBURSEMENT', 'RESERVE_IN', 'RESERVE_OUT', 'ADJUSTMENT', 'TRANSFER',
] as const;

/* ─── Input helpers ──────────────────────────────────────────────────────── */

function requireString(body: Record<string, unknown>, field: string): string {
  const val = body[field];
  if (typeof val !== 'string' || !val.trim()) throw new ApiError(400, `${field} is required.`);
  return val.trim();
}

function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const val = body[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') throw new ApiError(400, `${field} must be a string.`);
  return val.trim() || undefined;
}

function requireNumber(body: Record<string, unknown>, field: string): number {
  const val = body[field];
  const n = Number(val);
  if (!Number.isFinite(n)) throw new ApiError(400, `${field} must be a valid number.`);
  return n;
}

function optionalBoolean(body: Record<string, unknown>, field: string): boolean | undefined {
  const val = body[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') throw new ApiError(400, `${field} must be a boolean.`);
  return val;
}

function param(req: Parameters<RequestHandler>[0], name: string): string {
  const val = req.params[name];
  if (!val) throw new ApiError(400, `Missing route parameter: ${name}`);
  return Array.isArray(val) ? (val[0] ?? '') : val;
}

/* ─── Fund Account handlers ──────────────────────────────────────────────── */

export const listAccounts: RequestHandler = async (req, res) => {
  const data = await TreasuryService.listFundAccounts(req.user!.masjidId!);
  sendSuccess(res, data);
};

export const createAccount: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = requireString(body, 'name');
  const typeRaw = requireString(body, 'type');

  if (!Object.values(FundAccountType).includes(typeRaw as FundAccountType)) {
    throw new ApiError(400, `type must be one of: ${Object.values(FundAccountType).join(', ')}`);
  }

  const data = await TreasuryService.createFundAccount(
    req.user!.masjidId!,
    { name, type: typeRaw as FundAccountType },
    req.user!.id,
  );
  sendSuccess(res, data, 'Fund account created.', 201);
};

export const getAccount: RequestHandler = async (req, res) => {
  const data = await TreasuryService.getFundAccount(req.user!.masjidId!, param(req, 'accountId'));
  sendSuccess(res, data);
};

export const updateAccount: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name   = optionalString(body, 'name');
  const active = optionalBoolean(body, 'active');

  if (name === undefined && active === undefined) {
    throw new ApiError(400, 'Provide at least one field to update: name or active.');
  }

  const data = await TreasuryService.updateFundAccount(
    req.user!.masjidId!,
    param(req, 'accountId'),
    { ...(name !== undefined && { name }), ...(active !== undefined && { active }) },
    req.user!.id,
  );
  sendSuccess(res, data, 'Fund account updated.');
};

export const setOpeningBalance: RequestHandler = async (req, res) => {
  const body   = req.body as Record<string, unknown>;
  const amount = requireNumber(body, 'amount');
  const note   = optionalString(body, 'note');

  const data = await TreasuryService.setOpeningBalance(
    req.user!.masjidId!,
    param(req, 'accountId'),
    amount,
    req.user!.id,
    note,
  );
  sendSuccess(res, data, 'Balance adjusted.');
};

export const transferFunds: RequestHandler = async (req, res) => {
  const body   = req.body as Record<string, unknown>;
  const toId   = requireString(body, 'toId');
  const amount = requireNumber(body, 'amount');
  const note   = optionalString(body, 'note') ?? '';

  const data = await TreasuryService.transferFunds(
    req.user!.masjidId!,
    param(req, 'accountId'),
    toId,
    amount,
    note,
    req.user!.id,
  );
  sendSuccess(res, data, 'Transfer complete.');
};

export const deleteAccount: RequestHandler = async (req, res) => {
  await TreasuryService.deleteFundAccount(
    req.user!.masjidId!,
    param(req, 'accountId'),
    req.user!.id,
  );
  sendSuccess(res, null, 'Money source deleted.');
};

/* ─── Treasury snapshot ──────────────────────────────────────────────────── */

export const getTreasury: RequestHandler = async (req, res) => {
  const data = await TreasuryService.getTreasurySnapshot(req.user!.masjidId!);
  sendSuccess(res, data);
};

/* ─── Fund Reserve handlers ──────────────────────────────────────────────── */

export const listReserves: RequestHandler = async (req, res) => {
  const data = await TreasuryService.listFundReserves(req.user!.masjidId!);
  sendSuccess(res, data);
};

export const createReserve: RequestHandler = async (req, res) => {
  const body            = req.body as Record<string, unknown>;
  const title           = requireString(body, 'title');
  const purpose         = optionalString(body, 'purpose');
  const amount          = requireNumber(body, 'amount');
  const restricted      = optionalBoolean(body, 'restricted');
  const approvalRequired = optionalBoolean(body, 'approvalRequired');

  const data = await TreasuryService.createFundReserve(
    req.user!.masjidId!,
    {
      title,
      ...(purpose          !== undefined && { purpose }),
      amount,
      ...(restricted       !== undefined && { restricted }),
      ...(approvalRequired !== undefined && { approvalRequired }),
    },
    req.user!.id,
  );
  sendSuccess(res, data, 'Reserve created.', 201);
};

export const updateReserve: RequestHandler = async (req, res) => {
  const body            = req.body as Record<string, unknown>;
  const title           = optionalString(body, 'title');
  const purpose         = optionalString(body, 'purpose');
  const active          = optionalBoolean(body, 'active');
  const restricted      = optionalBoolean(body, 'restricted');
  const approvalRequired = optionalBoolean(body, 'approvalRequired');
  const amtRaw          = body['amount'];
  const amount          = amtRaw !== undefined && amtRaw !== null ? requireNumber(body, 'amount') : undefined;

  if (
    title === undefined && purpose === undefined && amount === undefined &&
    active === undefined && restricted === undefined && approvalRequired === undefined
  ) {
    throw new ApiError(400, 'Provide at least one field to update.');
  }

  const data = await TreasuryService.updateFundReserve(
    req.user!.masjidId!,
    param(req, 'reserveId'),
    {
      ...(title            !== undefined && { title }),
      ...(purpose          !== undefined && { purpose }),
      ...(amount           !== undefined && { amount }),
      ...(active           !== undefined && { active }),
      ...(restricted       !== undefined && { restricted }),
      ...(approvalRequired !== undefined && { approvalRequired }),
    },
    req.user!.id,
  );
  sendSuccess(res, data, 'Reserve updated.');
};

/* ─── Treasury Ledger ────────────────────────────────────────────────────── */

export const getLedger: RequestHandler = async (req, res) => {
  const accountId    = req.query['accountId'] as string | undefined;
  const entryTypeRaw = req.query['entryType'] as string | undefined;

  if (entryTypeRaw && !(VALID_LEDGER_ENTRY_TYPES as readonly string[]).includes(entryTypeRaw)) {
    throw new ApiError(400, `entryType must be one of: ${VALID_LEDGER_ENTRY_TYPES.join(', ')}`);
  }

  const data = await TreasuryService.getTreasuryLedger(req.user!.masjidId!, {
    ...(accountId    ? { accountId }                                                          : {}),
    ...(entryTypeRaw ? { entryType: entryTypeRaw as (typeof VALID_LEDGER_ENTRY_TYPES)[number] } : {}),
  });
  sendSuccess(res, data);
};

export const verifyIntegrity: RequestHandler = async (req, res) => {
  const data = await TreasuryService.verifyLedgerIntegrity(req.user!.masjidId!);
  sendSuccess(res, data);
};
