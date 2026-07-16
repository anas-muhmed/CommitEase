'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Phone, Receipt, RotateCcw, Shield, Activity,
  Settings, CreditCard, BookOpen, CheckCircle2, XCircle,
  Pencil, UserX, UserCheck, AlertCircle,
  Loader2, Save, X, MessageCircle,
} from 'lucide-react';
import { useMember, useLedger, usePaymentHistory, useDeactivateMember, useReactivateMember, useUpdateMember, useSwitchPlan } from '@/lib/hooks/useMembers';
import { MemberAvatar } from '@/components/ui/member-avatar';
import type { LedgerRow, PaymentRecord, HealthGrade } from '@/lib/api/members.api';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function inr(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function fmtMonth(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(iso: string | null) {
  if (!iso) return 'Never paid';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const m = Math.floor(days / 30);
  return m < 12 ? `${m} month${m > 1 ? 's' : ''} ago` : `${Math.floor(m / 12)} year${Math.floor(m / 12) > 1 ? 's' : ''} ago`;
}
function buildWhatsAppText(name: string, outstanding: string, overdueMonths: number) {
  return `Assalamu Alaikum ${name},\n\nThis is a gentle reminder from our committee.\n\n📋 Dues Summary:\n• Outstanding: ${inr(outstanding)}\n• Months pending: ${overdueMonths}\n\nPlease make your contribution at your earliest convenience.\n\nJazakAllahu Khayran 🤲`;
}

/* ── Payment Score config ────────────────────────────────────────────────── */
const SCORE_CFG: Record<HealthGrade, { label: string; color: string; bg: string; ring: string }> = {
  EXCELLENT: { label: 'Excellent', color: '#0B6644', bg: '#E8F5EF', ring: '#0E7A52' },
  GOOD:      { label: 'Good',      color: '#065D9A', bg: '#EFF6FF', ring: '#2563EB' },
  RISK:      { label: 'Risk',      color: '#A16207', bg: '#FFFBEB', ring: '#D97706' },
  CRITICAL:  { label: 'Critical',  color: '#DC2626', bg: '#FEF2F2', ring: '#EF4444' },
};

/* ── tabs ─────────────────────────────────────────────────────────────────── */
type Tab = 'overview' | 'ledger' | 'history' | 'analytics' | 'admin';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview',  label: 'Overview', icon: <Shield size={14} />     },
  { key: 'ledger',    label: 'History',  icon: <BookOpen size={14} />   },
  { key: 'history',   label: 'Payments', icon: <CreditCard size={14} /> },
  { key: 'analytics', label: 'Score',    icon: <Activity size={14} />   },
  { key: 'admin',     label: 'Admin',    icon: <Settings size={14} />   },
];

/* ══════════════════════════════════════════════════════════════════════════
   Overview Tab — grouped cards
   ════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ memberId }: { memberId: string }) {
  const { data: member } = useMember(memberId);
  const { data: ledger, isLoading } = useLedger(memberId);

  if (isLoading || !member || !ledger) return <SectionSkeleton rows={6} />;

  const grade = ledger.healthGrade ?? 'EXCELLENT';
  const cfg   = SCORE_CFG[grade];
  const outstanding = parseFloat(ledger.totalOutstanding);
  const currentMonthFee = ledger.rows[ledger.rows.length - 1]?.monthlyDue ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Outstanding banner */}
      {outstanding > 0 ? (
        <div className="rounded-[16px] px-5 py-4 flex items-center justify-between" style={{ background: '#FDF2F1', border: '1px solid rgba(192,57,43,.15)' }}>
          <div>
            <p className="text-[12px] font-semibold text-[#C0392B]">Outstanding Dues</p>
            <p className="text-[11.5px] text-[#C0392B] opacity-75 mt-0.5">{ledger.overdueMonths} month{ledger.overdueMonths !== 1 ? 's' : ''} unpaid</p>
          </div>
          <p className="text-[22px] font-extrabold text-[#C0392B] tabular-nums">{inr(ledger.totalOutstanding)}</p>
        </div>
      ) : (
        <div className="rounded-[16px] px-5 py-4 flex items-center gap-3" style={{ background: '#F0FBF4', border: '1px solid rgba(21,128,61,.15)' }}>
          <div className="w-8 h-8 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <CheckCircle2 size={16} className="text-[#15803D]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#15803D]">All dues cleared</p>
            <p className="text-[11.5px] text-[#15803D] opacity-70">{inr(ledger.totalPaid)} paid total</p>
          </div>
        </div>
      )}

      {/* Financial Summary card */}
      <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F0F2EF]">
          <p className="text-[10.5px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Financial Summary</p>
        </div>
        <div className="grid grid-cols-2">
          <FinCell label="Outstanding" value={outstanding > 0 ? inr(ledger.totalOutstanding) : '—'} valueColor={outstanding > 0 ? '#C0392B' : '#9CA3AF'} borderRight borderBottom />
          <FinCell label="This Month" value={currentMonthFee ? inr(currentMonthFee) : '—'} borderBottom />
          <FinCell label="Old Due" value={parseFloat(ledger.effectiveOpeningDue) > 0 ? inr(ledger.effectiveOpeningDue) : '—'} valueColor={parseFloat(ledger.effectiveOpeningDue) > 0 ? '#A16207' : '#9CA3AF'} borderRight />
          <FinCell
            label={parseFloat(ledger.advanceBalance) > 0 ? 'Extra Paid' : 'Total Paid'}
            value={parseFloat(ledger.advanceBalance) > 0 ? inr(ledger.advanceBalance) : inr(ledger.totalPaid)}
            valueColor="#0C6640"
          />
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F0F2EF]">
          <p className="text-[10.5px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Profile</p>
        </div>
        <InfoRow label="Phone" value={
          <a href={`tel:${member.phone}`} className="flex items-center gap-1.5 text-[#0C6640] font-semibold">
            <Phone size={13} /> {member.phone}
          </a>
        } />
        <InfoRow label="Join Date" value={new Date(member.contributionStartDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} />
        <InfoRow label="Plan" value={member.contributionPlan.name} />
        <InfoRow label="Member Code" value={<span className="font-mono text-[12.5px]">{member.memberCode}</span>} />
      </div>

      {/* Payment Behavior card */}
      <div className="bg-white rounded-[20px] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F0F2EF]">
          <p className="text-[10.5px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Payment Behavior</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-medium text-[#9CA3AF]">Payment Score</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="text-[28px] font-extrabold tabular-nums leading-none" style={{ color: cfg.ring }}>{ledger.healthScore}</p>
                <p className="text-[13px] font-semibold text-[#6B7280]">/ 100</p>
              </div>
            </div>
            <span className="rounded-xl px-3 py-1.5 text-[13px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <div className="h-2 bg-[#F0F2EF] rounded-full overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${ledger.healthScore}%`, background: cfg.ring }} />
          </div>
        </div>
        <div className="border-t border-[#F0F2EF]" />
        <InfoRow label="Last Payment" value={<span className="font-semibold">{fmtDate(ledger.lastPaymentDate)}</span>} />
        <InfoRow label="Overdue Months" value={
          <span className="font-bold" style={{ color: ledger.overdueMonths > 0 ? '#DC2626' : '#0C6640' }}>
            {ledger.overdueMonths > 0 ? `${ledger.overdueMonths} month${ledger.overdueMonths !== 1 ? 's' : ''}` : 'None'}
          </span>
        } />
      </div>

      {/* Quick action */}
      {member.active && (
        <Link
          href={`/payments?member=${memberId}`}
          className="flex items-center justify-center gap-2 bg-[#0E7A52] text-white text-[14px] font-bold rounded-[16px] py-4 shadow-[0_4px_16px_rgba(14,122,82,.30)] hover:bg-[#0B6644] active:scale-[0.99] transition-all"
        >
          <CreditCard size={16} />
          Add Payment
        </Link>
      )}
    </div>
  );
}

