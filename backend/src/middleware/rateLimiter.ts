import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

// TODO(Phase 3): Replace body with express-rate-limit implementation.
// npm install express-rate-limit @types/express-rate-limit
// The interface above matches express-rate-limit's options shape — swap is drop-in.
export function createRateLimiter(_options: RateLimitOptions): RequestHandler {
  return (_req, _res, next) => next();
}

export const otpRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10-minute window
  max: 5,                    // 5 OTP requests per window per IP
  message: 'Too many OTP requests. Please wait before trying again.',
});
