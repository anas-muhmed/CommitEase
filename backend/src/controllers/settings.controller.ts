import type { RequestHandler } from 'express';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

export const getSettings: RequestHandler = async (req, res) => {
  const masjidId = req.user!.masjidId!;
  const [masjid, me] = await Promise.all([
    prisma.masjid.findUnique({
      where: { id: masjidId },
      select: { id: true, code: true, name: true, address: true, contactPhone: true },
    }),
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, username: true, committeeRole: true },
    }),
  ]);
  if (!masjid) throw new ApiError(404, 'Mosque not found.');
  sendSuccess(res, { masjid, me });
};

export const updateSettings: RequestHandler = async (req, res) => {
  const masjidId = req.user!.masjidId!;
  const body = req.body as Record<string, unknown>;

  const updateData: { name?: string; address?: string | null; contactPhone?: string | null } = {};

  if (typeof body['name'] === 'string' && body['name'].trim()) {
    updateData.name = body['name'].trim();
  }
  if ('address' in body) {
    updateData.address = typeof body['address'] === 'string' && body['address'].trim()
      ? body['address'].trim()
      : null;
  }
  if ('contactPhone' in body) {
    updateData.contactPhone = typeof body['contactPhone'] === 'string' && body['contactPhone'].trim()
      ? body['contactPhone'].trim()
      : null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, 'No valid fields to update.');
  }

  const updated = await prisma.masjid.update({
    where: { id: masjidId },
    data: updateData,
    select: { id: true, code: true, name: true, address: true, contactPhone: true },
  });

  sendSuccess(res, updated);
};
