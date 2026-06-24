import type { RequestHandler } from 'express';
import { SignupRequestStatus } from '@prisma/client';
import * as MasjidService from '../services/masjid.service';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

// ─── Input helpers ────────────────────────────────────────────────────────────

function requireString(body: Record<string, unknown>, field: string): string {
  const val = body[field];
  if (typeof val !== 'string' || !val.trim()) throw new ApiError(400, `${field} is required.`);
  return val.trim();
}

function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const val = body[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') throw new ApiError(400, `${field} must be a string.`);
  return val.trim() || undefined;
}

// Express 5 types express params as string | string[] — take the scalar value.
function param(req: Parameters<RequestHandler>[0], name: string): string {
  const val = req.params[name];
  if (!val) throw new ApiError(400, `Missing route parameter: ${name}`);
  return Array.isArray(val) ? (val[0] ?? '') : val;
}

// ─── Masjid management (SUPER_ADMIN) ─────────────────────────────────────────

export const createMasjid: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const actorId = req.user!.id;

  const code = requireString(body, 'code');
  const name = requireString(body, 'name');
  const address = optionalString(body, 'address');
  const contactPhone = optionalString(body, 'contactPhone');
  const adminName = requireString(body, 'adminName');
  const adminUsername = requireString(body, 'adminUsername');
  const adminPassword = requireString(body, 'adminPassword');

  const result = await MasjidService.createMasjid(actorId, {
    code,
    name,
    adminName,
    adminUsername,
    adminPassword,
    ...(address !== undefined && { address }),
    ...(contactPhone !== undefined && { contactPhone }),
  });

  sendSuccess(res, result, 'Masjid created.', 201);
};

export const listMasjids: RequestHandler = async (_req, res) => {
  const result = await MasjidService.listMasjids();
  sendSuccess(res, result);
};

export const getMasjid: RequestHandler = async (req, res) => {
  const result = await MasjidService.getMasjidById(param(req, 'masjidId'));
  sendSuccess(res, result);
};

export const updateMasjid: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const masjidId = param(req, 'masjidId');
  const name = optionalString(body, 'name');
  const address = optionalString(body, 'address');
  const contactPhone = optionalString(body, 'contactPhone');

  const result = await MasjidService.updateMasjid(masjidId, req.user!.id, {
    ...(name !== undefined && { name }),
    ...(address !== undefined && { address }),
    ...(contactPhone !== undefined && { contactPhone }),
  });
  sendSuccess(res, result, 'Masjid updated.');
};

export const approveMasjid: RequestHandler = async (req, res) => {
  const result = await MasjidService.approveMasjid(param(req, 'masjidId'), req.user!.id);
  sendSuccess(res, result, 'Masjid approved.');
};

export const suspendMasjid: RequestHandler = async (req, res) => {
  const result = await MasjidService.suspendMasjid(param(req, 'masjidId'), req.user!.id);
  sendSuccess(res, result, 'Masjid suspended.');
};

// ─── Committee admin creation ─────────────────────────────────────────────────

export const createCommitteeAdmin: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const result = await MasjidService.createCommitteeAdmin(param(req, 'masjidId'), req.user!.id, {
    name: requireString(body, 'name'),
    username: requireString(body, 'username'),
    password: requireString(body, 'password'),
  });
  sendSuccess(res, result, 'Committee admin created.', 201);
};

// ─── Signup request management (SUPER_ADMIN) ─────────────────────────────────

export const listSignupRequests: RequestHandler = async (req, res) => {
  const rawStatus = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
  const validStatuses = new Set<string>(['PENDING', 'APPROVED', 'REJECTED']);
  if (rawStatus !== undefined && !validStatuses.has(rawStatus)) {
    throw new ApiError(400, 'status must be PENDING, APPROVED, or REJECTED.');
  }
  const result = await MasjidService.listSignupRequests(rawStatus as SignupRequestStatus | undefined);
  sendSuccess(res, result);
};

export const approveSignupRequest: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const result = await MasjidService.approveSignupRequest(param(req, 'requestId'), req.user!.id, {
    masjidCode: requireString(body, 'masjidCode'),
    adminName: requireString(body, 'adminName'),
    adminUsername: requireString(body, 'adminUsername'),
    adminPassword: requireString(body, 'adminPassword'),
  });
  sendSuccess(res, result, 'Signup request approved. Masjid and committee admin created.', 201);
};

export const rejectSignupRequest: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const rejectionNote = optionalString(body, 'rejectionNote');
  const result = await MasjidService.rejectSignupRequest(
    param(req, 'requestId'),
    req.user!.id,
    ...(rejectionNote !== undefined ? [rejectionNote] : []),
  );
  sendSuccess(res, result, 'Signup request rejected.');
};

// ─── Public ───────────────────────────────────────────────────────────────────

export const publicSignup: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const notes = optionalString(body, 'notes');
  const result = await MasjidService.createSignupRequest({
    masjidName: requireString(body, 'masjidName'),
    location: requireString(body, 'location'),
    applicantName: requireString(body, 'applicantName'),
    phone: requireString(body, 'phone'),
    ...(notes !== undefined && { notes }),
  });
  sendSuccess(
    res,
    result,
    'Your registration request has been submitted. Our team will review and contact you shortly.',
    201,
  );
};
