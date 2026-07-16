import { Router } from 'express';
import { authenticateMember } from '../middleware/authenticateMember';
import * as PortalService from '../services/portal.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

const router = Router();

// All routes require a valid member access token.
router.use(authenticateMember);

router.get('/home', async (req, res) => {
  const data = await PortalService.getMemberHome(req.member!.id, req.member!.masjidId);
  sendSuccess(res, data);
});

router.get('/history', async (req, res) => {
  const data = await PortalService.getMemberHistory(req.member!.id, req.member!.masjidId);
  sendSuccess(res, data);
});

router.get('/chelav', async (req, res) => {
  const { year, month } = req.query as { year?: string; month?: string };
  const now = new Date();
  const y = year ? parseInt(year, 10) : now.getUTCFullYear();
  const m = month ? parseInt(month, 10) : now.getUTCMonth() + 1;

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
    throw new ApiError(400, 'Invalid year or month.');
  }

  const data = await PortalService.getMemberChelav(req.member!.id, req.member!.masjidId, y, m);
  sendSuccess(res, data);
});

router.get('/receipts/:id', async (req, res) => {
  const data = await PortalService.getMemberReceiptDetail(
    req.member!.id,
    req.member!.masjidId,
    req.params.id,
  );
  sendSuccess(res, data);
});

export default router;
