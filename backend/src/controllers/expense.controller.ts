import type { RequestHandler } from 'express';
import * as ExpenseService from '../services/expense.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { ExpenseCategory, ExpenseType } from '@prisma/client';

const VALID_CATEGORIES = Object.values(ExpenseCategory);
const VALID_TYPES      = Object.values(ExpenseType);
const VALID_STATUSES   = ['SETTLED', 'PENDING_REIMB', 'REIMBURSED'] as const;

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

function param(req: Parameters<RequestHandler>[0], name: string): string {
  const val = req.params[name];
  if (!val) throw new ApiError(400, `Missing route parameter: ${name}`);
  return Array.isArray(val) ? (val[0] ?? '') : val;
}

export const createExpense: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;

  const typeRaw = requireString(body, 'expenseType');
  if (!VALID_TYPES.includes(typeRaw as ExpenseType)) {
    throw new ApiError(400, `expenseType must be one of: ${VALID_TYPES.join(', ')}`);
  }

  const catRaw = requireString(body, 'category');
  if (!VALID_CATEGORIES.includes(catRaw as ExpenseCategory)) {
    throw new ApiError(400, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  const description   = optionalString(body, 'description');
  const fundAccountId = optionalString(body, 'fundAccountId');
  const paidByUserId  = optionalString(body, 'paidByUserId');

  const data = await ExpenseService.createExpense(req.user!.masjidId!, req.user!.id, {
    expenseType: typeRaw as ExpenseType,
    category:    catRaw as ExpenseCategory,
    amount:      requireNumber(body, 'amount'),
    ...(description   !== undefined && { description }),
    ...(fundAccountId !== undefined && { fundAccountId }),
    ...(paidByUserId  !== undefined && { paidByUserId }),
  });

  sendSuccess(res, data, 'Expense recorded.', 201);
};

export const listExpenses: RequestHandler = async (req, res) => {
  const statusRaw   = req.query['status']   as string | undefined;
  const categoryRaw = req.query['category'] as string | undefined;

  if (statusRaw && !(VALID_STATUSES as readonly string[]).includes(statusRaw)) {
    throw new ApiError(400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (categoryRaw && !VALID_CATEGORIES.includes(categoryRaw as ExpenseCategory)) {
    throw new ApiError(400, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  const data = await ExpenseService.listExpenses(req.user!.masjidId!, {
    ...(statusRaw   ? { status: statusRaw } : {}),
    ...(categoryRaw ? { category: categoryRaw as ExpenseCategory } : {}),
  });

  sendSuccess(res, data);
};

export const reimburseExpense: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;

  const note = optionalString(body, 'note');
  const data = await ExpenseService.reimburseExpense(
    req.user!.masjidId!,
    param(req, 'expenseId'),
    req.user!.id,
    {
      fundAccountId: requireString(body, 'fundAccountId'),
      ...(note !== undefined && { note }),
    },
  );

  sendSuccess(res, data, 'Expense reimbursed.');
};
