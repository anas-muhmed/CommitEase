'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft, CheckCircle2, XCircle, ArrowLeftRight,
  Upload, X, Loader2, AlertCircle, RotateCcw, ChevronRight,
} from 'lucide-react';
import {
  useMonthSchedule, useUpdateChelavStatus, useSwapChelav, useImportChelav,
} from '@/lib/hooks/useChelav';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import type { ChelavEntry, ChelavStatus, ImportRow } from '@/lib/api/chelav.api';

/* ─── tokens ──────────────────────────────────────────────────────────────── */
const LABEL: Record<ChelavStatus, string> = {
  ASSIGNED: 'Scheduled', COMPLETED: 'Completed', SKIPPED: 'Missed', SWAPPED: 'Changed',
};
// dot colors — saturated, reads at 8px
const DOT: Record<ChelavStatus, string> = {
  ASSIGNED: '#F59E0B', COMPLETED: '#10B981', SKIPPED: '#EF4444', SWAPPED: '#818CF8',
};
// badge: pill text + bg
const BADGE: Record<ChelavStatus, { text: string; bg: string }> = {
  ASSIGNED:  { text: '#92400E', bg: '#FFFBEB' },
  COMPLETED: { text: '#065F46', bg: '#D1FAE5' },
  SKIPPED:   { text: '#991B1B', bg: '#FEE2E2' },
  SWAPPED:   { text: '#1E40AF', bg: '#DBEAFE' },
};

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}
function eISO(e: ChelavEntry) {
  const d = new Date(e.date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dp(iso: string) {
  const d = new Date(iso);
  return {
    num:  d.getUTCDate(),
    dow:  DAYS[d.getUTCDay()] ?? '',
    mon:  MONTHS[d.getUTCMonth()] ?? '',
    long: d.toLocaleDateString('en-IN',{ weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }),
  };
}
function inits(name: string) {
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0] ?? '').join('').toUpperCase();
}
function first(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
function parseCSV(text: string) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [d, ...r] = line.split(',');
    return { date: (d ?? '').replace(/^"|"$/g,'').trim(), displayLabel: r.join(',').replace(/^"|"$/g,'').trim() };
  }).filter(r => r.date && r.displayLabel);
}
function apiMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong.';
}

/* ─── avatar palette ──────────────────────────────────────────────────────── */
const PALETTES: [string, string][] = [
  ['#065F46','#D1FAE5'], ['#1E3A8A','#DBEAFE'], ['#7C2D12','#FFEDD5'],
  ['#4C1D95','#EDE9FE'], ['#713F12','#FEF3C7'], ['#1F2937','#F3F4F6'],
];
function palette(name: string) { return PALETTES[name.charCodeAt(0) % PALETTES.length] ?? PALETTES[0]!; }

/* ─── tiny shared pieces ──────────────────────────────────────────────────── */
function Av({ name, size = 40 }: { name: string; size?: number }) {
  const [fg, bg] = palette(name);
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:bg, border:`1.5px solid ${fg}28`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <span style={{ fontSize:size*0.33, fontWeight:800, color:fg, letterSpacing:'-0.01em' }}>
        {inits(name)}
      </span>
    </div>
  );
}

function Dot({ status, size = 9 }: { status: ChelavStatus; size?: number }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background: DOT[status],
      boxShadow: `0 0 0 2px ${DOT[status]}22`,
    }}/>
  );
}

function Pill({ status }: { status: ChelavStatus }) {
  const b = BADGE[status];
  return (
    <span style={{
      fontSize:11, fontWeight:700, borderRadius:20, padding:'3px 9px',
      background:b.bg, color:b.text, flexShrink:0, lineHeight:1,
    }}>
      {LABEL[status]}
    </span>
  );
}

