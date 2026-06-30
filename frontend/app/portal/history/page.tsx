'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ReceiptText, RotateCcw } from 'lucide-react';
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

const STATUS: Record<MonthRecord['status'], { dot: string; color: string }> = {
  Paid:    { dot: '#22C55E', color: '#16A34A' },
  Partial: { dot: '#F59E0B', color: '#B45309' },
  Pending: { dot: '#94A3B8', color: '#64748B' },
  Overdue: { dot: '#EF4444', color: '#EF4444' },
};

type Tab = 'monthly' | 'receipts';

// ─── Month Row ────────────────────────────────────────────────────────────────

function MonthRow({ record, isLast }: { record: MonthRecord; isLast: boolean }) {
  const cfg = STATUS[record.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 0',
      borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: '0 0 2px' }}>
          {fmtMonthLabel(record.month)}
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{record.planName}</p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 2px' }}>
          {fmtAmount(record.monthlyDue)}
        </p>
        <p style={{ fontSize: 12, fontWeight: 600, color: cfg.color, margin: 0 }}>
          {record.status}
        </p>
      </div>
    </div>
  );
}

// ─── Receipt Row ──────────────────────────────────────────────────────────────

function ReceiptRow({ receipt, isLast }: { receipt: ReceiptRecord; isLast: boolean }) {
  const isReversed = receipt.isReversed;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0',
      borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        background: isReversed ? '#FEF2F2' : '#F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isReversed
          ? <RotateCcw size={18} color="#EF4444" />
          : <ReceiptText size={18} color="#64748B" />
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {receipt.receiptNumber ?? (isReversed ? 'Reversed' : 'Payment')}
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
          {receipt.paymentMode} · {fmtDate(receipt.date)}
        </p>
      </div>

      {/* Amount + badge */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: isReversed ? '#EF4444' : '#0F172A', margin: '0 0 4px', letterSpacing: -0.3 }}>
          {fmtAmount(receipt.amount)}
        </p>
        <span style={{
          fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '2px 8px',
          color: isReversed ? '#EF4444' : '#16A34A',
          background: isReversed ? '#FEF2F2' : '#DCFCE7',
        }}>
          {isReversed ? 'Reversed' : 'Paid'}
        </span>
      </div>

      <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
    </div>
  );
}

// ─── History Page ─────────────────────────────────────────────────────────────

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
        background: 'rgba(248,250,251,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '52px 20px 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B', display: 'flex', alignItems: 'center', borderRadius: 8 }}>
            <ChevronLeft size={22} />
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.5 }}>History</h1>
        </div>

        {/* Stats row */}
        {isLoading ? (
          <div style={{ display: 'flex', gap: 0, padding: '0 24px 16px' }}>
            {[1,2,3].map((i) => <div key={i} style={{ flex: 1, height: 44, background: '#F1F5F9', borderRadius: 10, margin: '0 4px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : data && (
          <div style={{ display: 'flex', padding: '0 24px 16px', gap: 0 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: parseFloat(data.summary.totalOutstanding) > 0 ? '#EF4444' : '#0F172A', margin: '0 0 3px', letterSpacing: -0.5 }}>
                {fmtAmount(data.summary.totalOutstanding)}
              </p>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontWeight: 500 }}>Outstanding</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #F1F5F9', borderRight: '1px solid #F1F5F9' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#15803D', margin: '0 0 3px', letterSpacing: -0.5 }}>
                {fmtAmount(data.summary.totalPaid)}
              </p>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontWeight: 500 }}>Total Paid</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: data.summary.overdueMonths > 0 ? '#EF4444' : '#64748B', margin: '0 0 3px', letterSpacing: -0.5 }}>
                {data.summary.overdueMonths}
              </p>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontWeight: 500 }}>Overdue Months</p>
            </div>
          </div>
        )}

        {/* Tab underline switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
          {(['monthly', 'receipts'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, height: 44, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? '#15803D' : '#94A3B8',
                background: 'transparent',
                borderBottom: tab === t ? '2.5px solid #15803D' : '2.5px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {t === 'monthly' ? 'Monthly Record' : 'Receipts'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 20px 24px' }}>

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} style={{ height: 68, borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F1F5F9' }} />
                <div style={{ flex: 1, height: 14, background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        )}

        {/* Monthly record */}
        {data && tab === 'monthly' && (
          data.monthlyRecord.length === 0 ? (
            <p style={{ fontSize: 15, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>No records yet</p>
          ) : (
            <div>
              {data.monthlyRecord.map((r, i) => (
                <MonthRow key={r.month} record={r} isLast={i === data.monthlyRecord.length - 1} />
              ))}
            </div>
          )
        )}

        {/* Receipts */}
        {data && tab === 'receipts' && (
          data.receipts.length === 0 ? (
            <p style={{ fontSize: 15, color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>No receipts yet</p>
          ) : (
            <div>
              {data.receipts.map((r, i) => (
                <ReceiptRow key={r.id} receipt={r} isLast={i === data.receipts.length - 1} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
