import bcrypt from 'bcrypt';
import { MasjidStatus, SignupRequestStatus, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { logAudit } from './audit.service';

const BCRYPT_ROUNDS = 10;
const CODE_REGEX = /^[A-Z0-9]{3,10}$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateCode(raw: string): string {
  const code = raw.toUpperCase();
  if (!CODE_REGEX.test(code)) {
    throw new ApiError(400, 'Masjid code must be 3–10 uppercase alphanumeric characters (e.g. MZ001).');
  }
  return code;
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters.');
  }
}

// ─── Masjid CRUD (SUPER_ADMIN — Path A) ──────────────────────────────────────

export async function createMasjid(
  actorId: string,
  input: {
    code: string;
    name: string;
    address?: string;
    contactPhone?: string;
    adminName: string;
    adminUsername: string;
    adminPassword: string;
  },
) {
  const code = validateCode(input.code);
  validatePassword(input.adminPassword);

  const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const masjid = await tx.masjid.create({
      data: {
        code,
        name: input.name,
        ...(input.address !== undefined && { address: input.address }),
        ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
        status: MasjidStatus.ACTIVE,
      },
      select: { id: true, code: true, name: true, address: true, contactPhone: true, status: true, createdAt: true },
    });

    const admin = await tx.user.create({
      data: {
        masjidId: masjid.id,
        name: input.adminName,
        username: input.adminUsername,
        passwordHash,
        role: UserRole.COMMITTEE_ADMIN,
        mustChangePassword: true,
      },
      select: { id: true, name: true, username: true, role: true, mustChangePassword: true },
    });

    // Every new masjid gets one default plan so onboarding works without extra config.
    await tx.contributionPlan.create({
      data: { masjidId: masjid.id, name: 'General Member', active: true },
    });

    await logAudit({ masjidId: masjid.id, actorId, action: 'MASJID_CREATED', entityType: 'Masjid', entityId: masjid.id,
      newValue: { code: masjid.code, name: masjid.name, status: masjid.status } }, tx);

    await logAudit({ masjidId: masjid.id, actorId, action: 'USER_CREATED', entityType: 'User', entityId: admin.id,
      newValue: { username: admin.username, role: admin.role } }, tx);

    return { masjid, admin };
  });
}

export async function listMasjids() {
  return prisma.masjid.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      _count: { select: { members: true, users: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMasjidById(masjidId: string) {
  const masjid = await prisma.masjid.findUnique({
    where: { id: masjidId },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      users: {
        where: { active: true },
        select: { id: true, name: true, username: true, role: true, active: true, mustChangePassword: true, createdAt: true },
      },
    },
  });
  if (!masjid) throw new ApiError(404, 'Masjid not found.');
  return masjid;
}

export async function updateMasjid(
  masjidId: string,
  actorId: string,
  input: { name?: string; address?: string; contactPhone?: string },
) {
  const existing = await prisma.masjid.findUnique({
    where: { id: masjidId },
    select: { id: true, name: true, address: true, contactPhone: true },
  });
  if (!existing) throw new ApiError(404, 'Masjid not found.');

  const updated = await prisma.masjid.update({
    where: { id: masjidId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
    },
    select: { id: true, code: true, name: true, address: true, contactPhone: true, status: true, updatedAt: true },
  });

  await logAudit({ masjidId, actorId, action: 'MASJID_UPDATED', entityType: 'Masjid', entityId: masjidId,
    oldValue: { name: existing.name, address: existing.address, contactPhone: existing.contactPhone },
    newValue: { name: updated.name, address: updated.address, contactPhone: updated.contactPhone } });

  return updated;
}

export async function approveMasjid(masjidId: string, actorId: string) {
  const existing = await prisma.masjid.findUnique({ where: { id: masjidId }, select: { id: true, status: true } });
  if (!existing) throw new ApiError(404, 'Masjid not found.');
  if (existing.status === MasjidStatus.ACTIVE) throw new ApiError(409, 'Masjid is already active.');

  const updated = await prisma.masjid.update({
    where: { id: masjidId },
    data: { status: MasjidStatus.ACTIVE },
    select: { id: true, code: true, name: true, status: true },
  });

  await logAudit({ masjidId, actorId, action: 'MASJID_APPROVED', entityType: 'Masjid', entityId: masjidId,
    oldValue: { status: existing.status }, newValue: { status: MasjidStatus.ACTIVE } });

  return updated;
}

export async function suspendMasjid(masjidId: string, actorId: string) {
  const existing = await prisma.masjid.findUnique({ where: { id: masjidId }, select: { id: true, status: true } });
  if (!existing) throw new ApiError(404, 'Masjid not found.');
  if (existing.status === MasjidStatus.SUSPENDED) throw new ApiError(409, 'Masjid is already suspended.');

  const updated = await prisma.masjid.update({
    where: { id: masjidId },
    data: { status: MasjidStatus.SUSPENDED },
    select: { id: true, code: true, name: true, status: true },
  });

  await logAudit({ masjidId, actorId, action: 'MASJID_SUSPENDED', entityType: 'Masjid', entityId: masjidId,
    oldValue: { status: existing.status }, newValue: { status: MasjidStatus.SUSPENDED } });

  return updated;
}

// ─── Committee admin creation ─────────────────────────────────────────────────

export async function createCommitteeAdmin(
  masjidId: string,
  actorId: string,
  input: { name: string; username: string; password: string },
) {
  const masjid = await prisma.masjid.findUnique({ where: { id: masjidId }, select: { id: true } });
  if (!masjid) throw new ApiError(404, 'Masjid not found.');
  validatePassword(input.password);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      masjidId,
      name: input.name,
      username: input.username,
      passwordHash,
      role: UserRole.COMMITTEE_ADMIN,
      mustChangePassword: true,
    },
    select: { id: true, name: true, username: true, role: true, mustChangePassword: true, createdAt: true },
  });

  await logAudit({ masjidId, actorId, action: 'USER_CREATED', entityType: 'User', entityId: user.id,
    newValue: { username: user.username, role: user.role } });

  return user;
}

