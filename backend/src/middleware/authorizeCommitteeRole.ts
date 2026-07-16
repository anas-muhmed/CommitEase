import type { RequestHandler } from 'express';
import type { CommitteeRole } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

const ROLE_RANK: Record<CommitteeRole, number> = {
  VIEWER: 0,
  PAYMENT_OPERATOR: 1,
  TREASURER: 2,
  ADMIN: 3,
};

// Usage: router.post('/finance/accounts', committee, requireCommitteeRole('TREASURER'), handler)
export function requireCommitteeRole(minimum: CommitteeRole): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) {
        next(new ApiError(401, 'Authentication required.'));
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { committeeRole: true },
      });
      if (!user || ROLE_RANK[user.committeeRole] < ROLE_RANK[minimum]) {
        next(new ApiError(403, 'Insufficient permissions for this action.'));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
