import type { RequestHandler } from 'express';
import * as PaymentFeedService from '../services/payment-feed.service';
import { sendSuccess } from '../utils/response';

export const getPaymentFeed: RequestHandler = async (req, res) => {
  const masjidId = req.user!.masjidId!;
  const q = req.query as Record<string, string | undefined>;

  const page  = q['page']  ? parseInt(q['page'],  10) : undefined;
  const limit = q['limit'] ? parseInt(q['limit'], 10) : undefined;

  const result = await PaymentFeedService.getPaymentFeed(masjidId, {
    ...(q['status']   ? { status:   q['status']   } : {}),
    ...(q['mode']     ? { mode:     q['mode']     } : {}),
    ...(q['dateFrom'] ? { dateFrom: q['dateFrom'] } : {}),
    ...(q['dateTo']   ? { dateTo:   q['dateTo']   } : {}),
    ...(page  !== undefined && !isNaN(page)  ? { page }  : {}),
    ...(limit !== undefined && !isNaN(limit) ? { limit } : {}),
  });

  sendSuccess(res, result);
};

export const getPaymentKpi: RequestHandler = async (req, res) => {
  const masjidId = req.user!.masjidId!;
  const result = await PaymentFeedService.getPaymentKpi(masjidId);
  sendSuccess(res, result);
};
