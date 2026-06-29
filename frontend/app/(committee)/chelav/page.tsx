'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft, CheckCircle2, XCircle, ArrowLeftRight, Upload,
  X, Loader2, AlertCircle, ChevronRight, CalendarCheck2, Clock,
  RotateCcw,
} from 'lucide-react';
import {
  useMonthSchedule, useUpdateChelavStatus, useSwapChelav, useImportChelav,
} from '@/lib/hooks/useChelav';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import type { ChelavEntry, ChelavStatus, ImportRow } from '@/lib/api/chelav.api';

/* ═══════════════════════════════════════ TOKENS */
const STATUS_LABEL: Record<ChelavStatus, string> = {
  ASSIGNED:  'Scheduled',
  COMPLETED: 'Completed',
  SKIPPED:   'Missed',
  SWAPPED:   'Changed',
};
const STATUS_STYLE: Record<ChelavStatus, { text: string; bg: string; border: string }> = {
  ASSIGNED:  { text: '#92400E', bg: '#FFFBEB', border: '#FDE68A' },
  COMPLETED: { text: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
  SKIPPED:   { text: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
  SWAPPED:   { text: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
};

/* ═══════════════════════════════════════ HELPERS */
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function entryISO(e: ChelavEntry) {
  const d = new Date(e.date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function parseDateParts(iso: string) {
  const d = new Date(iso);
  return { day: d.getUTCDate(), dow: DOW[d.getUTCDay()] ?? '', full: d.toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }) };
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0] ?? '').join('').toUpperCase();
}
function parseCSV(text: string) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [d, ...rest] = line.split(',');
    return { date: (d ?? '').replace(/^"|"$/g,'').trim(), displayLabel: rest.join(',').replace(/^"|"$/g,'').trim() };
  }).filter(r => r.date && r.displayLabel);
}
function apiMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong.';
}

