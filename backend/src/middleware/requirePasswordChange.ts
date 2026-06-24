import type { RequestHandler } from 'express';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export const requirePasswordChange: RequestHandler = async (req, _res, next) => {
  const userId = req.user?.id;
  if (!userId) { next(); return; }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });

  if (user?.mustChangePassword) {
    next(new ApiError(403, 'Password change required before accessing this resource.'));
    return;
  }

  next();
};
