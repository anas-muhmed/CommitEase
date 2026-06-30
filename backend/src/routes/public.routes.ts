import { Router } from 'express';
import { signupRateLimiter } from '../middleware/rateLimiter';
import * as MasjidController from '../controllers/masjid.controller';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

const router = Router();

// Unauthenticated — rate-limited (5 requests per IP per hour).
router.post('/masjid-signup', signupRateLimiter, MasjidController.publicSignup);

// Invite link: resolve masjid code → name for the join page UI.
router.get('/masjid-name', async (req, res) => {
  const code = (req.query['code'] as string | undefined)?.toUpperCase().trim();
  if (!code) throw new ApiError(400, 'code is required.');
  const masjid = await prisma.masjid.findUnique({ where: { code }, select: { name: true, status: true } });
  if (!masjid || masjid.status !== 'ACTIVE') throw new ApiError(404, 'Masjid not found.');
  sendSuccess(res, { name: masjid.name });
});

export default router;
