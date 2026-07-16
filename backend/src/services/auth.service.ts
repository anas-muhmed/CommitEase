import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma, MasjidStatus } from '@prisma/client';
import type { UserRole, CommitteeRole } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

// ─── Token payload shapes (internal — not exported) ───────────────────────────

interface UserAccessPayload {
  sub: string;
  masjidId: string | null;
  role: UserRole;
  committeeRole: CommitteeRole;
  mustChangePassword: boolean;
  type: 'user';
}

interface MemberAccessPayload {
  sub: string;
  masjidId: string;
  type: 'member';
}

interface RefreshPayload {
  sub: string;
  entityType: 'user' | 'member';
  type: 'refresh';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_TTL_MS = 5 * 60 * 1000;           // 5-minute OTP window
const OTP_COOLDOWN_MS = 60 * 1000;           // 60-second resend cooldown
const OTP_BCRYPT_ROUNDS = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15-minute block after max failed attempts

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90-day trusted device session

// A valid bcrypt hash used when the user is not found — ensures bcrypt.compare
// always runs so that response time does not reveal whether an account exists.
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  return phone.length > 4 ? '*'.repeat(phone.length - 4) + phone.slice(-4) : '****';
}

function hashSessionToken(raw: string): string {
  return crypto.createHmac('sha256', env.jwtRefreshSecret).update(raw).digest('hex');
}

function signAccessToken(payload: UserAccessPayload | MemberAccessPayload): string {
  return jwt.sign(payload as object, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn as NonNullable<jwt.SignOptions['expiresIn']>,
  });
}

function signRefreshToken(sub: string, entityType: 'user' | 'member'): string {
  return jwt.sign(
    { sub, entityType, type: 'refresh' },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn as NonNullable<jwt.SignOptions['expiresIn']> },
  );
}

function verifyRefreshToken(token: string): RefreshPayload {
  try {
    return jwt.verify(token, env.jwtRefreshSecret) as RefreshPayload;
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }
}

// ─── Committee auth ───────────────────────────────────────────────────────────

export async function committeeLogin(masjidCode: string, username: string, password: string) {
  const masjid = await prisma.masjid.findUnique({ where: { code: masjidCode } });
  if (!masjid || masjid.status !== MasjidStatus.ACTIVE) {
    logger.warn('auth.committee.login.failure', { masjidCode, username, reason: 'masjid_not_found' });
    throw new ApiError(401, 'Invalid credentials.');
  }

  const user = await prisma.user.findUnique({
    where: { masjidId_username: { masjidId: masjid.id, username } },
  });

  // Always run bcrypt even when the user is not found to prevent timing-based
  // username enumeration attacks.
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.active || !valid) {
    logger.warn('auth.committee.login.failure', {
      masjidCode,
      username,
      reason: !user ? 'user_not_found' : !user.active ? 'user_inactive' : 'wrong_password',
    });
    throw new ApiError(401, 'Invalid credentials.');
  }

  logger.info('auth.committee.login.success', {
    userId: user.id,
    masjidId: user.masjidId,
    role: user.role,
    username,
  });

  return {
    accessToken: signAccessToken({ sub: user.id, masjidId: user.masjidId, role: user.role, committeeRole: user.committeeRole, mustChangePassword: user.mustChangePassword, type: 'user' }),
    refreshToken: signRefreshToken(user.id, 'user'),
    mustChangePassword: user.mustChangePassword,
  };
}

