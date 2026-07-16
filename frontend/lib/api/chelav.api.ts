import { apiClient } from './client';

export type ChelavStatus = 'ASSIGNED' | 'COMPLETED' | 'SKIPPED' | 'SWAPPED';

export interface ChelavMember {
  id: string;
  name: string;
  memberCode: string;
  phone: string;
}

export interface ChelavEntry {
  id: string;
  masjidId: string;
  memberId: string | null;
  displayLabel: string;
  date: string;
  status: ChelavStatus;
  notes: string | null;
  swappedWithId: string | null;
  createdAt: string;
  updatedAt: string;
  member: ChelavMember | null;
}

export interface ImportRow {
  date: string;         // "YYYY-MM-DD"
  displayLabel: string;
  memberQuery?: string; // member name or code for server-side resolution
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getTodayChelav(): Promise<{ entry: ChelavEntry | null }> {
  const res = await apiClient.get<{ data: { entry: ChelavEntry | null } }>('/committee/chelav/today');
  return res.data.data;
}

export async function getMonthSchedule(year: number, month: number): Promise<{ entries: ChelavEntry[] }> {
  const res = await apiClient.get<{ data: { entries: ChelavEntry[] } }>(`/committee/chelav/${year}/${month}`);
  return res.data.data;
}

export async function updateChelavStatus(
  id: string,
  status: ChelavStatus,
  notes?: string,
): Promise<{ entry: ChelavEntry }> {
  const res = await apiClient.patch<{ data: { entry: ChelavEntry } }>(`/committee/chelav/${id}/status`, {
    status,
    ...(notes !== undefined && { notes }),
  });
  return res.data.data;
}

export async function swapChelavEntries(
  id1: string,
  id2: string,
): Promise<{ entries: [ChelavEntry, ChelavEntry] }> {
  const res = await apiClient.post<{ data: { entries: [ChelavEntry, ChelavEntry] } }>('/committee/chelav/swap', { id1, id2 });
  return res.data.data;
}

export async function importChelavSchedule(entries: ImportRow[]): Promise<{
  imported: number;
  errors: { row: number; date: string; message: string }[];
}> {
  const res = await apiClient.post<{ data: { imported: number; errors: { row: number; date: string; message: string }[] } }>(
    '/committee/chelav/import',
    { entries },
  );
  return res.data.data;
}
