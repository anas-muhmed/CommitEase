import type { ChelavStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';

// ── Select shape returned by all queries ──────────────────────────────────────

const CHELAV_SELECT = {
  id: true,
  masjidId: true,
  memberId: true,
  displayLabel: true,
  date: true,
  status: true,
  notes: true,
  swappedWithId: true,
  createdAt: true,
  updatedAt: true,
  member: {
    select: { id: true, name: true, memberCode: true, phone: true },
  },
} as const;

// ── Today's entry ─────────────────────────────────────────────────────────────

export async function getTodayChelav(masjidId: string) {
  const today = todayUTC();
  const entry = await prisma.chelavSchedule.findUnique({
    where: { masjidId_date: { masjidId, date: today } },
    select: CHELAV_SELECT,
  });
  return entry;
}

// ── Month schedule ────────────────────────────────────────────────────────────

export async function getMonthSchedule(masjidId: string, year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 0));  // last day of month

  const entries = await prisma.chelavSchedule.findMany({
    where: { masjidId, date: { gte: start, lte: end } },
    select: CHELAV_SELECT,
    orderBy: { date: 'asc' },
  });

  return entries;
}

// ── Update status ─────────────────────────────────────────────────────────────

export async function updateChelavStatus(
  masjidId: string,
  scheduleId: string,
  actorId: string,
  status: ChelavStatus,
  notes?: string,
) {
  const entry = await prisma.chelavSchedule.findFirst({
    where: { id: scheduleId, masjidId },
    select: { id: true, status: true, displayLabel: true, date: true },
  });
  if (!entry) throw new ApiError(404, 'Chelav schedule entry not found.');

  const updated = await prisma.chelavSchedule.update({
    where: { id: scheduleId },
    data: {
      status,
      ...(notes !== undefined && { notes }),
    },
    select: CHELAV_SELECT,
  });

  await logAudit({
    masjidId, actorId,
    action: 'CHELAV_STATUS_UPDATED',
    entityType: 'ChelavSchedule',
    entityId: scheduleId,
    oldValue: { status: entry.status },
    newValue: { status, ...(notes !== undefined && { notes }) },
  });

  return updated;
}

// ── Swap two entries ──────────────────────────────────────────────────────────
// Exchanges memberId + displayLabel between two schedule entries atomically,
// then marks both as SWAPPED with a cross-reference.

export async function swapChelavEntries(
  masjidId: string,
  id1: string,
  id2: string,
  actorId: string,
) {
  if (id1 === id2) throw new ApiError(400, 'Cannot swap an entry with itself.');

  const [e1, e2] = await Promise.all([
    prisma.chelavSchedule.findFirst({ where: { id: id1, masjidId }, select: CHELAV_SELECT }),
    prisma.chelavSchedule.findFirst({ where: { id: id2, masjidId }, select: CHELAV_SELECT }),
  ]);
  if (!e1) throw new ApiError(404, `Schedule entry ${id1} not found.`);
  if (!e2) throw new ApiError(404, `Schedule entry ${id2} not found.`);

  const [updated1, updated2] = await prisma.$transaction([
    prisma.chelavSchedule.update({
      where: { id: id1 },
      data: { memberId: e2.memberId, displayLabel: e2.displayLabel, status: 'SWAPPED', swappedWithId: id2 },
      select: CHELAV_SELECT,
    }),
    prisma.chelavSchedule.update({
      where: { id: id2 },
      data: { memberId: e1.memberId, displayLabel: e1.displayLabel, status: 'SWAPPED', swappedWithId: id1 },
      select: CHELAV_SELECT,
    }),
  ]);

  await logAudit({
    masjidId, actorId,
    action: 'CHELAV_SWAPPED',
    entityType: 'ChelavSchedule',
    entityId: id1,
    oldValue: { date1: e1.date, label1: e1.displayLabel, date2: e2.date, label2: e2.displayLabel },
    newValue: { swappedIds: [id1, id2] },
  });

  return [updated1, updated2] as const;
}

// ── Import (bulk upsert) ──────────────────────────────────────────────────────
// Accepts pre-parsed entries. memberId resolution is done by the caller
// (controller parses CSV rows, looks up members by name/code).

export interface ImportEntry {
  date: string;           // ISO date string "YYYY-MM-DD"
  displayLabel: string;
  memberId?: string;
}

export async function importChelavSchedule(
  masjidId: string,
  actorId: string,
  entries: ImportEntry[],
) {
  let imported = 0;
  const errors: { row: number; date: string; message: string }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const dateObj = parseDate(entry.date);
    if (!dateObj) {
      errors.push({ row: i + 1, date: entry.date, message: 'Invalid date format. Use YYYY-MM-DD.' });
      continue;
    }
    if (!entry.displayLabel.trim()) {
      errors.push({ row: i + 1, date: entry.date, message: 'displayLabel is required.' });
      continue;
    }

    try {
      await prisma.chelavSchedule.upsert({
        where: { masjidId_date: { masjidId, date: dateObj } },
        create: {
          masjidId,
          date: dateObj,
          displayLabel: entry.displayLabel.trim(),
          memberId: entry.memberId ?? null,
          status: 'ASSIGNED',
        },
        update: {
          displayLabel: entry.displayLabel.trim(),
          memberId: entry.memberId ?? null,
          status: 'ASSIGNED',
          notes: null,
          swappedWithId: null,
        },
      });
      imported++;
    } catch {
      errors.push({ row: i + 1, date: entry.date, message: 'Failed to save entry.' });
    }
  }

  if (imported > 0) {
    await logAudit({
      masjidId, actorId,
      action: 'CHELAV_IMPORTED',
      entityType: 'ChelavSchedule',
      entityId: masjidId,
      oldValue: {},
      newValue: { imported, errors: errors.length },
    });
  }

  return { imported, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(parseInt(m[1]!), parseInt(m[2]!) - 1, parseInt(m[3]!)));
  return isNaN(d.getTime()) ? null : d;
}