export async function refreshCommitteeToken(token: string) {
  const payload = verifyRefreshToken(token);
  if (payload.type !== 'refresh' || payload.entityType !== 'user') {
    throw new ApiError(401, 'Invalid token type.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active) throw new ApiError(401, 'Account not found or inactive.');

  return {
    accessToken: signAccessToken({ sub: user.id, masjidId: user.masjidId, role: user.role, committeeRole: user.committeeRole, mustChangePassword: user.mustChangePassword, type: 'user' }),
  };
}

// ─── Member OTP auth ──────────────────────────────────────────────────────────

export async function requestMemberOtp(masjidCode: string, phone: string) {
  const masjid = await prisma.masjid.findUnique({ where: { code: masjidCode } });
  if (!masjid || masjid.status !== MasjidStatus.ACTIVE) throw new ApiError(404, 'Masjid not found.');

  const member = await prisma.member.findUnique({
    where: { masjidId_phone: { masjidId: masjid.id, phone } },
  });
  if (!member || !member.active) throw new ApiError(404, 'Member not found.');

  // Enforce resend cooldown — prevents OTP flooding per phone.
  const existingSession = await prisma.otpSession.findUnique({
    where: { masjidId_phone: { masjidId: masjid.id, phone } },
    select: { lastSentAt: true },
  });

  if (existingSession) {
    const elapsedMs = Date.now() - existingSession.lastSentAt.getTime();
    if (elapsedMs < OTP_COOLDOWN_MS) {
      const secondsLeft = Math.ceil((OTP_COOLDOWN_MS - elapsedMs) / 1000);
      throw new ApiError(429, `Please wait ${secondsLeft} seconds before requesting another OTP.`);
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const lastSentAt = new Date();

  // Upsert — one active OTP session per phone per masjid at all times.
  // Resending resets attempt count and clears any existing block.
  await prisma.otpSession.upsert({
    where: { masjidId_phone: { masjidId: masjid.id, phone } },
    create: { memberId: member.id, masjidId: masjid.id, phone, otpHash, expiresAt, lastSentAt },
    update: { otpHash, expiresAt, verified: false, attemptCount: 0, blockedUntil: null, lastSentAt },
  });

  // MVP: log OTP to console — replace with SMS provider (Twilio / MSG91) in Phase 10.
  console.log(`[OTP] ${maskPhone(phone)} → ${otp}`);

  logger.info('auth.member.otp.requested', { memberId: member.id, masjidId: masjid.id, phone: maskPhone(phone) });
}

export async function verifyMemberOtp(masjidCode: string, phone: string, otp: string) {
  const masjid = await prisma.masjid.findUnique({ where: { code: masjidCode } });
  if (!masjid || masjid.status !== MasjidStatus.ACTIVE) {
    logger.warn('auth.member.otp.verify.failure', { masjidCode, phone: maskPhone(phone), reason: 'masjid_not_found' });
    throw new ApiError(401, 'Invalid OTP.');
  }

  const session = await prisma.otpSession.findUnique({
    where: { masjidId_phone: { masjidId: masjid.id, phone } },
  });

  // Block check before anything else — blocked sessions report block even if expired.
  if (session?.blockedUntil && session.blockedUntil > new Date()) {
    const secondsLeft = Math.ceil((session.blockedUntil.getTime() - Date.now()) / 1000);
    logger.warn('auth.member.otp.verify.failure', {
      masjidId: masjid.id,
      phone: maskPhone(phone),
      reason: 'blocked',
      secondsLeft,
    });
    throw new ApiError(429, `Too many failed attempts. Try again in ${secondsLeft} seconds.`);
  }

  if (!session || session.verified || session.expiresAt < new Date()) {
    logger.warn('auth.member.otp.verify.failure', {
      masjidId: masjid.id,
      phone: maskPhone(phone),
      reason: !session ? 'no_session' : session.verified ? 'already_verified' : 'expired',
    });
    throw new ApiError(401, 'Invalid or expired OTP.');
  }

  const valid = await bcrypt.compare(otp, session.otpHash);

  if (!valid) {
    const newCount = session.attemptCount + 1;
    const shouldBlock = newCount >= OTP_MAX_ATTEMPTS;

    const updateData = shouldBlock
      ? { attemptCount: newCount, blockedUntil: new Date(Date.now() + OTP_BLOCK_DURATION_MS) }
      : { attemptCount: newCount };

    await prisma.otpSession.update({ where: { id: session.id }, data: updateData });

    if (shouldBlock) {
      logger.warn('auth.member.otp.verify.failure', {
        masjidId: masjid.id,
        phone: maskPhone(phone),
        reason: 'max_attempts_exceeded',
        attemptCount: newCount,
      });
      throw new ApiError(429, `Too many failed attempts. Try again in ${OTP_BLOCK_DURATION_MS / 60000} minutes.`);
    }

    const remaining = OTP_MAX_ATTEMPTS - newCount;
    logger.warn('auth.member.otp.verify.failure', {
      masjidId: masjid.id,
      phone: maskPhone(phone),
      reason: 'wrong_otp',
      attemptCount: newCount,
      remaining,
    });
    throw new ApiError(401, `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
  }

  // Mark session used and activate the member atomically.
  const member = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.otpSession.update({ where: { id: session.id }, data: { verified: true } });
    return tx.member.update({
      where: { id: session.memberId },
      data: { appActivated: true, lastLoginAt: new Date() },
    });
  });

  // Create long-lived trusted device session (90 days).
  const rawSessionToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawSessionToken);
  await prisma.memberSession.create({
    data: {
      memberId: member.id,
      masjidId: member.masjidId,
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  logger.info('auth.member.otp.verify.success', { memberId: member.id, masjidId: member.masjidId });

  return {
    accessToken: signAccessToken({ sub: member.id, masjidId: member.masjidId, type: 'member' }),
    sessionToken: rawSessionToken,
  };
}

export async function renewMemberSession(rawToken: string) {
  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.memberSession.findUnique({
    where: { tokenHash },
    include: { member: { select: { id: true, masjidId: true, active: true } } },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new ApiError(401, 'Session expired or revoked. Please log in again.');
  }
  if (!session.member.active) throw new ApiError(401, 'Account not found or inactive.');

  await prisma.memberSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  return {
    accessToken: signAccessToken({ sub: session.member.id, masjidId: session.member.masjidId, type: 'member' }),
  };
}

export async function revokeMemberSession(rawToken: string) {
  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.memberSession.findUnique({ where: { tokenHash } });
  if (session && !session.revokedAt) {
    await prisma.memberSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  }
}

// Returns masjids where this phone number is registered (for multi-mosque login flow).
// Only returns masjid name + code — no member details.
export async function lookupMembersByPhone(phone: string) {
  const members = await prisma.member.findMany({
    where: { phone, active: true },
    select: { masjid: { select: { code: true, name: true, status: true } } },
  });
  return members
    .filter((m) => m.masjid.status === MasjidStatus.ACTIVE)
    .map((m) => ({ masjidCode: m.masjid.code, masjidName: m.masjid.name }));
}

// ─── Password change ─────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) throw new ApiError(400, 'New password must be at least 8 characters.');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, active: true },
  });
  if (!user || !user.active) throw new ApiError(404, 'User not found.');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Current password is incorrect.');

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must differ from the current password.');
  }

  const passwordHash = await bcrypt.hash(newPassword, OTP_BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
}