// ─── Signup requests (Path B — public lead flow) ──────────────────────────────

export async function createSignupRequest(input: {
  masjidName: string;
  location: string;
  applicantName: string;
  phone: string;
  notes?: string;
}) {
  const request = await prisma.masjidSignupRequest.create({
    data: {
      masjidName: input.masjidName,
      location: input.location,
      applicantName: input.applicantName,
      phone: input.phone,
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    select: { id: true, masjidName: true, applicantName: true, status: true, createdAt: true },
  });

  logger.info('signup.request.created', { requestId: request.id, masjidName: request.masjidName });
  return request;
}

export async function listSignupRequests(status?: SignupRequestStatus) {
  const where = status !== undefined ? { status } : {};
  return prisma.masjidSignupRequest.findMany({
    where,
    select: {
      id: true,
      masjidName: true,
      location: true,
      applicantName: true,
      phone: true,
      notes: true,
      status: true,
      rejectionNote: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function approveSignupRequest(
  requestId: string,
  actorId: string,
  input: {
    masjidCode: string;
    adminName: string;
    adminUsername: string;
    adminPassword: string;
  },
) {
  const request = await prisma.masjidSignupRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ApiError(404, 'Signup request not found.');
  if (request.status !== SignupRequestStatus.PENDING) {
    throw new ApiError(409, `Request has already been ${request.status.toLowerCase()}.`);
  }

  const code = validateCode(input.masjidCode);
  validatePassword(input.adminPassword);

  const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS);
  const now = new Date();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const masjid = await tx.masjid.create({
      data: {
        code,
        name: request.masjidName,
        address: request.location,
        status: MasjidStatus.ACTIVE,
      },
      select: { id: true, code: true, name: true, status: true, createdAt: true },
    });

    const admin = await tx.user.create({
      data: {
        masjidId: masjid.id,
        name: input.adminName,
        username: input.adminUsername,
        passwordHash,
        role: UserRole.COMMITTEE_ADMIN,
        mustChangePassword: true,
      },
      select: { id: true, name: true, username: true, role: true, mustChangePassword: true },
    });

    await tx.contributionPlan.create({
      data: { masjidId: masjid.id, name: 'General Member', active: true },
    });

    await tx.masjidSignupRequest.update({
      where: { id: requestId },
      data: { status: SignupRequestStatus.APPROVED, reviewedAt: now, reviewedById: actorId },
    });

    await logAudit({ masjidId: masjid.id, actorId, action: 'MASJID_CREATED_FROM_SIGNUP', entityType: 'Masjid', entityId: masjid.id,
      newValue: { code: masjid.code, name: masjid.name, fromRequestId: requestId } }, tx);

    await logAudit({ masjidId: masjid.id, actorId, action: 'USER_CREATED', entityType: 'User', entityId: admin.id,
      newValue: { username: admin.username, role: admin.role } }, tx);

    return { masjid, admin };
  });
}

export async function rejectSignupRequest(
  requestId: string,
  actorId: string,
  rejectionNote?: string,
) {
  const request = await prisma.masjidSignupRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ApiError(404, 'Signup request not found.');
  if (request.status !== SignupRequestStatus.PENDING) {
    throw new ApiError(409, `Request has already been ${request.status.toLowerCase()}.`);
  }

  const updated = await prisma.masjidSignupRequest.update({
    where: { id: requestId },
    data: {
      status: SignupRequestStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: actorId,
      ...(rejectionNote !== undefined && { rejectionNote }),
    },
    select: { id: true, status: true, rejectionNote: true, reviewedAt: true },
  });

  logger.info('signup.request.rejected', { requestId, actorId });
  return updated;
}