/* ─── action btn ──────────────────────────────────────────────────────────── */
function ActBtn({
  icon, label, bg, color, border, onClick, disabled,
}: {
  icon: React.ReactNode; label: string;
  bg: string; color: string; border: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex:1, height:40, borderRadius:12,
        background:bg, color, border:`1.5px solid ${border}`,
        fontSize:12.5, fontWeight:700, cursor: disabled ? 'default' : 'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:5,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}{label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TODAY ZONE — no card, just a tinted section
   ══════════════════════════════════════════════════════════════════════════ */
function TodayZone({ entry, canOperate, isPending, onAct, onSwap }: {
  entry: ChelavEntry | null;
  canOperate: boolean;
  isPending: boolean;
  onAct: (id: string, s: ChelavStatus) => void;
  onSwap: (id: string) => void;
}) {
  if (!entry) {
    return (
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #ECEEE8' }}>
        <p style={{ fontSize:11.5, fontWeight:600, color:'#9AA89E', letterSpacing:'0.06em', textTransform:'uppercase' }}>
          Today
        </p>
        <p style={{ fontSize:15, fontWeight:500, color:'#9AA89E', marginTop:4 }}>No duty scheduled</p>
      </div>
    );
  }

  const { dow, num, mon } = dp(eISO(entry));
  const isAssigned = entry.status === 'ASSIGNED';

  return (
    <div style={{
      background:'#F0FBF5', borderBottom:'1px solid #C9EAD9', padding:'16px 20px 18px',
    }}>
      {/* Label row */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
        <Dot status={entry.status} size={7}/>
        <span style={{ fontSize:11, fontWeight:700, color:'#0E7A52', letterSpacing:'0.07em', textTransform:'uppercase' }}>
          Today · {dow}, {num} {mon}
        </span>
      </div>

      {/* Name row */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Av name={entry.displayLabel} size={48}/>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{
            fontSize:22, fontWeight:800, color:'#0A1C12',
            letterSpacing:'-0.025em', lineHeight:1.1,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          }}>
            {entry.displayLabel}
          </p>
          <div style={{ marginTop:5 }}>
            <Pill status={entry.status}/>
          </div>
        </div>
      </div>

      {/* Actions */}
      {canOperate && (
        <div style={{ display:'flex', gap:7, marginTop:14 }}>
          {isAssigned ? (
            <>
              <ActBtn
                icon={isPending ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/> : <CheckCircle2 size={13} strokeWidth={2.2}/>}
                label="Completed"
                bg="#D1FAE5" color="#065F46" border="#6EE7B7"
                onClick={() => onAct(entry.id, 'COMPLETED')} disabled={isPending}
              />
              <ActBtn
                icon={<XCircle size={13} strokeWidth={2.2}/>}
                label="Missed"
                bg="#FEE2E2" color="#991B1B" border="#FECACA"
                onClick={() => onAct(entry.id, 'SKIPPED')} disabled={isPending}
              />
              <button
                onClick={() => onSwap(entry.id)}
                style={{
                  width:40, height:40, borderRadius:12, flexShrink:0,
                  background:'#fff', border:'1.5px solid #E2E8E0',
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                }}
              >
                <ArrowLeftRight size={14} color="#6B7280" strokeWidth={2.2}/>
              </button>
            </>
          ) : (
            <ActBtn
              icon={<RotateCcw size={13} strokeWidth={2.2}/>}
              label="Reset to Scheduled"
              bg="#fff" color="#6B7280" border="#E2E8E0"
              onClick={() => onAct(entry.id, 'ASSIGNED')} disabled={isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   UP NEXT — horizontal chip row
   ══════════════════════════════════════════════════════════════════════════ */
function UpNext({ entries, today }: { entries: ChelavEntry[]; today: string }) {
  const upcoming = entries
    .filter(e => eISO(e) > today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 7);

  if (upcoming.length === 0) return null;

  return (
    <div style={{ borderBottom:'1px solid #ECEEE8', padding:'12px 20px' }}>
      <p style={{
        fontSize:10.5, fontWeight:700, color:'#9AA89E',
        letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:8,
      }}>
        Up Next
      </p>
      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:2 }}>
        {upcoming.map(e => {
          const { dow, num } = dp(eISO(e));
          return (
            <div key={e.id} style={{
              display:'inline-flex', alignItems:'center', gap:6, flexShrink:0,
              height:32, borderRadius:20, padding:'0 12px',
              background:'#fff', border:'1px solid #E8EAE4',
              boxShadow:'0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <Dot status={e.status} size={6}/>
              <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>
                {first(e.displayLabel)}
              </span>
              <span style={{ fontSize:11, fontWeight:500, color:'#B0B8B4' }}>
                {dow} {num}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TIMELINE ROW
   ══════════════════════════════════════════════════════════════════════════ */
function TimelineRow({ entry, today, isSwapSrc, isSwapMode, onClick }: {
  entry: ChelavEntry;
  today: string;
  isSwapSrc: boolean;
  isSwapMode: boolean;
  onClick: () => void;
}) {
  const iso = eISO(entry);
  const isToday = iso === today;
  const swapTarget = isSwapMode && !isSwapSrc;
  const { num, dow } = dp(iso);

  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:0,
        width:'100%', textAlign:'left', cursor:'pointer', border:'none',
        background: isSwapSrc ? '#EFF6FF' : isToday ? '#F5FDF8' : 'transparent',
        padding:'10px 20px',
        borderLeft: isSwapSrc ? '3px solid #93C5FD' : isToday ? '3px solid #0E7A52' : '3px solid transparent',
        transition:'background 0.1s',
      }}
    >
      {/* Date col */}
      <div style={{ width:46, flexShrink:0, textAlign:'right', paddingRight:12 }}>
        <span style={{
          fontSize:19, fontWeight:800, lineHeight:1, display:'block',
          color: isSwapSrc ? '#2563EB' : isToday ? '#0E7A52' : '#111827',
        }}>
          {num}
        </span>
        <span style={{
          fontSize:9.5, fontWeight:700, letterSpacing:'0.05em', display:'block', marginTop:1,
          color: isSwapSrc ? '#93C5FD' : isToday ? '#34D399' : '#C4C9C1',
        }}>
          {dow}
        </span>
      </div>

      {/* Status dot */}
      <div style={{ width:20, display:'flex', justifyContent:'center', flexShrink:0 }}>
        <Dot status={entry.status} size={isToday ? 10 : 8}/>
      </div>

      {/* Avatar */}
      <Av name={entry.displayLabel} size={34}/>

      {/* Name */}
      <div style={{ flex:1, minWidth:0, paddingLeft:10 }}>
        <p style={{
          fontSize:13.5, fontWeight: isToday ? 700 : 600,
          color: isToday ? '#0A1C12' : '#374151',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>
          {entry.displayLabel}
          {isSwapSrc && (
            <span style={{
              marginLeft:6, fontSize:9.5, fontWeight:800, letterSpacing:'0.04em',
              background:'#2563EB', color:'#fff', borderRadius:4, padding:'1px 5px',
            }}>
              SWAP
            </span>
          )}
          {swapTarget && (
            <span style={{
              marginLeft:6, fontSize:9.5, fontWeight:800, letterSpacing:'0.04em',
              background:'#0891B2', color:'#fff', borderRadius:4, padding:'1px 5px',
            }}>
              TAP
            </span>
          )}
        </p>
        {entry.notes && (
          <p style={{ fontSize:11, color:'#9AA89E', marginTop:2, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {entry.notes}
          </p>
        )}
      </div>

      {/* Pill */}
      <div style={{ paddingLeft:8, flexShrink:0 }}>
        <Pill status={entry.status}/>
      </div>

      {/* Chevron */}
      <ChevronRight size={13} color="#D1D5DB" strokeWidth={2} style={{ flexShrink:0, marginLeft:4 }}/>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ACTION SHEET
   ══════════════════════════════════════════════════════════════════════════ */
function ActionSheet({ entry, canOperate, noteText, onNoteChange, isPending, onAct, onSwap, onClose }: {
  entry: ChelavEntry; canOperate: boolean;
  noteText: string; onNoteChange: (v: string) => void;
  isPending: boolean;
  onAct: (id: string, s: ChelavStatus, note?: string) => void;
  onSwap: () => void; onClose: () => void;
}) {
  const { long } = dp(eISO(entry));
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.38)', zIndex:50, animation:'fadein 0.15s' }}/>
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:51,
        background:'#fff', borderRadius:'22px 22px 0 0',
        boxShadow:'0 -4px 40px rgba(15,23,42,0.16)',
        animation:'slideup 0.24s cubic-bezier(0.32,0.72,0,1)',
        paddingBottom:40,
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:34, height:4, borderRadius:2, background:'#D1D5DB' }}/>
        </div>

        {/* Entry header */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 20px 16px' }}>
          <Av name={entry.displayLabel} size={44}/>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:17, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em' }}>
              {entry.displayLabel}
            </p>
            <p style={{ fontSize:12, color:'#7A9185', marginTop:2 }}>{long}</p>
            <div style={{ marginTop:6 }}><Pill status={entry.status}/></div>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, borderRadius:9, background:'#F0F2EC',
            border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <X size={15} color="#6B7280"/>
          </button>
        </div>

        {canOperate && (
          <div style={{ padding:'0 20px', display:'flex', flexDirection:'column', gap:7 }}>
            {/* Note */}
            <input
              value={noteText}
              onChange={e => onNoteChange(e.target.value)}
              placeholder="Add a note (optional)"
              style={{
                height:40, borderRadius:11, border:'1.5px solid #E8EAE4',
                background:'#FAFAF8', padding:'0 14px', fontSize:13,
                color:'#374151', outline:'none', fontFamily:'inherit', width:'100%', boxSizing:'border-box',
              }}
            />

            {entry.status !== 'COMPLETED' && (
              <button onClick={() => onAct(entry.id, 'COMPLETED', noteText || undefined)} disabled={isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  height:46, borderRadius:13, border:'1.5px solid #6EE7B7',
                  background:'linear-gradient(135deg,#ECFDF5,#D1FAE5)',
                  color:'#065F46', fontSize:14, fontWeight:700, cursor:'pointer',
                }}>
                {isPending ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <CheckCircle2 size={15} strokeWidth={2.2}/>}
                Mark Completed
              </button>
            )}
            {entry.status !== 'SKIPPED' && (
              <button onClick={() => onAct(entry.id, 'SKIPPED', noteText || undefined)} disabled={isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  height:46, borderRadius:13, border:'1.5px solid #FECACA',
                  background:'linear-gradient(135deg,#FEF2F2,#FEE2E2)',
                  color:'#991B1B', fontSize:14, fontWeight:700, cursor:'pointer',
                }}>
                <XCircle size={15} strokeWidth={2.2}/> Mark Missed
              </button>
            )}
            <button onClick={onSwap}
              style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                height:46, borderRadius:13, border:'1.5px solid #BFDBFE',
                background:'linear-gradient(135deg,#EFF6FF,#DBEAFE)',
                color:'#1E40AF', fontSize:14, fontWeight:700, cursor:'pointer',
              }}>
              <ArrowLeftRight size={15} strokeWidth={2.2}/> Swap with Another Day
            </button>
            {entry.status !== 'ASSIGNED' && (
              <button onClick={() => onAct(entry.id, 'ASSIGNED')} disabled={isPending}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  height:42, borderRadius:13, border:'1.5px solid #E8EAE4',
                  background:'#FAFAF8', color:'#6B7280', fontSize:13, fontWeight:700, cursor:'pointer',
                }}>
                <RotateCcw size={13} strokeWidth={2.2}/> Reset to Scheduled
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   IMPORT MODAL
   ══════════════════════════════════════════════════════════════════════════ */
function ImportModal({ pending, err, result, onChoose, onClose }: {
  pending: boolean;
  err: string;
  result: { imported: number; errors: { row: number; date: string; message: string }[] } | null;
  onChoose: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.38)', zIndex:50, animation:'fadein 0.15s' }}/>
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:51,
        background:'#fff', borderRadius:'22px 22px 0 0',
        boxShadow:'0 -4px 40px rgba(15,23,42,0.16)',
        animation:'slideup 0.24s cubic-bezier(0.32,0.72,0,1)',
        padding:'0 20px 48px',
      }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
          <div style={{ width:34, height:4, borderRadius:2, background:'#D1D5DB' }}/>
        </div>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'10px 0 16px' }}>
          <div>
            <p style={{ fontSize:18, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em' }}>Upload Schedule</p>
            <p style={{ fontSize:12, color:'#7A9185', marginTop:3 }}>One row per day — date, household name</p>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, background:'#F0F2EC', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <X size={15} color="#6B7280"/>
          </button>
        </div>

        <div style={{ background:'#F5F4F0', borderRadius:11, padding:'11px 14px', marginBottom:12, fontSize:12, color:'#6B7280', fontFamily:'monospace', lineHeight:1.8 }}>
          2026-07-01,Anas Mohammed<br/>
          2026-07-02,Sinan Ali<br/>
          2026-07-03,Rashid Koya
        </div>
        <p style={{ fontSize:11.5, color:'#9AA89E', marginBottom:14, lineHeight:1.6 }}>
          Names matched against active members. Exempt members excluded. Non-member names accepted as-is.
        </p>

        {result && (
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'#D1FAE5', borderRadius:11, border:'1px solid #6EE7B7', marginBottom: result.errors.length ? 7 : 0 }}>
              <CheckCircle2 size={14} color="#065F46"/>
              <p style={{ fontSize:13, fontWeight:700, color:'#065F46' }}>{result.imported} entries imported</p>
            </div>
            {result.errors.length > 0 && (
              <div style={{ padding:'9px 13px', background:'#FEE2E2', borderRadius:11, border:'1px solid #FECACA' }}>
                <p style={{ fontSize:12, fontWeight:700, color:'#991B1B', marginBottom:4 }}>{result.errors.length} rows failed</p>
                {result.errors.slice(0,4).map((er,i) => (
                  <p key={i} style={{ fontSize:11.5, color:'#B91C1C' }}>Row {er.row} ({er.date}): {er.message}</p>
                ))}
              </div>
            )}
          </div>
        )}
        {err && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 13px', background:'#FEE2E2', borderRadius:11, border:'1px solid #FECACA', marginBottom:12 }}>
            <AlertCircle size={14} color="#DC2626"/>
            <p style={{ fontSize:13, color:'#991B1B' }}>{err}</p>
          </div>
        )}

        <button
          onClick={onChoose}
          disabled={pending}
          style={{
            width:'100%', height:50, borderRadius:13, border:'none',
            background: pending ? '#7FBFA0' : '#0D6341',
            color:'#fff', fontSize:14, fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            cursor: pending ? 'default' : 'pointer', fontFamily:'inherit',
            boxShadow: pending ? 'none' : '0 4px 16px rgba(13,99,65,0.28)',
          }}
        >
          {pending
            ? <><Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> Processing…</>
            : <><Upload size={14} strokeWidth={2.2}/> Choose File</>}
        </button>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SKELETON
   ══════════════════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div style={{ animation:'pulse 1.5s ease-in-out infinite' }}>
      {/* today zone skeleton */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #ECEEE8' }}>
        <div style={{ width:100, height:10, borderRadius:6, background:'#E5E7EB', marginBottom:12 }}/>
        <div style={{ display:'flex', gap:12 }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'#E5E7EB', flexShrink:0 }}/>
          <div>
            <div style={{ width:160, height:20, borderRadius:8, background:'#E5E7EB', marginBottom:8 }}/>
            <div style={{ width:70, height:16, borderRadius:20, background:'#E5E7EB' }}/>
          </div>
        </div>
      </div>
      {/* rows skeleton */}
      <div style={{ padding:'8px 20px' }}>
        {Array.from({length:8}).map((_,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #F0F2EC' }}>
            <div style={{ width:34, textAlign:'right' }}>
              <div style={{ width:26, height:18, borderRadius:5, background:'#E5E7EB', marginLeft:'auto' }}/>
            </div>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#E5E7EB' }}/>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'#E5E7EB', flexShrink:0 }}/>
            <div style={{ flex:1, height:13, borderRadius:6, background:'#E5E7EB' }}/>
            <div style={{ width:64, height:20, borderRadius:20, background:'#E5E7EB' }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════════════════ */
type Filter = 'ALL' | ChelavStatus;

export default function ChelavPage() {
  const searchParams  = useSearchParams();
  const swapTargetId  = searchParams.get('swap');

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, isLoading } = useMonthSchedule(year, month);
  const entries = data?.entries ?? [];

  const updateStatus = useUpdateChelavStatus();
  const swapMutation = useSwapChelav();
  const importMut    = useImportChelav();

  const role       = useAuthStore(s => s.user?.committeeRole);
  const isAdmin    = hasMinRole(role, 'ADMIN');
  const canOperate = hasMinRole(role, 'PAYMENT_OPERATOR');

  const today      = todayISO();
  const todayEntry = entries.find(e => eISO(e) === today) ?? null;

  const [filter, setFilter]         = useState<Filter>('ALL');
  const [sheet, setSheet]           = useState<ChelavEntry | null>(null);
  const [noteText, setNoteText]     = useState('');
  const [swapMode, setSwapMode]     = useState<string | null>(swapTargetId);
  const [importOpen, setImportOpen] = useState(false);
  const [importErr, setImportErr]   = useState('');
  const [importRes, setImportRes]   = useState<{ imported: number; errors: { row: number; date: string; message: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MONTH_NAME = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const filtered = filter === 'ALL' ? entries : entries.filter(e => e.status === filter);

  function act(id: string, s: ChelavStatus, note?: string) {
    if (updateStatus.isPending) return;
    updateStatus.mutate({ id, status: s, notes: note }, { onSuccess: () => setSheet(null) });
  }

  function handleSwapRow(e: ChelavEntry) {
    if (swapMode === null)        { setSwapMode(e.id); setSheet(null); }
    else if (swapMode === e.id)   { setSwapMode(null); }
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

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL',       label: `All (${entries.length})` },
    { key: 'ASSIGNED',  label: `Scheduled (${entries.filter(e=>e.status==='ASSIGNED').length})` },
    { key: 'COMPLETED', label: `Completed (${entries.filter(e=>e.status==='COMPLETED').length})` },
    { key: 'SKIPPED',   label: `Missed (${entries.filter(e=>e.status==='SKIPPED').length})` },
    { key: 'SWAPPED',   label: `Changed (${entries.filter(e=>e.status==='SWAPPED').length})` },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#FAFAF8', paddingBottom:90 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        position:'sticky', top:0, zIndex:40,
        background:'rgba(250,250,248,0.95)', backdropFilter:'blur(12px)',
        borderBottom:'1px solid #E8EAE4',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:56,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Link href="/dashboard" style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            width:34, height:34, borderRadius:9, background:'#F0F2EC', color:'#374151', flexShrink:0,
          }}>
            <ChevronLeft size={17} strokeWidth={2.2}/>
          </Link>
          <div>
            <h1 style={{ fontSize:15.5, fontWeight:800, color:'#0A1C12', letterSpacing:'-0.02em', lineHeight:1 }}>
              Chelav
            </h1>
            <p style={{ fontSize:11, color:'#9AA89E', marginTop:1.5, fontWeight:500 }}>
              {MONTH_NAME}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setImportOpen(true); setImportRes(null); setImportErr(''); }}
            style={{
              display:'flex', alignItems:'center', gap:5, flexShrink:0,
              fontSize:11.5, fontWeight:700, color:'#0A5C3C',
              background:'#E8F5EF', border:'1px solid #C9EAD9',
              borderRadius:9, padding:'7px 13px', cursor:'pointer',
            }}
          >
            <Upload size={12} strokeWidth={2.2}/> Upload Schedule
          </button>
        )}
      </div>

      {/* ── Swap banner ─────────────────────────────────────────────────── */}
      {swapMode && (
        <div style={{
          background:'#EFF6FF', borderBottom:'1px solid #BFDBFE',
          padding:'10px 20px', display:'flex', alignItems:'center', gap:10,
        }}>
          <ArrowLeftRight size={14} color="#2563EB" strokeWidth={2.2}/>
          <p style={{ fontSize:13, fontWeight:600, color:'#1D4ED8', flex:1 }}>
            {swapMutation.isPending ? 'Swapping…' : 'Tap a row to swap'}
          </p>
          <button onClick={() => setSwapMode(null)} style={{
            background:'none', border:'none', cursor:'pointer', padding:4,
          }}>
            <X size={14} color="#93C5FD"/>
          </button>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Skeleton/>
      ) : (
        <>
          {/* Today zone */}
          <TodayZone
            entry={todayEntry}
            canOperate={canOperate}
            isPending={updateStatus.isPending}
            onAct={act}
            onSwap={id => setSwapMode(id)}
          />

          {/* Up next */}
          <UpNext entries={entries} today={today}/>

          {/* Schedule section */}
          <div>
            {/* Section header + filter */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'14px 20px 0',
            }}>
              <p style={{
                fontSize:11, fontWeight:700, color:'#9AA89E',
                letterSpacing:'0.07em', textTransform:'uppercase',
              }}>
                {MONTH_NAME}
              </p>
            </div>

            {/* Filter chips */}
            <div style={{ display:'flex', gap:5, overflowX:'auto', padding:'10px 20px 12px' }}>
              {FILTERS.map(f => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    style={{
                      flexShrink:0, height:30, borderRadius:20,
                      border: active ? 'none' : '1px solid #E8EAE4',
                      padding:'0 12px', fontSize:11.5, fontWeight:700, cursor:'pointer',
                      background: active ? '#0E7A52' : '#fff',
                      color: active ? '#fff' : '#6B7280',
                      boxShadow: active ? '0 2px 8px rgba(14,122,82,0.20)' : '0 1px 2px rgba(0,0,0,0.04)',
                      transition:'all 0.13s',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Timeline list */}
            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 20px' }}>
                <p style={{ fontSize:15, fontWeight:700, color:'#374151' }}>No entries</p>
                <p style={{ fontSize:13, color:'#9AA89E', marginTop:4 }}>
                  {filter === 'ALL'
                    ? 'Upload a schedule to get started.'
                    : 'Try a different filter.'}
                </p>
                {filter === 'ALL' && isAdmin && (
                  <button
                    onClick={() => { setImportOpen(true); setImportRes(null); setImportErr(''); }}
                    style={{ marginTop:14, fontSize:13, fontWeight:700, color:'#0E7A52', background:'none', border:'none', cursor:'pointer' }}
                  >
                    Upload Schedule →
                  </button>
                )}
              </div>
            ) : (
              <div>
                {filtered.map((e, i) => (
                  <div key={e.id}>
                    <TimelineRow
                      entry={e}
                      today={today}
                      isSwapSrc={e.id === swapMode}
                      isSwapMode={swapMode !== null}
                      onClick={() => swapMode ? handleSwapRow(e) : (setSheet(e), setNoteText(e.notes ?? ''))}
                    />
                    {i < filtered.length - 1 && (
                      <div style={{ height:1, background:'#F0F2EC', margin:'0 20px 0 86px' }}/>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Sheets */}
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
          pending={importMut.isPending}
          err={importErr}
          result={importRes}
          onChoose={() => fileRef.current?.click()}
          onClose={() => setImportOpen(false)}
        />
      )}

      <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleFile}/>

      <style>{`
        @keyframes spin    { to   { transform: rotate(360deg) } }
        @keyframes pulse   { 0%,100% { opacity:.5 } 50% { opacity:.9 } }
        @keyframes slideup { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes fadein  { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
