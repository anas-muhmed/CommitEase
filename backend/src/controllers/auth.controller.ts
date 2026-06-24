import type { RequestHandler } from 'express';
import { env } from '../config/env';
import * as AuthService from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

// Separate cookie names so a user who is both a member and a committee member
// doesn't have one session overwrite the other.
const COMMITTEE_REFRESH_COOKIE = 'crt';
const MEMBER_REFRESH_COOKIE = 'mrt';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict' as const,
  };
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} is required.`);
  }
  return value.trim();
}

// ─── Committee ────────────────────────────────────────────────────────────────

export const committeeLogin: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidCode = requireString(body, 'masjidCode');
  const username = requireString(body, 'username');
  const password = requireString(body, 'password');

  const { accessToken, refreshToken, mustChangePassword } = await AuthService.committeeLogin(masjidCode, username, password);
  res.cookie(COMMITTEE_REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  sendSuccess(res, { accessToken, mustChangePassword }, 'Login successful.');
};

export const committeeRefresh: RequestHandler = async (req, res) => {
  const token = req.cookies[COMMITTEE_REFRESH_COOKIE] as string | undefined;
  if (!token) throw new ApiError(401, 'No refresh token.');

  const { accessToken } = await AuthService.refreshCommitteeToken(token);
  sendSuccess(res, { accessToken }, 'Token refreshed.');
};

export const committeeLogout: RequestHandler = (_req, res) => {
  res.clearCookie(COMMITTEE_REFRESH_COOKIE, clearCookieOptions());
  sendSuccess(res, null, 'Logged out.');
};

// ─── Member ───────────────────────────────────────────────────────────────────

export const requestOtp: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidCode = requireString(body, 'masjidCode');
  const phone = requireString(body, 'phone');

  await AuthService.requestMemberOtp(masjidCode, phone);
  sendSuccess(res, null, 'OTP sent.');
};

export const verifyOtp: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidCode = requireString(body, 'masjidCode');
  const phone = requireString(body, 'phone');
  const otp = requireString(body, 'otp');

  if (!/^\d{6}$/.test(otp)) throw new ApiError(400, 'otp must be a 6-digit number.');

  const { accessToken, refreshToken } = await AuthService.verifyMemberOtp(masjidCode, phone, otp);
  res.cookie(MEMBER_REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  sendSuccess(res, { accessToken }, 'Login successful.');
};

export const memberRefresh: RequestHandler = async (req, res) => {
  const token = req.cookies[MEMBER_REFRESH_COOKIE] as string | undefined;
  if (!token) throw new ApiError(401, 'No refresh token.');

  const { accessToken } = await AuthService.refreshMemberToken(token);
  sendSuccess(res, { accessToken }, 'Token refreshed.');
};

export const memberLogout: RequestHandler = (_req, res) => {
  res.clearCookie(MEMBER_REFRESH_COOKIE, clearCookieOptions());
  sendSuccess(res, null, 'Logged out.');
};
