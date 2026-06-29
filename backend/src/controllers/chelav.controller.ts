import type { RequestHandler } from 'express';
import type { ChelavStatus } from '@prisma/client';
import * as ChelavService from '../services/chelav.service';
import { prisma } from '../config/database';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

const VALID_STATUSES = new Set<string>(['ASSIGNED', 'COMPLETED', 'SKIPPED', 'SWAPPED']);

// GET /committee/chelav/today
export const getToday: RequestHandler = async (req, res) => {
  const entry = await ChelavService.getTodayChelav(req.user!.masjidId!);
  sendSuccess(res, { entry });
};

// GET /committee/chelav/:year/:month
export const getMonth: RequestHandler = async (req, res) => {
  const year  = parseInt(req.params['year']  as string, 10);
  const month = parseInt(req.params['month'] as string, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new ApiError(400, 'Invalid year or month.');
  }
  const entries = await ChelavService.getMonthSchedule(req.user!.masjidId!, year, month);
  sendSuccess(res, { entries });
};

// PATCH /committee/chelav/:id/status
export const updateStatus: RequestHandler = async (req, res) => {
  const masjidId  = req.user!.masjidId!;
  const scheduleId = req.params['id'] as string;
  if (!scheduleId) throw new ApiError(400, 'Missing schedule id.');

  const { status, notes } = req.body as { status?: string; notes?: string };
  if (!status || !VALID_STATUSES.has(status)) {
    throw new ApiError(400, `status must be one of: ${[...VALID_STATUSES].join(', ')}.`);
  }

  const entry = await ChelavService.updateChelavStatus(
    masjidId,
    scheduleId,
    req.user!.id,
    status as ChelavStatus,
    typeof notes === 'string' ? notes : undefined,
  );

  sendSuccess(res, { entry }, 'Status updated.');
};

// POST /committee/chelav/swap
export const swap: RequestHandler = async (req, res) => {
  const { id1, id2 } = req.body as { id1?: string; id2?: string };
  if (!id1 || !id2) throw new ApiError(400, 'id1 and id2 are required.');

  const [e1, e2] = await ChelavService.swapChelavEntries(req.user!.masjidId!, id1, id2, req.user!.id);
  sendSuccess(res, { entries: [e1, e2] }, 'Entries swapped.');
};

// POST /committee/chelav/import
// Body: { entries: [{ date: "YYYY-MM-DD", displayLabel: string, memberQuery?: string }] }
// memberQuery: optional member name or code — resolved server-side.
export const importSchedule: RequestHandler = async (req, res) => {
  const masjidId = req.user!.masjidId!;
  const raw = (req.body as { entries?: unknown }).entries;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ApiError(400, 'entries array is required and must not be empty.');
  }
  if (raw.length > 400) {
    throw new ApiError(400, 'Maximum 400 entries per import.');
  }

  // Resolve member names/codes to IDs in bulk
  const allMembers = await prisma.member.findMany({
    where: { masjidId, active: true },
    select: { id: true, name: true, memberCode: true },
  });
  const byCode = new Map(allMembers.map(m => [m.memberCode.toLowerCase(), m.id]));
  const byName = new Map(allMembers.map(m => [m.name.toLowerCase(), m.id]));

  const entries: ChelavService.ImportEntry[] = raw.map((r: unknown) => {
    const row = r as Record<string, unknown>;
    const query = typeof row['memberQuery'] === 'string' ? row['memberQuery'].trim().toLowerCase() : null;
    const resolvedId = query ? (byCode.get(query) ?? byName.get(query)) : undefined;

    const entry: ChelavService.ImportEntry = {
      date:         typeof row['date'] === 'string' ? row['date'] : '',
      displayLabel: typeof row['displayLabel'] === 'string' ? row['displayLabel'] : '',
    };
    if (resolvedId) entry.memberId = resolvedId;
    return entry;
  });

  const result = await ChelavService.importChelavSchedule(masjidId, req.user!.id, entries);
  sendSuccess(res, result, `Imported ${result.imported} entries.`);
};
