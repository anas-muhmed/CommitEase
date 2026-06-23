import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

interface MemberAccessPayload {
  sub: string;
  masjidId: string;
  type: 'member';
}

export const authenticateMember: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new ApiError(401, 'Authentication required.'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as MemberAccessPayload;
    if (payload.type !== 'member') {
      next(new ApiError(401, 'Invalid token type.'));
      return;
    }
    req.member = { id: payload.sub, masjidId: payload.masjidId };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token.'));
  }
};
