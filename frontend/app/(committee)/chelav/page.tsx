'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft, CheckCircle2, XCircle, ArrowLeftRight,
  Upload, X, Loader2, AlertCircle, FileText,
} from 'lucide-react';
import {
  useMonthSchedule, useUpdateChelavStatus, useSwapChelav, useImportChelav,
} from '@/lib/hooks/useChelav';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import type { ChelavEntry, ChelavStatus, ImportRow } from '@/lib/api/chelav.api';

/* ── Display labels — keep DB enum values unchanged ─────────────────────── */
const STATUS_LABEL: Record<ChelavStatus, string> = {
  ASSIGNED:  'Scheduled',
  COMPLETED: 'Completed',
  SKIPPED:   'Missed',
  SWAPPED:   'Changed',
};
const STATUS_COLOR: Record<ChelavStatus, string> = {
  ASSIGNED:  '#D97706',
  COMPLETED: '#0B6644',
  SKIPPED:   '#DC2626',
  SWAPPED:   '#2563EB',
};
const STATUS_BG: Record<ChelavStatus, string> = {
  ASSIGNED:  '#FFFBEB',
  COMPLETED: '#E8F5EF',
  SKIPPED:   '#FEF2F2',
  SWAPPED:   '#EFF6FF',
};

type Filter = 'ALL' | ChelavStatus;

function apiMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong.';
}

