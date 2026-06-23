import type { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): void {
  res.status(statusCode).json({ success: true, message, data });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string>,
): void {
  const body: Record<string, unknown> = { success: false, message, data: null };
  if (errors) {
    body['errors'] = errors;
  }
  res.status(statusCode).json(body);
}
