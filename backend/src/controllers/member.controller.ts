import type { RequestHandler } from 'express';
import * as MemberService from '../services/member.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

// ─── Input helpers ────────────────────────────────────────────────────────────

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

function optionalNumber(body: Record<string, unknown>, field: string): number | undefined {
  const val = body[field];
  if (val === undefined || val === null) return undefined;
  const num = Number(val);
  if (!Number.isFinite(num)) throw new ApiError(400, `${field} must be a valid number.`);
  return num;
}

function param(req: Parameters<RequestHandler>[0], name: string): string {
  const val = req.params[name];
  if (!val) throw new ApiError(400, `Missing route parameter: ${name}`);
  return Array.isArray(val) ? (val[0] ?? '') : val;
}

// ─── Member handlers ──────────────────────────────────────────────────────────

export const listMembers: RequestHandler = async (req, res) => {
  const masjidId = req.user!.masjidId!;
  const page = typeof req.query['page'] === 'string' ? parseInt(req.query['page'], 10) : undefined;
  const limit = typeof req.query['limit'] === 'string' ? parseInt(req.query['limit'], 10) : undefined;
  const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
  const activeRaw = typeof req.query['active'] === 'string' ? req.query['active'] : undefined;

  const result = await MemberService.listMembers(masjidId, {
    ...(page !== undefined && { page }),
    ...(limit !== undefined && { limit }),
    ...(search !== undefined && { search }),
    ...(activeRaw !== undefined && { active: activeRaw === 'true' }),
  });

  sendSuccess(res, result);
};

export const createMember: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;

  const memberCode = optionalString(body, 'memberCode');
  const address = optionalString(body, 'address');
  const openingDueBalance = optionalNumber(body, 'openingDueBalance');
  const contributionPlanId = optionalString(body, 'contributionPlanId');

  const member = await MemberService.createMember(masjidId, req.user!.id, {
    name: requireString(body, 'name'),
    phone: requireString(body, 'phone'),
    contributionStartDate: requireString(body, 'contributionStartDate'),
    ...(memberCode !== undefined && { memberCode }),
    ...(address !== undefined && { address }),
    ...(openingDueBalance !== undefined && { openingDueBalance }),
    ...(contributionPlanId !== undefined && { contributionPlanId }),
  });

  sendSuccess(res, member, 'Member created.', 201);
};

export const getMember: RequestHandler = async (req, res) => {
  const member = await MemberService.getMemberById(req.user!.masjidId!, param(req, 'memberId'));
  sendSuccess(res, member);
};

export const updateMember: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;
  const memberId = param(req, 'memberId');

  const name = optionalString(body, 'name');
  const phone = optionalString(body, 'phone');
  const address = optionalString(body, 'address');
  const contributionStartDate = optionalString(body, 'contributionStartDate');
  const openingDueBalance = optionalNumber(body, 'openingDueBalance');

  const member = await MemberService.updateMember(masjidId, memberId, req.user!.id, {
    ...(name !== undefined && { name }),
    ...(phone !== undefined && { phone }),
    ...(address !== undefined && { address }),
    ...(contributionStartDate !== undefined && { contributionStartDate }),
    ...(openingDueBalance !== undefined && { openingDueBalance }),
  });

  sendSuccess(res, member, 'Member updated.');
};

export const deactivateMember: RequestHandler = async (req, res) => {
  const result = await MemberService.deactivateMember(
    req.user!.masjidId!,
    param(req, 'memberId'),
    req.user!.id,
  );
  sendSuccess(res, result, 'Member deactivated.');
};

export const bulkImport: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ApiError(400, 'An Excel file (.xlsx) is required. Send as multipart/form-data with field name "file".');
  }

  const result = await MemberService.bulkImportMembers(req.user!.masjidId!, req.user!.id, file.buffer);

  const allFailed = result.created === 0 && result.errors.length > 0;
  const message = result.errors.length > 0
    ? `Import complete. ${result.created} member(s) created, ${result.errors.length} row(s) failed.`
    : `Import complete. ${result.created} member(s) created.`;

  if (allFailed) {
    throw new ApiError(422, message, true, result.errors);
  }

  sendSuccess(res, result, message, result.created > 0 ? 201 : 200);
};

// ─── Ledger and payments ──────────────────────────────────────────────────────

export const getLedger: RequestHandler = async (req, res) => {
  const result = await MemberService.getLedger(req.user!.masjidId!, param(req, 'memberId'));
  sendSuccess(res, result);
};

export const recordPayment: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;
  const memberId = param(req, 'memberId');

  const amount = optionalNumber(body, 'amount');
  if (amount === undefined) throw new ApiError(400, 'amount is required.');

  const note = optionalString(body, 'note');

  const result = await MemberService.recordPayment(masjidId, memberId, req.user!.id, {
    amount,
    paymentDate: requireString(body, 'paymentDate'),
    ...(note !== undefined && { note }),
  });

  sendSuccess(res, result, `Payment recorded. Receipt ${result.receipt.receiptNumber} issued.`, 201);
};

export const getPaymentHistory: RequestHandler = async (req, res) => {
  const result = await MemberService.getPaymentHistory(req.user!.masjidId!, param(req, 'memberId'));
  sendSuccess(res, result);
};
