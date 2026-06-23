import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

interface UserAccessPayload {
  sub: string;
  masjidId: string | null;
  role: UserRole;
  type: 'user';
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required.'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as UserAccessPayload;
    if (payload.type !== 'user') {
      next(new ApiError(401, 'Invalid token type.'));
      return;
    }
    req.user = { id: payload.sub, masjidId: payload.masjidId, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
};