/* ── Fin cell ─────────────────────────────────────────────────────────────── */
function FinCell({ label, value, valueColor, borderRight, borderBottom }: {
  label: string; value: string; valueColor?: string;
  borderRight?: boolean; borderBottom?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${borderRight ? 'border-r border-[#F0F2EF]' : ''} ${borderBottom ? 'border-b border-[#F0F2EF]' : ''}`}>
      <p className="text-[11px] font-medium text-[#9CA3AF] mb-0.5">{label}</p>
      <p className="text-[16px] font-bold tabular-nums" style={{ color: valueColor ?? '#111827' }}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   History Tab (Dues Ledger)
   ════════════════════════════════════════════════════════════════════════ */
function LedgerTab({ memberId }: { memberId: string }) {
  const { data, isLoading } = useLedger(memberId);
  const [showAllPaid, setShowAllPaid] = useState(false);

  if (isLoading) return <SectionSkeleton rows={5} />;
  if (!data) return null;

  const overdue = data.rows.filter(r => parseFloat(r.outstanding) > 0);
  const paid    = data.rows.filter(r => parseFloat(r.outstanding) <= 0 && parseFloat(r.paid) > 0);
  const visiblePaid = showAllPaid ? paid : paid.slice(-3);
  const totalOut = parseFloat(data.totalOutstanding);
  const oldDueRemaining = parseFloat(data.effectiveOpeningDue);
  const advanceBalance  = parseFloat(data.advanceBalance);

  const overdueDesc = (() => {
    const parts: string[] = [];
    if (overdue.length > 0) parts.push(`${overdue.length} month${overdue.length !== 1 ? 's' : ''} unpaid`);
    if (oldDueRemaining > 0) parts.push('old due');
    return parts.join(' + ') || 'outstanding';
  })();

  return (
    <div className="flex flex-col gap-4">
      {totalOut > 0 ? (
        <div className="rounded-[16px] px-5 py-4 flex items-center justify-between" style={{ background: '#FDF2F1', border: '1px solid rgba(192,57,43,.15)' }}>
          <div>
            <p className="text-[12px] font-semibold text-[#C0392B]">Outstanding</p>
            <p className="text-[11.5px] text-[#C0392B] opacity-70 mt-0.5">{overdueDesc}</p>
          </div>
          <p className="text-[22px] font-extrabold text-[#C0392B] tabular-nums">{inr(totalOut)}</p>
        </div>
      ) : (
        <div className="rounded-[16px] px-5 py-4 flex items-center gap-3" style={{ background: '#F0FBF4', border: '1px solid rgba(21,128,61,.15)' }}>
          <div className="w-8 h-8 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <CheckCircle2 size={16} className="text-[#15803D]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#15803D]">
              {advanceBalance > 0 ? `${inr(advanceBalance)} extra paid` : 'All dues cleared'}
            </p>
            <p className="text-[11.5px] text-[#15803D] opacity-70">{inr(data.totalPaid)} paid total</p>
          </div>
        </div>
      )}

      {(oldDueRemaining > 0 || overdue.length > 0 || paid.length > 0) && (
        <div className="bg-white rounded-[20px] overflow-hidden shadow-sm">
          {/* Old due row — shown when opening balance has remaining unpaid amount */}
          {oldDueRemaining > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#FDF8F7' }}>
              <div>
                <p className="font-semibold text-[13.5px] text-[#0A1C12]">Old Due</p>
                <p className="text-[11.5px] text-[#7A9185] mt-0.5">
                  {parseFloat(data.openingBalancePaid) > 0
                    ? `${inr(data.openingBalancePaid)} paid of ${inr(data.openingDueBalance)}`
                    : 'Legacy balance before app'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[13.5px] text-[#C0392B] tabular-nums">{inr(oldDueRemaining)} due</p>
              </div>
            </div>
          )}
          {overdue.map((r: LedgerRow, i) => (
            <div key={r.month} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: (i === 0 && oldDueRemaining <= 0) ? 'none' : '1px solid #F0F2EF', background: '#FDF8F7' }}>
              <div>
                <p className="font-semibold text-[13.5px] text-[#0A1C12]">{fmtMonth(r.month)}</p>
                <p className="text-[11.5px] text-[#7A9185] mt-0.5">{r.planName}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[13.5px] text-[#C0392B] tabular-nums">{inr(r.outstanding)} due</p>
                {parseFloat(r.paid) > 0 && (
                  <p className="text-[11px] text-[#A16207] mt-0.5">{inr(r.paid)} partial</p>
                )}
                <p className="text-[11px] text-[#7A9185]">of {inr(r.monthlyDue)}</p>
              </div>
            </div>
          ))}
          {visiblePaid.map((r: LedgerRow, i) => (
            <div key={r.month} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: (i === 0 && overdue.length === 0) ? 'none' : '1px solid #F0F2EF' }}>
              <div>
                <p className="font-medium text-[13.5px] text-[#0A1C12]">{fmtMonth(r.month)}</p>
                <p className="text-[11.5px] text-[#7A9185] mt-0.5">{r.planName}</p>
              </div>
              <span className="rounded-[8px] bg-[#E6F4EC] px-2.5 py-1">
                <span className="text-[11.5px] font-bold text-[#0C6640]">Paid {inr(r.paid)}</span>
              </span>
            </div>
          ))}
          {paid.length > 3 && (
            <button
              onClick={() => setShowAllPaid(v => !v)}
              style={{ width: '100%', padding: '12px 20px', background: 'transparent', border: 'none', borderTop: '1px solid #F0F2EF', cursor: 'pointer' }}
            >
              <span className="text-[12.5px] font-semibold text-[#0C6640]">
                {showAllPaid ? 'Show less' : `Show ${paid.length - 3} more months`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Payment History Tab
   ════════════════════════════════════════════════════════════════════════ */
function HistoryTab({ memberId }: { memberId: string }) {
  const { data, isLoading } = usePaymentHistory(memberId);

  if (isLoading) return <SectionSkeleton rows={4} />;
  if (!data?.length) {
    return (
      <div className="bg-white rounded-[20px] px-5 py-10 text-center shadow-sm">
        <p className="text-[13.5px] font-semibold text-[#7A9185]">No payments recorded yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] overflow-hidden shadow-sm">
      {data.map((p: PaymentRecord, i) => {
        const reversed = !!p.reversal;
        return (
          <div key={p.id} style={{ padding: '16px 20px', borderTop: i === 0 ? 'none' : '1px solid #F0F2EF', opacity: reversed ? 0.55 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p className="font-bold text-[15px] text-[#0A1C12] tabular-nums">{inr(p.amount)}</p>
                  {reversed ? (
                    <span className="flex items-center gap-1 rounded-[8px] bg-[#FDF2F1] px-2 py-[3px]">
                      <RotateCcw size={11} color="#C0392B" />
                      <span className="text-[11px] font-bold text-[#C0392B]">Reversed</span>
                    </span>
                  ) : (
                    <span className="rounded-[8px] bg-[#E6F4EC] px-2 py-[3px]">
                      <span className="text-[11px] font-bold text-[#0C6640]">
                        {p.fundAccount ? p.fundAccount.name : p.paymentMode.replace('_', ' ')}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-[#7A9185] mt-1.5">{fmtDate(p.paymentDate ?? p.createdAt)}</p>
                {p.allocations.length > 0 && (
                  <p className="text-[11.5px] text-[#7A9185] mt-1">
                    → {p.allocations.map(a => a.contributionMonth ? fmtMonth(a.contributionMonth) : 'Old Due').join(', ')}
                  </p>
                )}
                {p.recordedByUser && (
                  <p className="text-[11px] text-[#9CA3AF] mt-1">Recorded by {p.recordedByUser.name}</p>
                )}
                {reversed && p.reversal && (
                  <p className="text-[11.5px] text-[#C0392B] mt-1">"{p.reversal.reason}" · {fmtDate(p.reversal.reversedAt)}</p>
                )}
                {p.note && <p className="text-[11.5px] text-[#7A9185] mt-1 italic">"{p.note}"</p>}
              </div>
              {p.receipt && !reversed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 2 }}>
                  <Receipt size={12} color="#9CA3AF" />
                  <span className="text-[11px] text-[#9CA3AF]">{p.receipt.receiptNumber}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Analytics / Score Tab
   ════════════════════════════════════════════════════════════════════════ */
function AnalyticsTab({ memberId }: { memberId: string }) {
  const { data: ledger, isLoading } = useLedger(memberId);

  if (isLoading) return <SectionSkeleton rows={5} />;
  if (!ledger) return null;

  const total        = ledger.rows.length;
  const overdueMonths = ledger.rows.filter(r => parseFloat(r.outstanding) > 0).length;
  const paidMonths   = ledger.rows.filter(r => parseFloat(r.outstanding) <= 0 && parseFloat(r.paid) > 0).length;
  const partialMonths = ledger.rows.filter(r => parseFloat(r.paid) > 0 && parseFloat(r.outstanding) > 0).length;
  const consistency  = total > 0 ? Math.round((paidMonths / total) * 100) : 100;
  const grade        = ledger.healthGrade ?? 'EXCELLENT';
  const cfg          = SCORE_CFG[grade];

  const statRows = [
    { label: 'Total Paid Lifetime', value: inr(ledger.totalPaid),        color: '#0C6640' },
    { label: 'Total Due',           value: inr(ledger.totalOutstanding),  color: parseFloat(ledger.totalOutstanding) > 0 ? '#C0392B' : '#0C6640' },
    { label: 'Payment Consistency', value: `${consistency}%`,            color: consistency >= 80 ? '#0C6640' : consistency >= 50 ? '#A16207' : '#C0392B' },
    { label: 'Months Paid',         value: `${paidMonths} / ${total}`,   color: '#374151' },
    { label: 'Months Partial',      value: String(partialMonths),        color: partialMonths > 0 ? '#A16207' : '#9CA3AF' },
    { label: 'Months Overdue',      value: String(overdueMonths),        color: overdueMonths > 0 ? '#DC2626' : '#9CA3AF' },
  ];

  const recentRows = ledger.rows.slice(-12);

  return (
    <div className="flex flex-col gap-4">
      {/* Score gauge */}
      <div className="bg-white rounded-[20px] px-5 py-4 shadow-sm">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">Payment Score</p>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#F0F2EF" strokeWidth="8" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke={cfg.ring} strokeWidth="8"
                strokeDasharray={`${(ledger.healthScore / 100) * 175.9} 175.9`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[14px] font-extrabold" style={{ color: cfg.ring }}>{ledger.healthScore}</span>
            </div>
          </div>
          <div>
            <p className="text-[20px] font-extrabold" style={{ color: cfg.color }}>{cfg.label}</p>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">Based on payment regularity</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="bg-white rounded-[20px] overflow-hidden shadow-sm">
        {statRows.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: i === 0 ? 'none' : '1px solid #F0F2EF' }}>
            <p className="text-[13px] text-[#6B7280] font-medium">{s.label}</p>
            <p className="text-[13.5px] font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      {recentRows.length > 0 && (
        <div className="bg-white rounded-[20px] px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
            Last {recentRows.length} months
          </p>
          <div className="flex items-end gap-[5px] h-12">
            {recentRows.map(r => {
              const out  = parseFloat(r.outstanding);
              const paid = parseFloat(r.paid);
              const due  = parseFloat(r.monthlyDue);
              const isPaid    = out <= 0 && paid > 0;
              const isPartial = paid > 0 && out > 0;
              const height    = due > 0 ? Math.max(12, Math.round((paid / due) * 48)) : 8;
              return (
                <div key={r.month} className="flex flex-col items-center flex-1 gap-1">
                  <div
                    className="w-full rounded-[4px]"
                    style={{ height, background: isPaid ? '#0E7A52' : isPartial ? '#D97706' : '#FECACA' }}
                    title={`${fmtMonth(r.month)}: ${isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            {[['#0E7A52', 'Paid'], ['#D97706', 'Partial'], ['#FECACA', 'Unpaid']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                <span className="text-[10.5px] text-[#9CA3AF] font-medium">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Admin Tab
   ════════════════════════════════════════════════════════════════════════ */
function AdminTab({ memberId }: { memberId: string }) {
  const { data: member, isLoading } = useMember(memberId);
  const { data: ledger } = useLedger(memberId);
  const deactivate   = useDeactivateMember(memberId);
  const reactivate   = useReactivateMember(memberId);
  const updateMember = useUpdateMember(memberId);
  const switchPlan   = useSwitchPlan(memberId);

  const [editOpen, setEditOpen]       = useState(false);
  const [editName, setEditName]       = useState('');
  const [editPhone, setEditPhone]     = useState('');
  const [editAddr, setEditAddr]       = useState('');
  const [editOpening, setEditOpening] = useState('');
  const [saving, setSaving]           = useState(false);
  const [actionMsg, setActionMsg]     = useState<string | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data } = await apiClient.get('/committee/plans');
      return data.data as Array<{ id: string; name: string; active: boolean }>;
    },
  });

  if (isLoading || !member) return <SectionSkeleton rows={4} />;

  const openEdit = () => {
    setEditName(member.name);
    setEditPhone(member.phone);
    setEditAddr(member.address ?? '');
    setEditOpening(member.openingDueBalance);
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMember.mutateAsync({
        name: editName || undefined,
        phone: editPhone || undefined,
        address: editAddr || undefined,
        openingDueBalance: editOpening ? parseFloat(editOpening) : undefined,
      });
      setEditOpen(false);
      setActionMsg('Member updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsAppReminder = () => {
    if (!ledger) return;
    const text = buildWhatsAppText(member.name, ledger.totalOutstanding, ledger.overdueMonths);
    const phone = member.phone.replace(/\D/g, '');
    const normalized = phone.startsWith('0') ? `91${phone.slice(1)}` : phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate this member? Their history is preserved.')) return;
    await deactivate.mutateAsync();
    setActionMsg('Member deactivated.');
  };

  const handleReactivate = async () => {
    await reactivate.mutateAsync();
    setActionMsg('Member reactivated.');
  };

  const handleSwitchPlan = async (planId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    await switchPlan.mutateAsync({ planId, effectiveFrom: today });
    setActionMsg('Plan changed successfully.');
  };

  const activePlans = plansData?.filter(p => p.active) ?? [];
  const hasOutstanding = ledger && parseFloat(ledger.totalOutstanding) > 0;

  return (
    <div className="flex flex-col gap-4">
      {actionMsg && (
        <div className="flex items-center gap-3 rounded-[12px] bg-[#E8F5EF] px-4 py-3">
          <CheckCircle2 size={16} className="text-[#0E7A52] shrink-0" />
          <p className="text-[13px] font-semibold text-[#0B6644] flex-1">{actionMsg}</p>
          <button onClick={() => setActionMsg(null)}><X size={14} className="text-[#9CA3AF]" /></button>
        </div>
      )}

      {/* WhatsApp reminder */}
      {member.active && hasOutstanding && (
        <ActionButton
          icon={<MessageCircle size={16} />}
          label="Send WhatsApp Reminder"
          sublabel={`${inr(ledger!.totalOutstanding)} outstanding · ${ledger!.overdueMonths}mo overdue`}
          color="whatsapp"
          onClick={handleWhatsAppReminder}
        />
      )}

      {/* Edit form */}
      {editOpen ? (
        <div className="bg-white rounded-[20px] p-5 shadow-sm space-y-3">
          <p className="text-[13px] font-bold text-[#111827] mb-1">Edit Member</p>
          <Field label="Name"><input value={editName} onChange={e => setEditName(e.target.value)} className="w-full rounded-[10px] border border-[#E8ECE8] px-3 h-10 text-[13.5px] font-medium text-[#111827] outline-none focus:border-[#0E7A52]" /></Field>
          <Field label="Phone"><input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full rounded-[10px] border border-[#E8ECE8] px-3 h-10 text-[13.5px] font-medium text-[#111827] outline-none focus:border-[#0E7A52]" /></Field>
          <Field label="Address (optional)"><input value={editAddr} onChange={e => setEditAddr(e.target.value)} className="w-full rounded-[10px] border border-[#E8ECE8] px-3 h-10 text-[13.5px] font-medium text-[#111827] outline-none focus:border-[#0E7A52]" /></Field>
          <Field label="Previous Due (₹)">
            <input type="number" min="0" value={editOpening} onChange={e => setEditOpening(e.target.value)} className="w-full rounded-[10px] border border-[#E8ECE8] px-3 h-10 text-[13.5px] font-medium text-[#111827] outline-none focus:border-[#0E7A52]" />
            <p className="text-[11px] text-[#9CA3AF] mt-1">Historical debt migrated before using this system.</p>
          </Field>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0E7A52] text-white text-[13px] font-bold rounded-[12px] py-2.5 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2.5 rounded-[12px] border border-[#E8ECE8] text-[13px] font-semibold text-[#6B7280]">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ActionButton icon={<Pencil size={16} />} label="Edit Member Details" onClick={openEdit} />
      )}

      {/* Change plan */}
      {activePlans.length > 1 && (
        <div className="bg-white rounded-[20px] p-5 shadow-sm">
          <p className="text-[13px] font-bold text-[#111827] mb-3">Change Contribution Plan</p>
          <p className="text-[12px] text-[#9CA3AF] mb-3">Current: <strong className="text-[#374151]">{member.contributionPlan.name}</strong></p>
          <div className="space-y-2">
            {activePlans.filter(p => p.id !== member.contributionPlanId).map(p => (
              <button
                key={p.id}
                onClick={() => handleSwitchPlan(p.id)}
                disabled={switchPlan.isPending}
                className="w-full flex items-center justify-between rounded-[12px] border border-[#E8ECE8] px-4 py-3 text-[13px] font-semibold text-[#374151] hover:border-[#0E7A52] hover:text-[#0E7A52] transition-colors disabled:opacity-60"
              >
                {p.name}
                {switchPlan.isPending ? <Loader2 size={13} className="animate-spin" /> : <ChevronLeft size={13} className="rotate-180" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Waive previous due */}
      {parseFloat(member.openingDueBalance) > 0 && (
        <ActionButton
          icon={<AlertCircle size={16} />}
          label={`Waive Previous Due (${inr(member.openingDueBalance)})`}
          sublabel="Sets the migrated balance to ₹0"
          color="warning"
          onClick={async () => {
            if (!confirm('Set the previous due to ₹0? This cannot be undone.')) return;
            await updateMember.mutateAsync({ openingDueBalance: 0 });
            setActionMsg('Previous due waived.');
          }}
        />
      )}

      {/* Deactivate / Reactivate */}
      {member.active ? (
        <ActionButton
          icon={<UserX size={16} />}
          label="Deactivate Member"
          sublabel="Hides from active list. History is preserved."
          color="danger"
          onClick={handleDeactivate}
          loading={deactivate.isPending}
        />
      ) : (
        <ActionButton
          icon={<UserCheck size={16} />}
          label="Reactivate Member"
          sublabel="Restore to active status"
          color="success"
          onClick={handleReactivate}
          loading={reactivate.isPending}
        />
      )}
    </div>
  );
}

/* ── shared UI pieces ─────────────────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 20px', borderBottom: '1px solid #F0F2EF' }}>
      <span style={{ fontSize: 12.5, color: '#9CA3AF', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: '#0A1C12', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11.5px] font-semibold text-[#6B7280] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ActionButton({
  icon, label, sublabel, onClick, color = 'default', loading = false,
}: {
  icon: React.ReactNode; label: string; sublabel?: string;
  onClick: () => void; color?: 'default' | 'danger' | 'warning' | 'success' | 'whatsapp';
  loading?: boolean;
}) {
  const colorMap = {
    default:  { bg: 'bg-white',        border: 'border-[#E8ECE8]', text: 'text-[#374151]', icon: 'text-[#6B7280]' },
    danger:   { bg: 'bg-white',        border: 'border-[#FECACA]', text: 'text-[#DC2626]', icon: 'text-[#DC2626]' },
    warning:  { bg: 'bg-white',        border: 'border-[#FDE68A]', text: 'text-[#A16207]', icon: 'text-[#D97706]' },
    success:  { bg: 'bg-[#F0FBF4]',   border: 'border-[#BBF7D0]', text: 'text-[#0C6640]', icon: 'text-[#0E7A52]' },
    whatsapp: { bg: 'bg-[#F0FDF4]',   border: 'border-[#86EFAC]', text: 'text-[#166534]', icon: 'text-[#16A34A]' },
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full flex items-center gap-3 rounded-[16px] px-5 py-4 border ${colorMap.bg} ${colorMap.border} text-left transition-all hover:opacity-80 disabled:opacity-60`}
    >
      <span className={colorMap.icon}>{loading ? <Loader2 size={16} className="animate-spin" /> : icon}</span>
      <div className="flex-1">
        <p className={`text-[13.5px] font-semibold ${colorMap.text}`}>{label}</p>
        {sublabel && <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">{sublabel}</p>}
      </div>
    </button>
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="bg-white rounded-[20px] overflow-hidden shadow-sm">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderTop: i === 0 ? 'none' : '1px solid #F0F2EF' }}>
          <div className="w-28 h-3.5 rounded-lg bg-[#EEF0EB] animate-pulse" />
          <div className="w-16 h-3.5 rounded-lg bg-[#EEF0EB] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: member, isLoading, isError } = useMember(id);
  const { data: ledger } = useLedger(id);
  const [tab, setTab] = useState<Tab>('overview');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F1]">
        <div className="flex items-center gap-3 h-14 px-6">
          <Link href="/members"><ChevronLeft size={22} /></Link>
          <div className="w-32 h-4 rounded-lg bg-[#E2E8E3] animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !member) {
    return (
      <div className="min-h-screen bg-[#F4F5F1] flex flex-col items-center justify-center gap-3">
        <XCircle size={32} className="text-[#D1D5DB]" />
        <p className="text-[13.5px] font-semibold text-[#7A9185]">Member not found</p>
        <Link href="/members" className="text-[13px] font-semibold text-[#0C6640]">Go back</Link>
      </div>
    );
  }

  const outstanding = parseFloat(ledger?.totalOutstanding ?? '0');

  return (
    <div className="min-h-screen bg-[#F4F5F1]">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#F4F5F1] flex items-center gap-3 h-14 px-6">
        <Link href="/members" className="shrink-0">
          <ChevronLeft size={22} />
        </Link>
        <p className="flex-1 text-[15px] font-bold text-[#0A1C12] truncate">{member.name}</p>
        {member.active && (
          <Link
            href={`/payments?member=${id}`}
            className="rounded-[12px] bg-[#0C6640] px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_2px_8px_rgba(12,102,64,.25)] shrink-0"
          >
            Add Payment
          </Link>
        )}
      </div>

      {/* ── Hero card ──────────────────────────────────────────────── */}
      <div className="px-5 pb-2">
        <div className="bg-white rounded-[20px] shadow-sm px-5 py-4 flex items-center gap-4">
          <MemberAvatar name={member.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[17px] font-bold text-[#0A1C12] truncate">{member.name}</p>
              <span
                className="rounded-[8px] px-2 py-0.5 text-[11px] font-bold shrink-0"
                style={{ background: member.active ? '#E6F4EC' : '#F3F4F6', color: member.active ? '#0C6640' : '#6B7280' }}
              >
                {member.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-[12px] text-[#7A9185] mt-0.5">{member.memberCode} · {member.contributionPlan.name}</p>
            {outstanding > 0 ? (
              <p className="text-[12px] font-bold text-[#DC2626] mt-1 tabular-nums">
                ₹{outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} outstanding · {ledger?.overdueMonths ?? 0}mo overdue
              </p>
            ) : (
              <p className="text-[12px] font-semibold text-[#0C6640] mt-1">No outstanding dues ✓</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div className="px-5 py-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 bg-[#E2E8E3] rounded-[14px] p-1 w-max min-w-full">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-semibold transition-all shrink-0',
                tab === t.key
                  ? 'bg-white text-[#0A1C12] shadow-[0_1px_3px_rgba(10,28,18,.08)]'
                  : 'text-[#7A9185] hover:text-[#374151]',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────── */}
      <div className="px-5 pb-32 pt-1">
        {tab === 'overview'  && <OverviewTab  memberId={id} />}
        {tab === 'ledger'    && <LedgerTab    memberId={id} />}
        {tab === 'history'   && <HistoryTab   memberId={id} />}
        {tab === 'analytics' && <AnalyticsTab memberId={id} />}
        {tab === 'admin'     && <AdminTab     memberId={id} />}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
