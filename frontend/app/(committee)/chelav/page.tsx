'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, ArrowLeftRight,
  Upload, X, Loader2, UtensilsCrossed, AlertCircle,
} from 'lucide-react';
import {
  useMonthSchedule, useUpdateChelavStatus, useSwapChelav, useImportChelav,
} from '@/lib/hooks/useChelav';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import type { ChelavEntry, ChelavStatus, ImportRow } from '@/lib/api/chelav.api';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}
function apiMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong.';
}

const STATUS_COLOR: Record<ChelavStatus, string> = {
  ASSIGNED:  '#D97706',
  COMPLETED: '#0B6644',
  SKIPPED:   '#6B7280',
  SWAPPED:   '#2563EB',
};
const STATUS_BG: Record<ChelavStatus, string> = {
  ASSIGNED:  '#FFFBEB',
  COMPLETED: '#E8F5EF',
  SKIPPED:   '#F3F4F6',
  SWAPPED:   '#EFF6FF',
};
const STATUS_BORDER: Record<ChelavStatus, string> = {
  ASSIGNED:  '#FDE68A',
  COMPLETED: '#A7F3D0',
  SKIPPED:   '#E5E7EB',
  SWAPPED:   '#BFDBFE',
};

/* ── CSV parser ──────────────────────────────────────────────────────────── */
function parseCSV(text: string): { date: string; displayLabel: string }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: { date: string; displayLabel: string }[] = [];
  for (const line of lines) {
    const [rawDate, ...rest] = line.split(',');
    const label = rest.join(',').replace(/^"|"$/g, '').trim();
    const date  = (rawDate ?? '').replace(/^"|"$/g, '').trim();
    if (date && label) results.push({ date, displayLabel: label });
  }
  return results;
}

