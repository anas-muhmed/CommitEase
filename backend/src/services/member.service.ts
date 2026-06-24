import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { Workbook } from 'exceljs';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logAudit } from './audit.service';

// ─── Member code generation ───────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateMemberCode(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const byte of bytes) {
    suffix += CODE_CHARS[byte % CODE_CHARS.length]!;
  }
  return `M-${suffix}`;
}

// Prisma includes the constraint name in meta.target for PostgreSQL @@unique violations.
function isMemberCodeConflict(err: Prisma.PrismaClientKnownRequestError): boolean {
  const target = err.meta?.['target'];
  if (Array.isArray(target)) return (target as string[]).some((t) => String(t).includes('memberCode'));
  if (typeof target === 'string') return target.includes('memberCode');
  return false;
}

// ─── Shared select ────────────────────────────────────────────────────────────

const MEMBER_SELECT = {
  id: true,
  masjidId: true,
  memberCode: true,
  name: true,
  phone: true,
  address: true,
  contributionStartDate: true,
  openingDueBalance: true,
  appActivated: true,
  lastLoginAt: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateMemberInput {
  name: string;
  phone: string;
  contributionStartDate: string;
  memberCode?: string;
  address?: string;
  openingDueBalance?: number;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createMember(
  masjidId: string,
  actorId: string,
  input: CreateMemberInput,
) {
  const contributionStartDate = new Date(input.contributionStartDate);
  if (isNaN(contributionStartDate.getTime())) {
    throw new ApiError(400, 'contributionStartDate must be a valid ISO date string (e.g. 2024-01-01).');
  }

  const baseData = {
    masjidId,
    name: input.name,
    phone: input.phone,
    contributionStartDate,
    ...(input.address !== undefined && { address: input.address }),
    ...(input.openingDueBalance !== undefined && { openingDueBalance: input.openingDueBalance }),
  };

  // Caller-provided code: P2002 bubbles to errorHandler as 409.
  if (input.memberCode !== undefined) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const member = await tx.member.create({
        data: { ...baseData, memberCode: input.memberCode! },
        select: MEMBER_SELECT,
      });
      await logAudit(
        { masjidId, actorId, action: 'MEMBER_CREATED', entityType: 'Member', entityId: member.id,
          newValue: { memberCode: member.memberCode, name: member.name } },
        tx,
      );
      return member;
    });
  }

  // Auto-generate — retry once on memberCode collision only.
  for (let attempt = 0; attempt < 2; attempt++) {
    const memberCode = generateMemberCode();
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const member = await tx.member.create({
          data: { ...baseData, memberCode },
          select: MEMBER_SELECT,
        });
        await logAudit(
          { masjidId, actorId, action: 'MEMBER_CREATED', entityType: 'Member', entityId: member.id,
            newValue: { memberCode: member.memberCode, name: member.name } },
          tx,
        );
        return member;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        isMemberCodeConflict(err) &&
        attempt === 0
      ) {
        continue;
      }
      throw err;
    }
  }

  // 36^6 ≈ 2.1B unique codes; two consecutive collisions is astronomically unlikely.
  throw new ApiError(500, 'Failed to generate a unique member code. Please try again.');
}

export async function listMembers(
  masjidId: string,
  query: { page?: number; limit?: number; search?: string; active?: boolean },
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.MemberWhereInput = {
    masjidId,
    ...(query.active !== undefined && { active: query.active }),
    ...(query.search !== undefined && query.search.trim() !== '' && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { memberCode: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [members, total] = await prisma.$transaction([
    prisma.member.findMany({
      where,
      select: MEMBER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.member.count({ where }),
  ]);

  return { members, total, page, limit };
}

export async function getMemberById(masjidId: string, memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: MEMBER_SELECT,
  });
  if (!member) throw new ApiError(404, 'Member not found.');
  return member;
}

export async function updateMember(
  masjidId: string,
  memberId: string,
  actorId: string,
  input: {
    name?: string;
    phone?: string;
    address?: string;
    contributionStartDate?: string;
    openingDueBalance?: number;
  },
) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: {
      id: true, name: true, phone: true, address: true,
      contributionStartDate: true, openingDueBalance: true,
    },
  });
  if (!existing) throw new ApiError(404, 'Member not found.');

  let contributionStartDate: Date | undefined;
  if (input.contributionStartDate !== undefined) {
    contributionStartDate = new Date(input.contributionStartDate);
    if (isNaN(contributionStartDate.getTime())) {
      throw new ApiError(400, 'contributionStartDate must be a valid ISO date string.');
    }
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.address !== undefined && { address: input.address }),
      ...(contributionStartDate !== undefined && { contributionStartDate }),
      ...(input.openingDueBalance !== undefined && { openingDueBalance: input.openingDueBalance }),
    },
    select: MEMBER_SELECT,
  });

  await logAudit({
    masjidId, actorId, action: 'MEMBER_UPDATED', entityType: 'Member', entityId: memberId,
    oldValue: {
      name: existing.name, phone: existing.phone, address: existing.address ?? null,
      contributionStartDate: existing.contributionStartDate.toISOString(),
    },
    newValue: {
      name: updated.name, phone: updated.phone, address: updated.address ?? null,
      contributionStartDate: updated.contributionStartDate.toISOString(),
    },
  });

  return updated;
}

