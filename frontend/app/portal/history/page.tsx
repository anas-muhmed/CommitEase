'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ReceiptText, RotateCcw } from 'lucide-react';
import { getMemberHistory } from '@/lib/api/member.api';
import PaymentIntentSheet from '@/components/portal/PaymentIntentSheet';
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

const STATUS: Record<MonthRecord['status'], { dot: string; color: string; bg: string }> = {
  Paid:    { dot: '#22C55E', color: '#16A34A', bg: '#DCFCE7' },
  Partial: { dot: '#F59E0B', color: '#B45309', bg: '#FEF3C7' },
  Pending: { dot: '#94A3B8', color: '#64748B', bg: '#F1F5F9' },
  Overdue: { dot: '#EF4444', color: '#EF4444', bg: '#FEF2F2' },
};

type MainTab    = 'monthly' | 'receipts';
type FilterTab  = 'all' | 'pending' | 'paid';

// ─── Month Row ────────────────────────────────────────────────────────────────

function MonthRow({ record, isLast }: { record: MonthRecord; isLast: boolean }) {
  const cfg = STATUS[record.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 0',
      borderBottom: isLast ? 'none' : '1px solid #F8FAFB',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 1px' }}>
          {fmtMonthLabel(record.month)}
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{record.planName}</p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 2px' }}>
          {fmtAmount(record.monthlyDue)}
        </p>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 100 }}>
          {record.status}
        </span>
      </div>
    </div>
  );
}

// ─── Receipt Row ──────────────────────────────────────────────────────────────

function ReceiptRow({ receipt, isLast }: { receipt: ReceiptRecord; isLast: boolean }) {
  const router = useRouter();
  const isReversed = receipt.isReversed;

  return (
    <button
      onClick={() => router.push(`/portal/receipts/${receipt.id}`)}
      style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 0',
        borderBottom: isLast ? 'none' : '1px solid #F8FAFB',
        textAlign: 'left',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: isReversed ? '#FEF2F2' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isReversed ? <RotateCcw size={16} color="#EF4444" /> : <ReceiptText size={16} color="#64748B" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {receipt.receiptNumber ?? (isReversed ? 'Reversed' : 'Payment')}
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
          {receipt.paymentMode} · {fmtDate(receipt.date)}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: isReversed ? '#EF4444' : '#0F172A', margin: '0 0 3px' }}>
          {fmtAmount(receipt.amount)}
        </p>
        <span style={{ fontSize: 11, fontWeight: 700, color: isReversed ? '#EF4444' : '#16A34A', background: isReversed ? '#FEF2F2' : '#DCFCE7', padding: '2px 8px', borderRadius: 100 }}>
          {isReversed ? 'Reversed' : 'Paid'}
        </span>
      </div>
      <ChevronRight size={14} color="#E2E8F0" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 30, padding: '0 14px', borderRadius: 100, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 12, fontWeight: 600,
        background: active ? '#0D3D26' : '#F1F5F9',
        color: active ? '#FFFFFF' : '#64748B',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ─── History Page ─────────────────────────────────────────────────────────────

export default function PortalHistoryPage() {
  const router = useRouter();
  const [tab, setTab]       = useState<MainTab>('monthly');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showPay, setShowPay] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['member-history'],
    queryFn: getMemberHistory,
    staleTime: 60_000,
  });

  const outstanding = data?.summary.totalOutstanding ?? '0';
  const hasOutstanding = parseFloat(outstanding) > 0;

  const filteredMonthly = data?.monthlyRecord.filter((r) => {
    if (filter === 'paid')    return r.status === 'Paid' || r.status === 'Partial';
    if (filter === 'pending') return r.status === 'Pending' || r.status === 'Overdue';
    return true;
  }) ?? [];

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      <PaymentIntentSheet open={showPay} onClose={() => setShowPay(false)} totalDue={outstanding} />

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(248,250,251,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '52px 20px 14px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B', display: 'flex', borderRadius: 8 }}>
            <ChevronLeft size={22} />
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.4 }}>History</h1>
        </div>

        {/* Stats row */}
        {!isLoading && data && (
          <div style={{ display: 'flex', padding: '0 20px 14px', gap: 0 }}>
            {[
              { label: 'Outstanding', value: fmtAmount(data.summary.totalOutstanding), red: parseFloat(data.summary.totalOutstanding) > 0 },
              { label: 'Total Paid',  value: fmtAmount(data.summary.totalPaid),        red: false, green: true },
              { label: 'Overdue',     value: `${data.summary.overdueMonths} mo`,       red: data.summary.overdueMonths > 0 },
            ].map(({ label, value, red, green }, i, arr) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid #F1F5F9' : 'none' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: red ? '#EF4444' : green ? '#15803D' : '#0F172A', margin: '0 0 2px', letterSpacing: -0.5 }}>
                  {value}
                </p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontWeight: 500 }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pay Now strip — only when outstanding */}
        {!isLoading && hasOutstanding && (
          <div style={{ padding: '0 20px 14px' }}>
            <button
              onClick={() => setShowPay(true)}
              style={{ width: '100%', height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#FFFFFF', boxShadow: '0 4px 16px rgba(21,128,61,0.25)' }}
            >
              Pay Now — {fmtAmount(outstanding)}
            </button>
          </div>
        )}

        {/* Main tab underline */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9' }}>
          {(['monthly', 'receipts'] as MainTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, height: 42, border: 'none', borderBottom: tab === t ? '2px solid #0D3D26' : '2px solid transparent',
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: tab === t ? 700 : 500,
                color: tab === t ? '#0F172A' : '#94A3B8',
                transition: 'all 0.15s',
              }}
            >
              {t === 'monthly' ? 'Monthly Record' : 'Receipts'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px 24px' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1,2,3,4,5].map((i) => (
              <div key={i} style={{ height: 60, background: '#FFFFFF', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {/* Monthly record tab */}
        {!isLoading && data && tab === 'monthly' && (
          <>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <FilterPill label="All"     active={filter === 'all'}     onClick={() => setFilter('all')} />
              <FilterPill label="Pending" active={filter === 'pending'} onClick={() => setFilter('pending')} />
              <FilterPill label="Paid"    active={filter === 'paid'}    onClick={() => setFilter('paid')} />
            </div>

            {filteredMonthly.length === 0 ? (
              <p style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', padding: '40px 0', margin: 0 }}>No records match this filter</p>
            ) : (
              <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '0 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                {filteredMonthly.map((r, i) => (
                  <MonthRow key={r.month} record={r} isLast={i === filteredMonthly.length - 1} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Receipts tab */}
        {!isLoading && data && tab === 'receipts' && (
          data.receipts.length === 0 ? (
            <p style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', padding: '40px 0', margin: 0 }}>No receipts yet</p>
          ) : (
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '0 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
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
