import type { RequestHandler } from 'express';
import { MasjidStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

// Middleware for Phase 5+ business routes (member management, payments, etc.).
// SUPER_ADMIN (masjidId = null) bypasses this check — they operate platform-wide.
// Apply after authenticate/authenticateMember on any committee-scoped route.
export const requireActiveMasjid: RequestHandler = async (req, _res, next) => {
  const masjidId = req.user?.masjidId;

  if (!masjidId) {
    next();
    return;
  }

  const masjid = await prisma.masjid.findUnique({
    where: { id: masjidId },
    select: { status: true },
  });

  if (!masjid || masjid.status !== MasjidStatus.ACTIVE) {
    next(new ApiError(403, 'Masjid is not active.'));
    return;
  }

  next();
};
