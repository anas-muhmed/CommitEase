import type { RequestHandler } from 'express';
import * as PlanService from '../services/plan.service';
import * as FeeService from '../services/fee.service';
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

function optionalBool(body: Record<string, unknown>, field: string): boolean | undefined {
  const val = body[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') throw new ApiError(400, `${field} must be a boolean.`);
  return val;
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

// ─── Plan handlers ────────────────────────────────────────────────────────────

export const listPlans: RequestHandler = async (req, res) => {
  const result = await PlanService.listPlans(req.user!.masjidId!);
  sendSuccess(res, result);
};

export const createPlan: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const description = optionalString(body, 'description');

  const chelavExempt = optionalBool(body, 'chelavExempt');
  const result = await PlanService.createPlan(req.user!.masjidId!, req.user!.id, {
    name: requireString(body, 'name'),
    ...(description !== undefined && { description }),
    ...(chelavExempt !== undefined && { chelavExempt }),
  });
  sendSuccess(res, result, 'Contribution plan created.', 201);
};

export const getPlan: RequestHandler = async (req, res) => {
  const result = await PlanService.getPlanById(req.user!.masjidId!, param(req, 'planId'));
  sendSuccess(res, result);
};

export const updatePlan: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const planId = param(req, 'planId');
  const masjidId = req.user!.masjidId!;

  const name = optionalString(body, 'name');
  const description = optionalString(body, 'description');
  const chelavExempt = optionalBool(body, 'chelavExempt');
  const active = optionalBool(body, 'active');

  const result = await PlanService.updatePlan(masjidId, planId, req.user!.id, {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(chelavExempt !== undefined && { chelavExempt }),
    ...(active !== undefined && { active }),
  });
  sendSuccess(res, result, 'Contribution plan updated.');
};

// ─── Fee handlers (plan-scoped) ───────────────────────────────────────────────

export const setFee: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;
  const planId = param(req, 'planId');

  const monthlyFee = optionalNumber(body, 'monthlyFee');
  if (monthlyFee === undefined) throw new ApiError(400, 'monthlyFee is required.');

  const result = await FeeService.setFee(planId, masjidId, req.user!.id, {
    monthlyFee,
    effectiveFrom: requireString(body, 'effectiveFrom'),
  });
  sendSuccess(res, result, 'Contribution fee updated.', 201);
};

export const getFeeHistory: RequestHandler = async (req, res) => {
  const result = await FeeService.getFeeHistory(param(req, 'planId'), req.user!.masjidId!);
  sendSuccess(res, result);
};

// ─── Member plan switch ───────────────────────────────────────────────────────

export const switchMemberPlan: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;
  const memberId = param(req, 'memberId');

  const newPlanId = requireString(body, 'planId');
  const effectiveFromRaw = requireString(body, 'effectiveFrom');
  const effectiveFrom = new Date(effectiveFromRaw);
  if (isNaN(effectiveFrom.getTime())) {
    throw new ApiError(400, 'effectiveFrom must be a valid ISO date string.');
  }

  const result = await PlanService.switchMemberPlan(
    masjidId, memberId, newPlanId, effectiveFrom, req.user!.id,
  );
  sendSuccess(res, result, 'Member plan updated. Historical dues retain the previous plan rate.');
};