export async function deactivateMember(masjidId: string, memberId: string, actorId: string) {
  const existing = await prisma.member.findUnique({
    where: { id: memberId, masjidId },
    select: { id: true, active: true },
  });
  if (!existing) throw new ApiError(404, 'Member not found.');
  if (!existing.active) throw new ApiError(409, 'Member is already inactive.');

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { active: false },
    select: { id: true, memberCode: true, name: true, active: true },
  });

  await logAudit({
    masjidId, actorId, action: 'MEMBER_DEACTIVATED', entityType: 'Member', entityId: memberId,
    oldValue: { active: true }, newValue: { active: false },
  });

  return updated;
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String((value as { text: unknown }).text ?? '').trim();
    if ('result' in value) return cellToString((value as { result?: unknown }).result);
    if ('error' in value) return '';
  }
  return '';
}

export interface BulkImportError {
  row: number;
  message: string;
}

export async function bulkImportMembers(
  masjidId: string,
  actorId: string,
  fileBuffer: Buffer,
): Promise<{ created: number; errors: BulkImportError[] }> {
  const workbook = new Workbook();
  // @types/node v26 made Buffer generic; exceljs types predate this. Copy bytes
  // into a plain ArrayBuffer (part of the load() union type) to avoid the mismatch.
  const ab = new ArrayBuffer(fileBuffer.byteLength);
  new Uint8Array(ab).set(fileBuffer);
  await workbook.xlsx.load(ab);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ApiError(400, 'Excel file contains no worksheets.');

  // Build header-name → column-number map from row 1 (case/whitespace insensitive).
  const headerMap = new Map<string, number>();
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = cellToString(cell.value).toLowerCase().replace(/\s+/g, '');
    if (header) headerMap.set(header, colNumber);
  });

  const requiredHeaders = ['name', 'phone', 'contributionstartdate'];
  const missing = requiredHeaders.filter((h) => !headerMap.has(h));
  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Excel file is missing required columns: ${missing.join(', ')}. ` +
      `Expected headers: name, phone, contributionStartDate, ` +
      `memberCode (optional), address (optional), openingDueBalance (optional).`,
    );
  }

  const errors: BulkImportError[] = [];
  let created = 0;

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    const getCell = (header: string): string => {
      const col = headerMap.get(header);
      if (col === undefined) return '';
      return cellToString(row.getCell(col).value);
    };

    const name = getCell('name');
    const phone = getCell('phone');
    const contributionStartDate = getCell('contributionstartdate');
    const memberCodeRaw = getCell('membercode');
    const addressRaw = getCell('address');
    const openingDueBalanceRaw = getCell('openingduebalance');

    // Skip entirely blank rows silently.
    if (!name && !phone && !contributionStartDate) continue;

    if (!name) { errors.push({ row: rowNumber, message: 'name is required.' }); continue; }
    if (!phone) { errors.push({ row: rowNumber, message: 'phone is required.' }); continue; }
    if (!contributionStartDate) { errors.push({ row: rowNumber, message: 'contributionStartDate is required.' }); continue; }

    const startDate = new Date(contributionStartDate);
    if (isNaN(startDate.getTime())) {
      errors.push({ row: rowNumber, message: `contributionStartDate "${contributionStartDate}" is not a valid date (use YYYY-MM-DD).` });
      continue;
    }

    let openingDueBalance: number | undefined;
    if (openingDueBalanceRaw !== '') {
      const parsed = Number(openingDueBalanceRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push({ row: rowNumber, message: `openingDueBalance "${openingDueBalanceRaw}" must be a non-negative number.` });
        continue;
      }
      openingDueBalance = parsed;
    }

    const memberCode = memberCodeRaw || undefined;
    const address = addressRaw || undefined;

    try {
      await createMember(masjidId, actorId, {
        name,
        phone,
        contributionStartDate,
        ...(memberCode !== undefined && { memberCode }),
        ...(address !== undefined && { address }),
        ...(openingDueBalance !== undefined && { openingDueBalance }),
      });
      created++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        errors.push({ row: rowNumber, message: 'A member with this phone or member code already exists in this masjid.' });
      } else if (err instanceof ApiError) {
        errors.push({ row: rowNumber, message: err.message });
      } else {
        errors.push({ row: rowNumber, message: 'Unexpected error creating member.' });
      }
    }
  }

  return { created, errors };
}
