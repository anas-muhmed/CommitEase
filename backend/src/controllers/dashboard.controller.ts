import type { RequestHandler } from 'express';
import * as DashboardService from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

export const getDashboard: RequestHandler = async (req, res) => {
  const result = await DashboardService.getDashboard(req.user!.masjidId!);
  sendSuccess(res, result);
};

export const getCollectionReport: RequestHandler = async (req, res) => {
  const raw = typeof req.query['year'] === 'string' ? parseInt(req.query['year'], 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(raw) || raw < 2000 || raw > 2100) {
    throw new ApiError(400, 'year must be a valid 4-digit year (e.g. 2026).');
  }
  const result = await DashboardService.getCollectionReport(req.user!.masjidId!, raw);
  sendSuccess(res, result);
};

export const getOverdueReport: RequestHandler = async (req, res) => {
  const result = await DashboardService.getOverdueReport(req.user!.masjidId!);
  sendSuccess(res, result);
};
