import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: null,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists.',
        data: null,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Record not found.',
        data: null,
      });
      return;
    }
  }

  console.error('[Unhandled Error]', err);

  const message =
    env.nodeEnv === 'production'
      ? 'Internal server error.'
      : err instanceof Error
        ? err.message
        : 'Internal server error.';

  res.status(500).json({ success: false, message, data: null });
};