/* ═══════════════════════════════════════ AVATAR */
const AV_PALETTES = [
  ['#065F46','#D1FAE5'], ['#1E3A8A','#DBEAFE'], ['#7C2D12','#FFEDD5'],
  ['#4C1D95','#EDE9FE'], ['#713F12','#FEF3C7'], ['#1F2937','#F3F4F6'],
];
function avatarPalette(name: string): [string, string] {
  return (AV_PALETTES[name.charCodeAt(0) % AV_PALETTES.length] ?? AV_PALETTES[0]) as [string, string];
}
function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const [fg, bg] = avatarPalette(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: bg, border: `1.5px solid ${fg}33`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <span style={{ fontSize: size*0.33, fontWeight: 800, color: fg, letterSpacing: '-0.02em' }}>
        {initials(name)}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════ STATUS BADGE */
function StatusBadge({ status }: { status: ChelavStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 10px', flexShrink: 0,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ═══════════════════════════════════════ MOSQUE PATTERN */
function MosquePattern() {
  return (
    <svg
      viewBox="0 0 220 130" fill="white"
      style={{ position:'absolute', right:-8, bottom:-4, width:200, height:120, opacity:0.06, pointerEvents:'none' }}
    >
      {/* Left minaret */}
      <rect x="8" y="38" width="14" height="80" rx="2"/>
      <path d="M8 38 Q15 16 22 38Z"/>
      <circle cx="15" cy="12" r="5"/>
      {/* Right minaret */}
      <rect x="198" y="38" width="14" height="80" rx="2"/>
      <path d="M198 38 Q205 16 212 38Z"/>
      <circle cx="205" cy="12" r="5"/>
      {/* Main dome body */}
      <rect x="44" y="68" width="132" height="60" rx="2"/>
      {/* Main dome arc */}
      <path d="M44 68 Q110 14 176 68Z"/>
      {/* Side wings */}
      <rect x="26" y="80" width="28" height="45" rx="2"/>
      <path d="M26 80 Q40 62 54 80Z"/>
      <rect x="166" y="80" width="28" height="45" rx="2"/>
      <path d="M166 80 Q180 62 194 80Z"/>
      {/* Crescent on top */}
      <path d="M106 8 Q116 4 118 14 Q106 10 106 8Z"/>
      <circle cx="114" cy="4" r="1.5"/>
    </svg>
  );
}

/* ═══════════════════════════════════════ HERO CARD */
function HeroCard({ entry, canOperate, isPending, onAct }: {
  entry: ChelavEntry;
  canOperate: boolean;
  isPending: boolean;
  onAct: (id: string, status: ChelavStatus) => void;
}) {
  const { full } = parseDateParts(entryISO(entry));
  const s = STATUS_STYLE[entry.status];

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0A3D26 0%, #0D6341 55%, #0E7A52 100%)',
      borderRadius: 24, padding: '22px 22px 20px', marginBottom: 12,
      boxShadow: '0 8px 32px rgba(10,61,38,0.28), 0 2px 8px rgba(10,61,38,0.16)',
    }}>
      <MosquePattern />

      {/* Label row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)',
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <span style={{ fontSize:15 }}>🍽</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.55)', letterSpacing:'0.1em', textTransform:'uppercase' }}>
          Today's Chelav
        </span>
      </div>

      {/* Main layout: info left, actions right */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:12 }}>
        {/* Left: name + date + status */}
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{
            fontSize: 26, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entry.displayLabel}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', fontWeight: 500, marginBottom: 8 }}>
            {full}
          </p>
          <span style={{
            display:'inline-flex', alignItems:'center',
            fontSize: 11.5, fontWeight: 700, borderRadius: 20, padding: '4px 12px',
            background: `${s.bg}EE`, color: s.text, border:`1px solid ${s.border}80`,
          }}>
            {STATUS_LABEL[entry.status]}
          </span>
        </div>

        {/* Right: action buttons */}
        {canOperate && entry.status === 'ASSIGNED' && (
          <div style={{ display:'flex', flexDirection:'column', gap:7, flexShrink:0 }}>
            <button
              onClick={() => onAct(entry.id, 'COMPLETED')}
              disabled={isPending}
              style={{
                display:'flex', alignItems:'center', gap:6,
                height: 38, borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.18)', color: '#fff',
                fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor:'pointer',
                backdropFilter: 'blur(8px)', whiteSpace:'nowrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
                transition: 'background 0.15s',
              }}
            >
              {isPending ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} strokeWidth={2.2}/>}
              Completed
            </button>
            <button
              onClick={() => onAct(entry.id, 'SKIPPED')}
              disabled={isPending}
              style={{
                display:'flex', alignItems:'center', gap:6,
                height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.15)', color: 'rgba(255,255,255,0.75)',
                fontSize: 12.5, fontWeight: 700, padding: '0 14px', cursor:'pointer',
                whiteSpace:'nowrap', transition: 'background 0.15s',
              }}
            >
              <XCircle size={13} strokeWidth={2.2}/>
              Missed
            </button>
          </div>
        )}
        {canOperate && entry.status !== 'ASSIGNED' && (
          <button
            onClick={() => onAct(entry.id, 'ASSIGNED')}
            disabled={isPending}
            style={{
              display:'flex', alignItems:'center', gap:6,
              height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)',
              fontSize: 12, fontWeight: 700, padding: '0 12px', cursor:'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            <RotateCcw size={12} strokeWidth={2.2}/>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════ STAT CARD */
function StatCard({ label, value, sub, icon, iconBg }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; iconBg: string;
}) {
  return (
    <div style={{
      background:'#fff', borderRadius:16, padding:'12px 14px',
      boxShadow:'0 1px 6px rgba(15,23,42,0.06)', border:'1px solid #EEF0EA',
    }}>
      <div style={{
        width:30, height:30, borderRadius:9, background:iconBg,
        display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8,
      }}>
        {icon}
      </div>
      <p style={{ fontSize:20, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em', lineHeight:1 }}>
        {value}
      </p>
      <p style={{ fontSize:10, fontWeight:600, color:'#9CA3AF', marginTop:3, lineHeight:1.2 }}>
        {label}<br/>
        <span style={{ color:'#C4C9C1' }}>{sub}</span>
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════ SCHEDULE ROW */
function ScheduleRow({ entry, day, dow, isToday, isSwapSrc, isSwapMode, onClick }: {
  entry: ChelavEntry; day: number; dow: string;
  isToday: boolean; isSwapSrc: boolean; isSwapMode: boolean;
  onClick: () => void;
}) {
  const swapTarget = isSwapMode && !isSwapSrc;

  let bg = '#fff';
  let border = '#EEF0EA';
  let shadow = '0 1px 4px rgba(15,23,42,0.05)';
  if (isSwapSrc) { bg = '#EFF6FF'; border = '#93C5FD'; }
  else if (isToday) { bg = '#F0FDF4'; border = '#6EE7B7'; shadow = '0 2px 12px rgba(14,122,82,0.10)'; }
  else if (swapTarget) { bg = '#F8FFFE'; border = '#A5F3FC'; }

  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:12,
        background: bg, borderRadius:16, padding:'12px 14px',
        border: `1.5px solid ${border}`,
        cursor:'pointer', textAlign:'left', width:'100%',
        boxShadow: shadow, transition:'all 0.12s',
        position:'relative', overflow:'hidden',
      }}
    >
      {/* Today accent stripe */}
      {isToday && (
        <div style={{ position:'absolute', left:0, top:10, bottom:10, width:3, borderRadius:2, background:'#0E7A52' }} />
      )}

      {/* Date block */}
      <div style={{ width:38, flexShrink:0, textAlign:'center', paddingLeft: isToday ? 4 : 0 }}>
        <p style={{
          fontSize:20, fontWeight:800, lineHeight:1,
          color: isSwapSrc ? '#2563EB' : isToday ? '#0A5C3C' : '#111827',
        }}>
          {day}
        </p>
        <p style={{
          fontSize:10, fontWeight:700, letterSpacing:'0.05em', marginTop:2,
          color: isSwapSrc ? '#93C5FD' : isToday ? '#0E7A52' : '#C4C9C1',
        }}>
          {dow}
        </p>
      </div>

      {/* Divider */}
      <div style={{ width:1, height:38, background:'#EEF0EA', flexShrink:0 }} />

      {/* Avatar + name */}
      <Avatar name={entry.displayLabel} size={38} />

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <p style={{ fontSize:14, fontWeight:700, color:'#111827', lineHeight:1.2, truncate: true } as React.CSSProperties}>
            {entry.displayLabel}
          </p>
          {isToday && (
            <span style={{
              fontSize:9.5, fontWeight:800, borderRadius:6, padding:'1px 6px',
              background:'#0E7A52', color:'#fff', letterSpacing:'0.04em', flexShrink:0,
            }}>
              TODAY
            </span>
          )}
          {isSwapSrc && (
            <span style={{
              fontSize:9.5, fontWeight:800, borderRadius:6, padding:'1px 6px',
              background:'#2563EB', color:'#fff', flexShrink:0,
            }}>
              SWAP
            </span>
          )}
        </div>
        {entry.notes && (
          <p style={{ fontSize:11, color:'#9CA3AF', marginTop:2, lineHeight:1.3 }}>
            {entry.notes}
          </p>
        )}
      </div>

      <StatusBadge status={entry.status} />
      <ChevronRight size={14} color="#D1D5DB" strokeWidth={2} style={{ flexShrink:0 }} />
    </button>
  );
}

/* ═══════════════════════════════════════ EMPTY LIST */
function EmptyList({ filter, isAdmin, onImport }: { filter: string; isAdmin: boolean; onImport: () => void }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 20px' }}>
      <div style={{
        width:56, height:56, borderRadius:'50%', background:'#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        margin:'0 auto 16px', boxShadow:'0 4px 16px rgba(15,23,42,0.07)',
      }}>
        <CalendarCheck2 size={22} color="#C4C9C1" strokeWidth={1.5} />
      </div>
      <p style={{ fontSize:15, fontWeight:700, color:'#374151' }}>
        {filter === 'ALL' ? 'No schedule yet' : `No ${filter === 'SKIPPED' ? 'missed' : filter.toLowerCase()} entries`}
      </p>
      <p style={{ fontSize:13, color:'#9CA3AF', marginTop:6, lineHeight:1.5 }}>
        {filter === 'ALL' ? 'Upload a schedule to get started.' : 'Change the filter to see other entries.'}
      </p>
      {filter === 'ALL' && isAdmin && (
        <button onClick={onImport} style={{
          marginTop:16, fontSize:13, fontWeight:700, color:'#0E7A52',
          background:'none', border:'none', cursor:'pointer', padding:0,
        }}>
          Upload Schedule →
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════ ACTION SHEET */
function ActionSheet({ entry, canOperate, noteText, onNoteChange, isPending, onAct, onSwap, onClose }: {
  entry: ChelavEntry; canOperate: boolean;
  noteText: string; onNoteChange: (v: string) => void;
  isPending: boolean;
  onAct: (id: string, status: ChelavStatus, notes?: string) => void;
  onSwap: () => void; onClose: () => void;
}) {
  const { full } = parseDateParts(entryISO(entry));
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.40)', zIndex:50, animation:'fadeIn 0.15s ease' }} />
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:51,
        background:'#fff', borderRadius:'24px 24px 0 0',
        padding:'0 0 40px', animation:'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
        boxShadow:'0 -4px 40px rgba(15,23,42,0.18)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', paddingTop:12, paddingBottom:4 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#D1D5DB' }} />
        </div>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 20px 16px' }}>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start', flex:1, minWidth:0 }}>
            <Avatar name={entry.displayLabel} size={46} />
            <div>
              <p style={{ fontSize:18, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em' }}>
                {entry.displayLabel}
              </p>
              <p style={{ fontSize:12, color:'#7A9185', marginTop:3 }}>{full}</p>
              <div style={{ marginTop:6 }}>
                <StatusBadge status={entry.status} />
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width:34, height:34, borderRadius:10, background:'#F4F5F1',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <X size={16} color="#374151" />
          </button>
        </div>

        {canOperate && (
          <div style={{ padding:'0 20px', display:'flex', flexDirection:'column', gap:8 }}>
            {/* Note input */}
            <input
              value={noteText}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Add a note (optional)"
              style={{
                height:42, borderRadius:12, border:'1.5px solid #E2E8E0',
                background:'#F9FAF8', padding:'0 14px', fontSize:13,
                color:'#374151', outline:'none', fontFamily:'inherit', width:'100%',
                boxSizing:'border-box',
              }}
            />

            {/* Actions */}
            {entry.status !== 'COMPLETED' && (
              <button
                onClick={() => onAct(entry.id, 'COMPLETED', noteText || undefined)}
                disabled={isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  height:48, borderRadius:14, border:'1.5px solid #6EE7B7',
                  background:'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                  color:'#065F46', fontSize:14, fontWeight:700, cursor:'pointer',
                  boxShadow:'0 2px 8px rgba(6,95,70,0.10)',
                }}
              >
                {isPending ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <CheckCircle2 size={16} strokeWidth={2.2}/>}
                Mark Completed
              </button>
            )}
            {entry.status !== 'SKIPPED' && (
              <button
                onClick={() => onAct(entry.id, 'SKIPPED', noteText || undefined)}
                disabled={isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  height:48, borderRadius:14, border:'1.5px solid #FECACA',
                  background:'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
                  color:'#991B1B', fontSize:14, fontWeight:700, cursor:'pointer',
                }}
              >
                <XCircle size={16} strokeWidth={2.2}/>
                Mark Missed
              </button>
            )}
            <button
              onClick={onSwap}
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                height:48, borderRadius:14, border:'1.5px solid #BFDBFE',
                background:'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                color:'#1E40AF', fontSize:14, fontWeight:700, cursor:'pointer',
              }}
            >
              <ArrowLeftRight size={16} strokeWidth={2.2}/>
              Swap with Another Day
            </button>
            {entry.status !== 'ASSIGNED' && (
              <button
                onClick={() => onAct(entry.id, 'ASSIGNED')}
                disabled={isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  height:44, borderRadius:14, border:'1.5px solid #E2E8E0',
                  background:'#F9FAF8', color:'#6B7280', fontSize:13, fontWeight:700, cursor:'pointer',
                }}
              >
                <RotateCcw size={14} strokeWidth={2.2}/>
                Reset to Scheduled
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════ IMPORT MODAL */
function ImportModal({ importMut, importErr, importRes, onChooseFile, onClose }: {
  importMut: { isPending: boolean };
  importErr: string;
  importRes: { imported: number; errors: { row: number; date: string; message: string }[] } | null;
  onChooseFile: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.40)', zIndex:50, animation:'fadeIn 0.15s ease' }} />
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:51,
        background:'#fff', borderRadius:'24px 24px 0 0',
        padding:'0 20px 48px', animation:'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
        boxShadow:'0 -4px 40px rgba(15,23,42,0.18)',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', paddingTop:12, paddingBottom:4 }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'#D1D5DB' }} />
        </div>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 0 18px' }}>
          <div>
            <p style={{ fontSize:19, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em' }}>
              Upload Schedule
            </p>
            <p style={{ fontSize:12, color:'#7A9185', marginTop:3 }}>
              One row per day — date, household name
            </p>
          </div>
          <button onClick={onClose} style={{
            width:34, height:34, borderRadius:10, background:'#F4F5F1',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <X size={16} color="#374151"/>
          </button>
        </div>

        {/* Format example */}
        <div style={{
          background:'#F5F4F0', borderRadius:12, padding:'12px 16px', marginBottom:14,
          fontSize:12, color:'#6B7280', fontFamily:'monospace', lineHeight:1.8,
        }}>
          2026-07-01,Anas Mohammed<br/>
          2026-07-02,Sinan Ali<br/>
          2026-07-03,Rashid Koya
        </div>

        <p style={{ fontSize:11.5, color:'#9CA3AF', marginBottom:14, lineHeight:1.6 }}>
          Names are matched against active members. Chelav-exempt members are excluded.
          Non-member household names are accepted as-is.
        </p>

        {/* Result */}
        {importRes && (
          <div style={{ marginBottom:12 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'10px 14px', background:'#ECFDF5', borderRadius:12,
              border:'1px solid #A7F3D0', marginBottom: importRes.errors.length > 0 ? 8 : 0,
            }}>
              <CheckCircle2 size={14} color="#065F46"/>
              <p style={{ fontSize:13, fontWeight:700, color:'#065F46' }}>
                {importRes.imported} entries imported
              </p>
            </div>
            {importRes.errors.length > 0 && (
              <div style={{ padding:'10px 14px', background:'#FEF2F2', borderRadius:12, border:'1px solid #FECACA' }}>
                <p style={{ fontSize:12, fontWeight:700, color:'#991B1B', marginBottom:4 }}>
                  {importRes.errors.length} rows failed
                </p>
                {importRes.errors.slice(0,4).map((err,i) => (
                  <p key={i} style={{ fontSize:11.5, color:'#B91C1C' }}>
                    Row {err.row} ({err.date}): {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {importErr && (
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 14px', background:'#FEF2F2', borderRadius:12,
            border:'1px solid #FECACA', marginBottom:12,
          }}>
            <AlertCircle size={14} color="#DC2626"/>
            <p style={{ fontSize:13, color:'#991B1B' }}>{importErr}</p>
          </div>
        )}

        <button
          onClick={onChooseFile}
          disabled={importMut.isPending}
          style={{
            width:'100%', height:50, borderRadius:14, border:'none',
            background: importMut.isPending
              ? 'linear-gradient(135deg, #7FBFA0, #6BAE8C)'
              : 'linear-gradient(135deg, #0D6341, #0E7A52)',
            color:'#fff', fontSize:14, fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            cursor: importMut.isPending ? 'default' : 'pointer', fontFamily:'inherit',
            boxShadow: importMut.isPending ? 'none' : '0 4px 16px rgba(13,99,65,0.30)',
            letterSpacing:'0.01em',
          }}
        >
          {importMut.isPending
            ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> Processing…</>
            : <><Upload size={15} strokeWidth={2.2}/> Choose File</>}
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════ PAGE */
type Filter = 'ALL' | ChelavStatus;

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
  const isAdmin   = hasMinRole(committeeRole, 'ADMIN');
  const canOperate = hasMinRole(committeeRole, 'PAYMENT_OPERATOR');

  const today      = todayISO();
  const todayEntry = entries.find(e => entryISO(e) === today) ?? null;

  const [filter, setFilter]         = useState<Filter>('ALL');
  const [sheet, setSheet]           = useState<ChelavEntry | null>(null);
  const [noteText, setNoteText]     = useState('');
  const [swapMode, setSwapMode]     = useState<string | null>(swapTargetId);
  const [importOpen, setImportOpen] = useState(false);
  const [importErr, setImportErr]   = useState('');
  const [importRes, setImportRes]   = useState<{ imported: number; errors: { row: number; date: string; message: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MONTH_NAME = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const completed = entries.filter(e => e.status === 'COMPLETED').length;
  const remaining = entries.filter(e => e.status === 'ASSIGNED' && entryISO(e) >= today).length;
  const changed   = entries.filter(e => e.status === 'SWAPPED').length;
  const missed    = entries.filter(e => e.status === 'SKIPPED').length;

  const filtered = filter === 'ALL' ? entries : entries.filter(e => e.status === filter);

  function act(id: string, status: ChelavStatus, notes?: string) {
    if (updateStatus.isPending) return;
    updateStatus.mutate({ id, status, notes }, { onSuccess: () => setSheet(null) });
  }

  function handleSwapRow(e: ChelavEntry) {
    if (swapMode === null) { setSwapMode(e.id); setSheet(null); }
    else if (swapMode === e.id) { setSwapMode(null); }
    else {
      swapMutation.mutate({ id1: swapMode, id2: e.id }, {
        onSuccess: () => { setSwapMode(null); setSheet(null); },
      });
    }
  }

  async function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setImportErr(''); setImportRes(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) { setImportErr('No valid rows. Format: YYYY-MM-DD,Name'); return; }
    const payload: ImportRow[] = rows.map(r => ({ date: r.date, displayLabel: r.displayLabel, memberQuery: r.displayLabel }));
    importMut.mutate(payload, {
      onSuccess: r => setImportRes(r),
      onError:   e => setImportErr(apiMsg(e)),
    });
    ev.target.value = '';
  }

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'ALL',       label: 'All',       count: entries.length },
    { key: 'ASSIGNED',  label: 'Scheduled', count: entries.filter(e => e.status === 'ASSIGNED').length },
    { key: 'COMPLETED', label: 'Completed', count: completed },
    { key: 'SKIPPED',   label: 'Missed',    count: missed },
    { key: 'SWAPPED',   label: 'Changed',   count: changed },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0', paddingBottom:100 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        position:'sticky', top:0, zIndex:40,
        background:'rgba(255,255,255,0.94)', backdropFilter:'blur(14px)',
        borderBottom:'1px solid #E8EAE4',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:60,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/dashboard" style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:36, height:36, borderRadius:10,
            background:'#F0F2EC', color:'#374151', flexShrink:0,
          }}>
            <ChevronLeft size={18} strokeWidth={2.2}/>
          </Link>
          <div>
            <h1 style={{ fontSize:16, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em', lineHeight:1 }}>
              Chelav
            </h1>
            <p style={{ fontSize:11, color:'#7A9185', marginTop:2, fontWeight:500 }}>
              {MONTH_NAME} · Daily Food Duty
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setImportOpen(true); setImportRes(null); setImportErr(''); }}
            style={{
              display:'flex', alignItems:'center', gap:6, flexShrink:0,
              fontSize:12, fontWeight:700, color:'#0A5C3C',
              background:'linear-gradient(135deg, #E8F5EF, #D4EDE2)',
              border:'1px solid #B7DDC9', borderRadius:10,
              padding:'8px 14px', cursor:'pointer',
              boxShadow:'0 1px 4px rgba(14,122,82,0.12)',
            }}
          >
            <Upload size={13} strokeWidth={2.2}/>
            Upload Schedule
          </button>
        )}
      </div>

      {/* ── Swap banner ───────────────────────────────────────────────────── */}
      {swapMode && (
        <div style={{
          background:'linear-gradient(90deg, #EFF6FF, #F0F8FF)',
          borderBottom:'1px solid #BFDBFE',
          padding:'11px 20px', display:'flex', alignItems:'center', gap:10,
        }}>
          <div style={{
            width:30, height:30, borderRadius:9, background:'#DBEAFE',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <ArrowLeftRight size={14} color="#2563EB" strokeWidth={2.2}/>
          </div>
          <p style={{ fontSize:13, fontWeight:600, color:'#1D4ED8', flex:1 }}>
            {swapMutation.isPending ? 'Swapping…' : 'Tap a row below to swap with the selected day'}
          </p>
          <button onClick={() => setSwapMode(null)} style={{
            width:28, height:28, borderRadius:8, background:'#DBEAFE',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <X size={13} color="#2563EB"/>
          </button>
        </div>
      )}

      <div style={{ padding:'16px 16px 0' }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ height:160, borderRadius:24, background:'#0E7A5230', animation:'pulse 1.5s ease-in-out infinite', marginBottom:12 }}/>
        ) : todayEntry ? (
          <HeroCard
            entry={todayEntry}
            canOperate={canOperate}
            isPending={updateStatus.isPending}
            onAct={act}
          />
        ) : !isLoading && (
          <div style={{
            background:'linear-gradient(135deg, #1B4332 0%, #0E7A52 100%)',
            borderRadius:24, padding:'22px 22px', marginBottom:12, position:'relative', overflow:'hidden',
          }}>
            <MosquePattern/>
            <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6 }}>
              Today's Chelav
            </p>
            <p style={{ fontSize:17, fontWeight:600, color:'rgba(255,255,255,0.65)' }}>
              No duty scheduled for today
            </p>
          </div>
        )}

        {/* ── Stats strip ───────────────────────────────────────────────── */}
        {!isLoading && entries.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
            <StatCard
              icon={<CalendarCheck2 size={14} color="#065F46"/>}
              iconBg="#D1FAE5" label="Completed" value={String(completed)} sub={`of ${entries.length} days`}
            />
            <StatCard
              icon={<Clock size={14} color="#92400E"/>}
              iconBg="#FEF3C7" label="Remaining" value={String(remaining)} sub="from today"
            />
            <StatCard
              icon={<XCircle size={14} color="#991B1B"/>}
              iconBg="#FEE2E2" label="Missed" value={String(missed)} sub={`${changed} changed`}
            />
          </div>
        )}

        {/* ── Filter chips ──────────────────────────────────────────────── */}
        <div style={{
          display:'flex', gap:6, overflowX:'auto', paddingBottom:2, marginBottom:12,
        }}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  flexShrink:0, height:34, borderRadius:20,
                  border: active ? 'none' : '1px solid #E0E4DC',
                  padding:'0 13px', fontSize:12.5, fontWeight:700, cursor:'pointer',
                  background: active ? '#0E7A52' : '#fff',
                  color: active ? '#fff' : '#6B7280',
                  boxShadow: active ? '0 2px 10px rgba(14,122,82,0.22)' : '0 1px 3px rgba(0,0,0,0.04)',
                  display:'flex', alignItems:'center', gap:5, transition:'all 0.14s',
                }}
              >
                {f.label}
                {f.count > 0 && (
                  <span style={{
                    fontSize:10, fontWeight:800, borderRadius:10, padding:'1px 6px',
                    background: active ? 'rgba(255,255,255,0.24)' : '#F0F2EC',
                    color: active ? '#fff' : '#9CA3AF',
                  }}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── List ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Array.from({length:7}).map((_,i) => (
              <div key={i} style={{
                height:68, borderRadius:16, background:'#E5E7EB',
                opacity: 1 - i*0.1, animation:'pulse 1.5s ease-in-out infinite',
              }}/>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyList
            filter={filter}
            isAdmin={isAdmin}
            onImport={() => { setImportOpen(true); setImportRes(null); setImportErr(''); }}
          />
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {filtered.map(e => {
              const iso = entryISO(e);
              const { day, dow } = parseDateParts(iso);
              return (
                <ScheduleRow
                  key={e.id}
                  entry={e} day={day} dow={dow}
                  isToday={iso === today}
                  isSwapSrc={e.id === swapMode}
                  isSwapMode={swapMode !== null}
                  onClick={() => swapMode ? handleSwapRow(e) : (setSheet(e), setNoteText(e.notes ?? ''))}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sheets & Modals ─────────────────────────────────────────────── */}
      {sheet && (
        <ActionSheet
          entry={sheet}
          canOperate={canOperate}
          noteText={noteText}
          onNoteChange={setNoteText}
          isPending={updateStatus.isPending}
          onAct={act}
          onSwap={() => { setSwapMode(sheet.id); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}

      {importOpen && (
        <ImportModal
          importMut={importMut}
          importErr={importErr}
          importRes={importRes}
          onChooseFile={() => fileRef.current?.click()}
          onClose={() => setImportOpen(false)}
        />
      )}

      <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleFile}/>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100% { opacity:.5 } 50% { opacity:.8 } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
