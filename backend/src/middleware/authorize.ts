import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

// Usage: router.get('/members', authenticate, authorize('COMMITTEE_ADMIN'), handler)
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError(401, 'Authentication required.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError(403, 'Insufficient permissions.'));
      return;
    }
    next();
  };
}