/* ── CSV parser ──────────────────────────────────────────────────────────── */
function parseCSV(text: string): { date: string; displayLabel: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [rawDate, ...rest] = line.split(',');
      return {
        date:         (rawDate ?? '').replace(/^"|"$/g, '').trim(),
        displayLabel: rest.join(',').replace(/^"|"$/g, '').trim(),
      };
    })
    .filter(r => r.date && r.displayLabel);
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function entryDateISO(e: ChelavEntry) {
  const d = new Date(e.date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function fmtEntryDate(iso: string) {
  const d = new Date(iso);
  const day  = d.getUTCDate();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dow  = days[d.getUTCDay()] ?? '';
  return { day, dow };
}
function fmtLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* ════════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ChelavPage() {
  const searchParams = useSearchParams();
  const swapTargetId = searchParams.get('swap');

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, isLoading } = useMonthSchedule(year, month);
  const entries = data?.entries ?? [];

  const updateStatus = useUpdateChelavStatus();
  const swapMutation = useSwapChelav();
  const importMut    = useImportChelav();

  const committeeRole = useAuthStore(s => s.user?.committeeRole);
  const isAdmin       = hasMinRole(committeeRole, 'ADMIN');
  const canOperate    = hasMinRole(committeeRole, 'PAYMENT_OPERATOR');

  const today = todayISO();

  // Derive today's entry from month data (avoids a second API call)
  const todayEntry = entries.find(e => entryDateISO(e) === today) ?? null;

  const [filter, setFilter]       = useState<Filter>('ALL');
  const [sheet, setSheet]         = useState<ChelavEntry | null>(null);
  const [noteText, setNoteText]   = useState('');
  const [swapMode, setSwapMode]   = useState<string | null>(swapTargetId);
  const [importOpen, setImport]   = useState(false);
  const [importErr, setImportErr] = useState('');
  const [importRes, setImportRes] = useState<{ imported: number; errors: { row: number; date: string; message: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MONTH_NAME = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const filtered = filter === 'ALL' ? entries : entries.filter(e => e.status === filter);

  /* quick status action */
  function act(id: string, status: ChelavStatus, notes?: string) {
    if (updateStatus.isPending) return;
    updateStatus.mutate({ id, status, notes }, { onSuccess: () => setSheet(null) });
  }

  /* swap */
  function handleSwapRow(e: ChelavEntry) {
    if (swapMode === null) {
      setSwapMode(e.id); setSheet(null);
    } else if (swapMode === e.id) {
      setSwapMode(null);
    } else {
      swapMutation.mutate({ id1: swapMode, id2: e.id }, {
        onSuccess: () => { setSwapMode(null); setSheet(null); },
      });
    }
  }

  function openSheet(e: ChelavEntry) {
    setSheet(e);
    setNoteText(e.notes ?? '');
  }

  /* CSV import */
  async function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImportErr(''); setImportRes(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { setImportErr('No valid rows found. Format: YYYY-MM-DD,Member Name'); return; }
    const payload: ImportRow[] = rows.map(r => ({ date: r.date, displayLabel: r.displayLabel, memberQuery: r.displayLabel }));
    importMut.mutate(payload, {
      onSuccess: r => setImportRes(r),
      onError: e => setImportErr(apiMsg(e)),
    });
    ev.target.value = '';
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL',       label: 'All' },
    { key: 'ASSIGNED',  label: 'Scheduled' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'SKIPPED',   label: 'Missed' },
    { key: 'SWAPPED',   label: 'Changed' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F1', paddingBottom: 100 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40, background: '#fff',
        borderBottom: '1px solid #E2E8E3',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, background: '#F4F5F1', color: '#374151',
          }}>
            <ChevronLeft size={18} strokeWidth={2.2} />
          </Link>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: '#0A1C12', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Chelav Schedule
            </h1>
            <p style={{ fontSize: 11, color: '#7A9185', marginTop: 2 }}>Daily food duty rotation</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setImport(true); setImportRes(null); setImportErr(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, color: '#0C6640',
              background: '#E8F5EF', border: 'none', borderRadius: 10,
              padding: '7px 14px', cursor: 'pointer',
            }}
          >
            <Upload size={13} strokeWidth={2.2} />
            Import CSV
          </button>
        )}
      </div>

      {/* ── Swap mode banner ────────────────────────────────────────────── */}
      {swapMode && (
        <div style={{
          background: '#EFF6FF', borderBottom: '1px solid #BFDBFE',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <ArrowLeftRight size={14} color="#2563EB" strokeWidth={2.2} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', flex: 1 }}>
            {swapMutation.isPending
              ? 'Swapping…'
              : 'Tap another row to swap with this day'}
          </p>
          <button onClick={() => setSwapMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD' }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ padding: '16px 16px 0' }}>

        {/* ── Today's hero card ────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ height: 120, borderRadius: 20, background: '#E5E7EB', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 12 }} />
        ) : todayEntry ? (
          <div style={{
            background: '#fff', borderRadius: 20, padding: '18px 20px 16px',
            boxShadow: '0 4px 20px rgba(14,122,82,0.10)', border: '1.5px solid #A7F3D0',
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7A9185', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Today's Chelav
            </p>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#0A1C12', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {todayEntry.displayLabel}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <p style={{ fontSize: 12, color: '#7A9185' }}>{fmtLong(todayEntry.date)}</p>
              <span style={{
                fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 10px',
                background: STATUS_BG[todayEntry.status],
                color: STATUS_COLOR[todayEntry.status],
              }}>
                {STATUS_LABEL[todayEntry.status]}
              </span>
            </div>
            {canOperate && todayEntry.status === 'ASSIGNED' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => act(todayEntry.id, 'COMPLETED')} disabled={updateStatus.isPending}
                  style={{ flex: 1, height: 40, borderRadius: 12, border: '1.5px solid #A7F3D0', background: '#E8F5EF', color: '#15803D', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {updateStatus.isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} strokeWidth={2.2} />}
                  Mark Completed
                </button>
                <button onClick={() => act(todayEntry.id, 'SKIPPED')} disabled={updateStatus.isPending}
                  style={{ flex: 1, height: 40, borderRadius: 12, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <XCircle size={14} strokeWidth={2.2} />
                  Mark Missed
                </button>
              </div>
            )}
          </div>
        ) : !isLoading && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', marginBottom: 12, border: '1.5px solid #E2E8E3' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#7A9185' }}>No chelav assigned for today</p>
          </div>
        )}

        {/* ── Month heading ────────────────────────────────────────────── */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{MONTH_NAME}</p>

        {/* ── Filter pills ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 10 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                flexShrink: 0, height: 32, borderRadius: 20, border: 'none',
                padding: '0 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                background: filter === f.key ? '#0E7A52' : '#E8EDE9',
                color: filter === f.key ? '#fff' : '#374151',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Duty list ────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 58, borderRadius: 14, background: '#E5E7EB', opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <FileText size={28} color="#D1D5DB" strokeWidth={1.5} />
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 10 }}>
              {filter === 'ALL' ? 'No chelav entries this month. Import a schedule to get started.' : `No ${STATUS_LABEL[filter as ChelavStatus] ?? filter.toLowerCase()} entries this month.`}
            </p>
            {filter === 'ALL' && isAdmin && (
              <button onClick={() => { setImport(true); setImportRes(null); setImportErr(''); }}
                style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: '#0E7A52', background: 'none', border: 'none', cursor: 'pointer' }}>
                Import CSV →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(e => {
              const iso     = entryDateISO(e);
              const isToday = iso === today;
              const { day, dow } = fmtEntryDate(iso);
              const isSwapSrc = e.id === swapMode;

              return (
                <button
                  key={e.id}
                  onClick={() => swapMode ? handleSwapRow(e) : openSheet(e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isSwapSrc ? '#EFF6FF' : isToday ? '#F0FDF4' : '#fff',
                    borderRadius: 14, padding: '12px 16px',
                    border: `1.5px solid ${isSwapSrc ? '#93C5FD' : isToday ? '#A7F3D0' : '#EEF0EE'}`,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    boxShadow: isToday ? '0 2px 10px rgba(14,122,82,0.08)' : 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  {/* Date column */}
                  <div style={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: isToday ? '#0E7A52' : '#111827', lineHeight: 1 }}>{day}</p>
                    <p style={{ fontSize: 10.5, fontWeight: 600, color: isToday ? '#0E7A52' : '#9CA3AF', letterSpacing: '0.04em', marginTop: 1 }}>{dow}</p>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 36, background: '#E5E7EB', flexShrink: 0 }} />

                  {/* Name */}
                  <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#111827', textAlign: 'left' }}>
                    {e.displayLabel}
                    {isToday && <span style={{ fontSize: 10, fontWeight: 700, color: '#0E7A52', marginLeft: 6, background: '#E8F5EF', padding: '1px 6px', borderRadius: 6 }}>Today</span>}
                  </p>

                  {/* Status pill */}
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px',
                    background: STATUS_BG[e.status], color: STATUS_COLOR[e.status],
                  }}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Action sheet ────────────────────────────────────────────────── */}
      {sheet && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '20px 20px 40px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 19, fontWeight: 800, color: '#0A1C12', letterSpacing: '-0.02em' }}>{sheet.displayLabel}</p>
                <p style={{ fontSize: 13, color: '#7A9185', marginTop: 3 }}>{fmtLong(sheet.date)}</p>
                <span style={{
                  display: 'inline-block', marginTop: 6,
                  fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 12px',
                  background: STATUS_BG[sheet.status], color: STATUS_COLOR[sheet.status],
                }}>
                  {STATUS_LABEL[sheet.status]}
                </span>
              </div>
              <button onClick={() => setSheet(null)} style={{ width: 34, height: 34, borderRadius: 10, background: '#F4F5F1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={16} color="#374151" />
              </button>
            </div>

            {canOperate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sheet.status !== 'COMPLETED' && (
                  <button onClick={() => act(sheet.id, 'COMPLETED', noteText || undefined)} disabled={updateStatus.isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #A7F3D0', background: '#E8F5EF', color: '#15803D', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    <CheckCircle2 size={16} strokeWidth={2.2} />
                    Mark Completed
                  </button>
                )}
                {sheet.status !== 'SKIPPED' && (
                  <button onClick={() => act(sheet.id, 'SKIPPED', noteText || undefined)} disabled={updateStatus.isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    <XCircle size={16} strokeWidth={2.2} />
                    Mark Missed
                  </button>
                )}
                {sheet.status !== 'ASSIGNED' && (
                  <button onClick={() => act(sheet.id, 'ASSIGNED')} disabled={updateStatus.isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    Reset to Scheduled
                  </button>
                )}
                <button
                  onClick={() => { setSwapMode(sheet.id); setSheet(null); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  <ArrowLeftRight size={16} strokeWidth={2.2} />
                  Swap with Another Day
                </button>

                {/* Note input */}
                <input
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note (optional)"
                  style={{
                    height: 42, borderRadius: 12, border: '1.5px solid #E2E8E3',
                    background: '#F9FAFB', padding: '0 14px', fontSize: 13,
                    color: '#374151', outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Import modal ─────────────────────────────────────────────────── */}
      {importOpen && (
        <>
          <div onClick={() => setImport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '24px 20px 44px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#0A1C12' }}>Import Schedule</p>
                <p style={{ fontSize: 12, color: '#7A9185', marginTop: 3 }}>
                  CSV format — one row per day: date, member name
                </p>
              </div>
              <button onClick={() => setImport(false)} style={{ width: 34, height: 34, borderRadius: 10, background: '#F4F5F1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#374151" />
              </button>
            </div>

            <div style={{ background: '#F4F5F1', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6B7280', fontFamily: 'monospace', lineHeight: 1.7 }}>
              2026-06-01,Anas Mohammed<br />
              2026-06-02,Sinan Ali<br />
              2026-06-03,Rashid Koya
            </div>

            <p style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 14, lineHeight: 1.5 }}>
              Member names are matched against active members in your masjid.
              Chelav-exempt members are excluded from matching.
              Non-member household names are accepted as-is.
            </p>

            {importRes && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#E8F5EF', borderRadius: 12, marginBottom: importRes.errors.length > 0 ? 8 : 0 }}>
                  <CheckCircle2 size={15} color="#0B6644" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0B6644' }}>
                    {importRes.imported} entries imported
                  </p>
                </div>
                {importRes.errors.length > 0 && (
                  <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>
                      {importRes.errors.length} rows failed
                    </p>
                    {importRes.errors.slice(0, 4).map((err, i) => (
                      <p key={i} style={{ fontSize: 11.5, color: '#B91C1C' }}>
                        Row {err.row} ({err.date}): {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {importErr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 12, marginBottom: 12 }}>
                <AlertCircle size={14} color="#DC2626" />
                <p style={{ fontSize: 13, color: '#DC2626' }}>{importErr}</p>
              </div>
            )}

            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importMut.isPending}
              style={{
                width: '100%', height: 48, borderRadius: 14, border: 'none',
                background: importMut.isPending ? '#7fbfa0' : '#0C6640',
                color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: importMut.isPending ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {importMut.isPending
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
                : <><Upload size={14} strokeWidth={2.2} /> Choose CSV File</>}
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:0.8}}`}</style>
    </div>
  );
}
