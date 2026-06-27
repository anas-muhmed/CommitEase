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

// A valid bcrypt hash used when the user is not found — ensures bcrypt.compare
// always runs so that response time does not reveal whether an account exists.
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  return phone.length > 4 ? '*'.repeat(phone.length - 4) + phone.slice(-4) : '****';
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

  logger.info('auth.member.otp.verify.success', { memberId: member.id, masjidId: member.masjidId });

  return {
    accessToken: signAccessToken({ sub: member.id, masjidId: member.masjidId, type: 'member' }),
    refreshToken: signRefreshToken(member.id, 'member'),
  };
}

export async function refreshMemberToken(token: string) {
  const payload = verifyRefreshToken(token);
  if (payload.type !== 'refresh' || payload.entityType !== 'member') {
    throw new ApiError(401, 'Invalid token type.');
  }

  const member = await prisma.member.findUnique({ where: { id: payload.sub } });
  if (!member || !member.active) throw new ApiError(401, 'Account not found or inactive.');

  return {
    accessToken: signAccessToken({ sub: member.id, masjidId: member.masjidId, type: 'member' }),
  };
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

// ─── Device-Trust Architecture (Planned — Phase 5) ───────────────────────────
//
// Current: member refresh tokens are stateless 30-day JWTs. Logout clears the
// cookie client-side but the token stays mathematically valid until expiry.
// Members re-authenticate via OTP every 30 days. For non-technical users who
// open the app infrequently, this is unacceptable UX.
//
// New product rule:
//   - OTP required only on first login or explicit re-authentication
//   - Successful OTP verify creates a MemberSession (trusted device record)
//   - Sessions auto-refresh on activity; hard expiry at 90 days
//   - Re-auth required only when: 90-day expiry, explicit logout,
//     committee revocation, or suspicious invalidation
//
// Planned MemberSession schema (add in Phase 5):
//   model MemberSession {
//     id           String    @id @default(uuid())
//     memberId     String
//     masjidId     String
//     tokenHash    String    @unique   -- HMAC-SHA256 of the cookie value
//     deviceName   String?             -- from User-Agent (e.g. "Samsung A51")
//     lastActiveAt DateTime            -- updated on each refresh
//     expiresAt    DateTime            -- 90 days from creation, non-sliding
//     revokedAt    DateTime?           -- set by committee to force re-auth
//     createdAt    DateTime  @default(now())
//   }
//
// Implementation changes (Phase 5):
//   - verifyMemberOtp: after transaction, create MemberSession, set mrt cookie
//     to crypto.randomBytes(32).toString('hex') (the pre-hash value)
//   - memberRefresh: replace JWT verification with DB session lookup by
//     HMAC(mrt cookie value) → confirm not revoked, not expired →
//     update lastActiveAt → issue new access token
//   - memberLogout: set revokedAt = now() on the session
//   - Phase 8: committee panel shows active sessions per member, can revoke
//
// Security notes:
//   - tokenHash = HMAC-SHA256(rawToken, HMAC_SECRET env var)
//   - Cookie remains HttpOnly; Secure; SameSite=Strict
//   - Max-Age = 90 days (browser enforces hard limit independently)
// ─────────────────────────────────────────────────────────────────────────────