/* ════════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ChelavPage() {
  const searchParams   = useSearchParams();
  const swapTargetId   = searchParams.get('swap');   // pre-fill swap mode if coming from dashboard

  const now            = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useMonthSchedule(year, month);
  const entries = data?.entries ?? [];

  const updateStatus = useUpdateChelavStatus();
  const swapMutation = useSwapChelav();
  const importMut    = useImportChelav();

  const committeeRole = useAuthStore(s => s.user?.committeeRole);
  const isAdmin       = hasMinRole(committeeRole, 'ADMIN');
  const canOperate    = hasMinRole(committeeRole, 'PAYMENT_OPERATOR');

  // Sheet state
  const [sheet, setSheet]   = useState<ChelavEntry | null>(null);
  const [swapMode, setSwap] = useState<string | null>(swapTargetId); // id of entry to swap FROM
  const [importOpen, setImport] = useState(false);
  const [importErr, setImportErr] = useState('');
  const [importRes, setImportRes] = useState<{ imported: number; errors: { row: number; date: string; message: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // When arriving from dashboard with ?swap=id, pre-set swap mode
  useEffect(() => {
    if (swapTargetId) setSwap(swapTargetId);
  }, [swapTargetId]);

  /* month navigation */
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  /* build calendar grid — 6-row × 7-col */
  const firstDay  = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const entryByDay = new Map<number, ChelavEntry>();
  for (const e of entries) {
    const d = new Date(e.date).getUTCDate();
    entryByDay.set(d, e);
  }

  const todayDay  = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : null;

  /* status update from sheet */
  function handleStatus(id: string, status: ChelavStatus) {
    updateStatus.mutate({ id, status }, {
      onSuccess: () => setSheet(null),
    });
  }

  /* swap logic */
  function handleSwapClick(e: ChelavEntry) {
    if (swapMode === null) {
      setSwap(e.id);
      setSheet(null);
    } else if (swapMode === e.id) {
      setSwap(null); // cancel
    } else {
      // confirm swap between swapMode and e.id
      swapMutation.mutate({ id1: swapMode, id2: e.id }, {
        onSuccess: () => { setSwap(null); setSheet(null); },
      });
    }
  }

  /* CSV import */
  async function handleFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImportErr('');
    setImportRes(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { setImportErr('No valid rows found. Expected: date,name'); return; }
    const entries_import: ImportRow[] = rows.map(r => ({
      date: r.date,
      displayLabel: r.displayLabel,
      memberQuery: r.displayLabel,
    }));
    importMut.mutate(entries_import, {
      onSuccess: (res) => setImportRes(res),
      onError: (e) => setImportErr(apiMsg(e)),
    });
    ev.target.value = '';
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F1' }}>

      {/* Header */}
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
              Chelav Calendar
            </h1>
            <p style={{ fontSize: 11, color: '#7A9185', marginTop: 2 }}>Daily food duty schedule</p>
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

      {/* Swap mode banner */}
      {swapMode && (
        <div style={{
          background: '#EFF6FF', borderBottom: '1px solid #BFDBFE',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <ArrowLeftRight size={14} color="#2563EB" strokeWidth={2.2} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', flex: 1 }}>
            {swapMutation.isPending
              ? 'Swapping…'
              : `Tap another day to swap with ${entryByDay.get(entries.find(e => e.id === swapMode)?.date ? new Date(entries.find(e => e.id === swapMode)!.date).getUTCDate() : -1)?.displayLabel ?? '…'}`
            }
          </p>
          <button onClick={() => setSwap(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Month navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 8px',
      }}>
        <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E2E8E3', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={17} color="#374151" strokeWidth={2.2} />
        </button>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#0A1C12', letterSpacing: '-0.02em' }}>
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E2E8E3', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ChevronRight size={17} color="#374151" strokeWidth={2.2} />
        </button>
      </div>

      {/* Grid */}
      <div style={{ padding: '0 12px 100px' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {isLoading ? (
            Array.from({ length: 35 }).map((_, i) => (
              <div key={i} style={{ height: 68, borderRadius: 10, background: '#E5E7EB', opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))
          ) : cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const e = entryByDay.get(day);
            const isToday = day === todayDay;
            const isSwapSrc = e?.id === swapMode;

            return (
              <button
                key={i}
                onClick={() => e ? (swapMode !== null ? handleSwapClick(e) : setSheet(e)) : null}
                disabled={!e && !canOperate}
                style={{
                  height: 68, borderRadius: 10, border: `1.5px solid ${isSwapSrc ? '#2563EB' : e ? STATUS_BORDER[e.status] : isToday ? '#A7F3D0' : '#E5E7EB'}`,
                  background: isSwapSrc ? '#EFF6FF' : e ? STATUS_BG[e.status] : '#FAFAFA',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '6px 7px', cursor: e ? 'pointer' : 'default',
                  transition: 'all 0.12s', textAlign: 'left',
                  boxShadow: isToday ? '0 0 0 2px rgba(14,122,82,0.25)' : 'none',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? '#0E7A52' : '#6B7280', lineHeight: 1 }}>
                  {day}
                </span>
                {e ? (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[e.status], lineHeight: 1.25, marginTop: 4, wordBreak: 'break-word', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {e.displayLabel}
                    </span>
                  </>
                ) : isToday ? (
                  <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>Today</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, padding: '0 4px' }}>
          {(['ASSIGNED','COMPLETED','SKIPPED','SWAPPED'] as ChelavStatus[]).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_BG[s], border: `1.5px solid ${STATUS_BORDER[s]}` }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Entry sheet */}
      {sheet && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '20px 20px 36px', maxHeight: '60vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0A1C12' }}>{sheet.displayLabel}</p>
                <p style={{ fontSize: 13, color: '#7A9185', marginTop: 2 }}>{fmtDay(sheet.date)}</p>
              </div>
              <button onClick={() => setSheet(null)} style={{ width: 34, height: 34, borderRadius: 10, background: '#F4F5F1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#374151" />
              </button>
            </div>

            {/* Status pill */}
            <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 12px', background: STATUS_BG[sheet.status], color: STATUS_COLOR[sheet.status], display: 'inline-block', marginBottom: 20 }}>
              {sheet.status.charAt(0) + sheet.status.slice(1).toLowerCase()}
            </span>

            {sheet.notes && (
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>{sheet.notes}</p>
            )}

            {canOperate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sheet.status !== 'COMPLETED' && (
                  <button onClick={() => handleStatus(sheet.id, 'COMPLETED')} disabled={updateStatus.isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #A7F3D0', background: '#E8F5EF', color: '#15803D', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    <CheckCircle2 size={16} strokeWidth={2.2} />
                    Mark Completed
                  </button>
                )}
                {sheet.status !== 'SKIPPED' && (
                  <button onClick={() => handleStatus(sheet.id, 'SKIPPED')} disabled={updateStatus.isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    <XCircle size={16} strokeWidth={2.2} />
                    Mark Skipped
                  </button>
                )}
                {sheet.status !== 'ASSIGNED' && (
                  <button onClick={() => handleStatus(sheet.id, 'ASSIGNED')} disabled={updateStatus.isPending}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    Reset to Assigned
                  </button>
                )}
                <button
                  onClick={() => { setSheet(null); setSwap(sheet.id); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, border: '1.5px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  <ArrowLeftRight size={16} strokeWidth={2.2} />
                  Swap Day
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Import modal */}
      {importOpen && (
        <>
          <div onClick={() => setImport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '24px 20px 40px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: '#0A1C12' }}>Import Schedule</p>
                <p style={{ fontSize: 12, color: '#7A9185', marginTop: 3 }}>CSV format: date (YYYY-MM-DD), member name</p>
              </div>
              <button onClick={() => setImport(false)} style={{ width: 34, height: 34, borderRadius: 10, background: '#F4F5F1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#374151" />
              </button>
            </div>

            <div style={{ background: '#F4F5F1', borderRadius: 14, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>
              2026-06-01,Anas Mohamed<br />
              2026-06-02,Sinan Ibrahim<br />
              2026-06-03,Rashid Household<br />
              ...
            </div>

            {importRes ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#E8F5EF', borderRadius: 12, marginBottom: importRes.errors.length > 0 ? 10 : 0 }}>
                  <CheckCircle2 size={16} color="#0B6644" />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0B6644' }}>
                    Imported {importRes.imported} entries
                  </p>
                </div>
                {importRes.errors.length > 0 && (
                  <div style={{ padding: '12px 16px', background: '#FEF2F2', borderRadius: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>
                      {importRes.errors.length} rows failed:
                    </p>
                    {importRes.errors.slice(0, 5).map((err, i) => (
                      <p key={i} style={{ fontSize: 11.5, color: '#B91C1C' }}>
                        Row {err.row} ({err.date}): {err.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : importErr ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#FEF2F2', borderRadius: 12, marginBottom: 16 }}>
                <AlertCircle size={14} color="#DC2626" />
                <p style={{ fontSize: 13, color: '#DC2626' }}>{importErr}</p>
              </div>
            ) : null}

            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
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
                : <><Upload size={14} strokeWidth={2.2} /> Choose CSV File</>
              }
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.7} }`}</style>
    </div>
  );
}
