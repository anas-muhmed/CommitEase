import type { RequestHandler } from 'express';
import { env } from '../config/env';
import * as AuthService from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

// Separate cookie names so a user who is both a member and a committee member
// doesn't have one session overwrite the other.
const COMMITTEE_REFRESH_COOKIE = 'crt';
const MEMBER_SESSION_COOKIE = 'mst'; // member session token (raw HMAC pre-image)

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for committee refresh JWT
  };
}

function memberSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days for member trusted session
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

export const lookupPhone: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const phone = requireString(body, 'phone');
  const masjids = await AuthService.lookupMembersByPhone(phone);
  sendSuccess(res, { masjids });
};

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

  const { accessToken, sessionToken } = await AuthService.verifyMemberOtp(masjidCode, phone, otp);
  res.cookie(MEMBER_SESSION_COOKIE, sessionToken, memberSessionCookieOptions());
  sendSuccess(res, { accessToken }, 'Login successful.');
};

export const memberRefresh: RequestHandler = async (req, res) => {
  const rawToken = req.cookies[MEMBER_SESSION_COOKIE] as string | undefined;
  if (!rawToken) throw new ApiError(401, 'No session token.');

  const { accessToken } = await AuthService.renewMemberSession(rawToken);
  sendSuccess(res, { accessToken }, 'Token refreshed.');
};

export const memberLogout: RequestHandler = async (req, res) => {
  const rawToken = req.cookies[MEMBER_SESSION_COOKIE] as string | undefined;
  if (rawToken) await AuthService.revokeMemberSession(rawToken).catch(() => {});
  res.clearCookie(MEMBER_SESSION_COOKIE, clearCookieOptions());
  sendSuccess(res, null, 'Logged out.');
};

// ─── Password change ──────────────────────────────────────────────────────────

export const changePassword: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  await AuthService.changePassword(
    req.user!.id,
    requireString(body, 'currentPassword'),
    requireString(body, 'newPassword'),
  );
  sendSuccess(res, null, 'Password changed successfully.');
};
