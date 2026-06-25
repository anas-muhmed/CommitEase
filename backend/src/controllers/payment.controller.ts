import type { RequestHandler } from 'express';
import * as PaymentService from '../services/payment.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

function requireString(body: Record<string, unknown>, field: string): string {
  const val = body[field];
  if (typeof val !== 'string' || !val.trim()) throw new ApiError(400, `${field} is required.`);
  return val.trim();
}

function param(req: Parameters<RequestHandler>[0], name: string): string {
  const val = req.params[name];
  if (!val) throw new ApiError(400, `Missing route parameter: ${name}`);
  return Array.isArray(val) ? (val[0] ?? '') : val;
}

export const reversePayment: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;
  const memberId = param(req, 'memberId');
  const paymentId = param(req, 'paymentId');

  const result = await PaymentService.reversePayment(
    masjidId,
    memberId,
    paymentId,
    req.user!.id,
    requireString(body, 'reason'),
  );

  sendSuccess(res, result, 'Payment reversed. Receipt voided.');
};

export const transferPayment: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = req.user!.masjidId!;
  const memberId = param(req, 'memberId');
  const paymentId = param(req, 'paymentId');

  const toMemberId = requireString(body, 'toMemberId');
  const reason = requireString(body, 'reason');

  const result = await PaymentService.transferPayment(
    masjidId,
    memberId,
    paymentId,
    toMemberId,
    req.user!.id,
    reason,
  );

  sendSuccess(
    res,
    result,
    `Payment transferred. New receipt ${result.newReceipt.receiptNumber} issued.`,
    201,
  );
};
