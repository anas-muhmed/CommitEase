'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ReceiptText, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { getMemberHistory } from '@/lib/api/member.api';
import type { MonthRecord, ReceiptRecord } from '@/lib/api/member.api';

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtAmount(s: string): string {
  return `₹${parseFloat(s).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  return new Date(parseInt(y!), parseInt(m!) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<MonthRecord['status'], { label: string; color: string; bg: string; dot: string }> = {
  Paid:    { label: 'Paid',    color: '#15803D', bg: '#DCFCE7', dot: '#4ADE80' },
  Partial: { label: 'Partial', color: '#B45309', bg: '#FEF3C7', dot: '#FBBF24' },
  Pending: { label: 'Pending', color: '#475569', bg: '#F1F5F9', dot: '#94A3B8' },
  Overdue: { label: 'Overdue', color: '#EF4444', bg: '#FEF2F2', dot: '#FCA5A5' },
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, danger, muted }: { label: string; value: string; danger?: boolean; muted?: boolean }) {
  return (
    <div style={{
      flex: 1, background: '#FFFFFF', borderRadius: 20,
      padding: '18px 16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: danger ? '#EF4444' : muted ? '#64748B' : '#0F172A', margin: 0, letterSpacing: -0.5 }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontWeight: 500 }}>{label}</p>
    </div>
  );
}

// ─── Month Card ───────────────────────────────────────────────────────────────

function MonthCard({ record }: { record: MonthRecord }) {
  const cfg = STATUS[record.status];
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 20, padding: '18px 20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 3px', whiteSpace: 'nowrap' }}>
            {fmtMonthLabel(record.month)}
          </p>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>{record.planName}</p>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '0 0 5px', letterSpacing: -0.3 }}>
          {fmtAmount(record.monthlyDue)}
        </p>
        <span style={{
          fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg,
          padding: '3px 10px', borderRadius: 100, display: 'inline-block',
        }}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Receipt Card ─────────────────────────────────────────────────────────────

function ReceiptCard({ receipt }: { receipt: ReceiptRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isReversed = receipt.isReversed;

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 20,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      border: isReversed ? '1.5px solid rgba(239,68,68,0.2)' : '1px solid transparent',
    }}>
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '18px 20px', fontFamily: 'inherit', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        {/* Icon */}
        <div style={{
          width: 48, height: 48, borderRadius: 16, flexShrink: 0,
          background: isReversed ? '#FEF2F2' : '#ECFDF5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isReversed
            ? <RotateCcw size={20} color="#EF4444" />
            : <ReceiptText size={20} color="#15803D" />
          }
        </div>

        {/* Center */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {receipt.receiptNumber ?? (isReversed ? 'Payment Reversed' : 'Payment')}
          </p>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
            {receipt.paymentMode} · {fmtDate(receipt.date)}
          </p>
        </div>

        {/* Right */}
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: isReversed ? '#EF4444' : '#0F172A', margin: 0, letterSpacing: -0.3 }}>
            {isReversed ? `−${fmtAmount(receipt.amount)}` : fmtAmount(receipt.amount)}
          </p>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: isReversed ? '#EF4444' : '#15803D',
            background: isReversed ? '#FEF2F2' : '#DCFCE7',
            padding: '2px 8px', borderRadius: 100,
          }}>
            {isReversed ? 'Reversed' : 'Success'}
          </span>
        </div>

        {/* Expand chevron */}
        <div style={{ marginLeft: 4 }}>
          {expanded ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 20px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {receipt.clearedMonths.length > 0 && (
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Cleared: <strong style={{ color: '#0F172A' }}>{receipt.clearedMonths.join(', ')}</strong>
            </p>
          )}
          {receipt.note && (
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Note: {receipt.note}</p>
          )}
          {isReversed && receipt.reversalReason && (
            <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '10px 14px', marginTop: 4 }}>
              <p style={{ fontSize: 13, color: '#EF4444', margin: 0, fontWeight: 500 }}>
                Reason: {receipt.reversalReason}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History Page ─────────────────────────────────────────────────────────────

type Tab = 'monthly' | 'receipts';

export default function PortalHistoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('monthly');

  const { data, isLoading } = useQuery({
    queryKey: ['member-history'],
    queryFn: getMemberHistory,
    staleTime: 60_000,
  });

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(248,250,251,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '52px 20px 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#64748B', display: 'flex', alignItems: 'center', borderRadius: 10 }}>
            <ChevronLeft size={22} />
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.5 }}>History</h1>
        </div>

        {/* Stat cards */}
        {isLoading ? (
          <div style={{ display: 'flex', gap: 10, padding: '0 20px 16px' }}>
            {[1,2,3].map((i) => <div key={i} style={{ flex: 1, height: 72, background: '#FFFFFF', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : data && (
          <div style={{ display: 'flex', gap: 10, padding: '0 20px 16px' }}>
            <StatCard label="Outstanding" value={fmtAmount(data.summary.totalOutstanding)} danger={parseFloat(data.summary.totalOutstanding) > 0} />
            <StatCard label="Total Paid" value={fmtAmount(data.summary.totalPaid)} />
            <StatCard label="Overdue" value={`${data.summary.overdueMonths}`} muted />
          </div>
        )}

        {/* Pill switcher */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            background: '#F1F5F9', borderRadius: 14, padding: 4,
            display: 'flex', gap: 0,
          }}>
            {(['monthly', 'receipts'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, height: 38, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: 600, borderRadius: 11,
                  background: tab === t ? '#FFFFFF' : 'transparent',
                  color: tab === t ? '#0F172A' : '#64748B',
                  boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {t === 'monthly' ? 'Monthly Record' : 'Receipts'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px 24px' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map((i) => (
              <div key={i} style={{ height: 80, background: '#FFFFFF', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* Monthly record */}
        {data && tab === 'monthly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.monthlyRecord.length === 0 && (
              <p style={{ fontSize: 15, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>No records yet</p>
            )}
            {data.monthlyRecord.map((r) => <MonthCard key={r.month} record={r} />)}
          </div>
        )}

        {/* Receipts */}
        {data && tab === 'receipts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.receipts.length === 0 && (
              <p style={{ fontSize: 15, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>No receipts yet</p>
            )}
            {data.receipts.map((r) => <ReceiptCard key={r.id} receipt={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
