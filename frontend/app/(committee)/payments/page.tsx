'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronRight, ChevronLeft,
  Banknote, Smartphone, CheckCircle, ArrowRightLeft,
  RotateCcw, PiggyBank, Landmark, Copy, Check,
  MessageCircle, Printer, AlertTriangle, X,
} from 'lucide-react';
import { useEnrichedMembers, useLedger, useRecordPayment } from '@/lib/hooks/useMembers';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import { useAccounts } from '@/lib/hooks/useTreasury';
import { usePaymentFeed, usePaymentKpi, useReversePayment, useTransferPayment } from '@/lib/hooks/usePayments';
import { MemberAvatar } from '@/components/ui/member-avatar';
import type { EnrichedMember, LedgerRow } from '@/lib/api/members.api';
import type { FundAccountType } from '@/lib/api/treasury.api';
import type { PaymentFeedItem, PaymentStatus } from '@/lib/api/payments.api';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function inr(n: string | number) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtMonth(iso: string) {
  if (iso === 'OLD_DUE') return 'Old Due';
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDateLabel(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diff = now.setHours(0,0,0,0) - d.setHours(0,0,0,0);
  if (diff === 0)     return 'Today';
  if (diff === 86400000) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

function groupByDate(payments: PaymentFeedItem[]): [string, PaymentFeedItem[]][] {
  const map = new Map<string, PaymentFeedItem[]>();
  for (const p of payments) {
    const label = fmtDateLabel(p.createdAt);
    const arr   = map.get(label) ?? [];
    arr.push(p);
    map.set(label, arr);
  }
  return Array.from(map.entries());
}

function getDateRange(filter: 'today' | 'week' | 'all'): { dateFrom?: string; dateTo?: string } {
  if (filter === 'all') return {};
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (filter === 'today') {
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  const weekStart = new Date(start); weekStart.setDate(weekStart.getDate() - 6);
  return { dateFrom: weekStart.toISOString() };
}

function fifoPreview(rows: LedgerRow[], amount: number, effectiveOpeningDue: number) {
  const allocations: { month: string; applied: number }[] = [];
  let rem = amount;
  // Priority 1: old due
  if (effectiveOpeningDue > 0) {
    const applied = Math.min(effectiveOpeningDue, rem);
    allocations.push({ month: 'OLD_DUE', applied });
    rem -= applied;
  }
  // Priority 2: oldest monthly dues
  for (const r of rows) {
    if (rem <= 0) break;
    const due = parseFloat(r.outstanding);
    if (due <= 0) continue;
    const applied = Math.min(due, rem);
    rem -= applied;
    allocations.push({ month: r.month, applied });
  }
  return { allocations, unallocated: rem };
}

const MODE_LABEL: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank', ONLINE: 'Online',
};
const MODE_COLOR: Record<string, string> = {
  CASH: '#0C6640', UPI: '#5B21B6', BANK_TRANSFER: '#1E40AF', ONLINE: '#C2410C',
};
const ACCOUNT_ICON: Record<FundAccountType, React.ReactNode> = {
  CASH: <PiggyBank size={15} />, BANK: <Landmark size={15} />, UPI: <Smartphone size={15} />,
};
const ACCOUNT_LABEL: Record<FundAccountType, string> = { CASH: 'Cash', BANK: 'Bank', UPI: 'UPI' };

/* ── Status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg: Record<PaymentStatus, { label: string; bg: string; color: string }> = {
    SUCCESS:  { label: 'Success',  bg: '#DCFCE7', color: '#15803D' },
    PENDING:  { label: 'Pending',  bg: '#FEF9C3', color: '#A16207' },
    FAILED:   { label: 'Failed',   bg: '#FEE2E2', color: '#DC2626' },
    REVERSED: { label: 'Reversed', bg: '#F3F4F6', color: '#6B7280' },
  };
  const s = cfg[status] ?? cfg.PENDING;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/* ── KPI strip ───────────────────────────────────────────────────────────── */
function KpiStrip() {
  const { data: kpi } = usePaymentKpi();
  const stats = [
    { label: 'Today Collected', value: kpi ? inr(kpi.todayCollected) : '—', sub: kpi ? `${kpi.todayCount} payment${kpi.todayCount === 1 ? '' : 's'}` : '', color: '#0C6640' },
    { label: 'Reversed Today',  value: kpi ? String(kpi.reversedTodayCount) : '—', sub: 'corrections', color: kpi?.reversedTodayCount ? '#DC2626' : '#7A9185' },
  ];
  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 20px 0' }}>
      {stats.map(s => (
        <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 4px rgb(10 28 18 / 0.06)' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A9185', marginBottom: 4 }}>{s.label}</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Tab navigation ──────────────────────────────────────────────────────── */
type Tab = 'collect' | 'recent' | 'corrections';

function TabNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'collect',     label: 'Collect'     },
    { key: 'recent',      label: 'Recent'      },
    { key: 'corrections', label: 'Corrections' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0', overflowX: 'auto' }}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            height: 34, borderRadius: 10, padding: '0 16px', flexShrink: 0,
            background: tab === t.key ? '#0C6640' : '#fff',
            border: tab === t.key ? 'none' : '1.5px solid #E2E8E3',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? '#fff' : '#3B5246',
            transition: 'all 0.12s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COLLECT TAB — inline multi-step payment flow
   ═══════════════════════════════════════════════════════════════════════════ */

type CollectStep = 'idle' | 'search' | 'form' | 'success';

interface ReceiptState {
  receiptNumber: string;
  unallocated:   string;
  accountName:   string;
  paymentMode:   string;
  paidDate:      string;
  amount:        number;
  memberName:    string;
  memberId:      string;
  memberPhone:   string;
  memberCode:    string;
  allocations:   { month: string; applied: number }[];
}

/* Payment form panel — requires memberId to mount hooks */
function PaymentFormPanel({
  member, onBack, onSuccess, fromMemberId,
}: {
  member: EnrichedMember;
  onBack: () => void;
  onSuccess: (receipt: ReceiptState) => void;
  fromMemberId?: string | null;
}) {
  const router                 = useRouter();
  const { data: ledger }       = useLedger(member.id);
  const { data: accountsData } = useAccounts();
  const mutation               = useRecordPayment(member.id);

  const accounts = (accountsData ?? []).filter(a => a.active);

  const [amount, setAmount]               = useState('');
  const [note, setNote]                   = useState('');
  const [fundAccountId, setFundAccountId] = useState('');
  const amountRef                         = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (accounts.length > 0 && !fundAccountId) setFundAccountId(accounts[0]!.id);
  }, [accounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const outstanding = ledger ? parseFloat(ledger.totalOutstanding) : 0;
    if (ledger && !amount && outstanding > 0) setAmount(outstanding.toFixed(0));
  }, [ledger]); // eslint-disable-line react-hooks/exhaustive-deps

  const numAmount         = parseFloat(amount) || 0;
  const outstanding       = ledger ? parseFloat(ledger.totalOutstanding) : 0;
  const effectiveOpeningDue = ledger ? parseFloat(ledger.effectiveOpeningDue) : 0;
  const monthlyDue        = parseFloat(
    ledger?.rows.find(r => parseFloat(r.outstanding) > 0)?.monthlyDue
    ?? ledger?.rows[0]?.monthlyDue ?? '0',
  );
  const fifo       = ledger ? fifoPreview(ledger.rows, numAmount, effectiveOpeningDue) : { allocations: [], unallocated: 0 };
  const lastPaidMonth = ledger?.rows.slice().reverse().find(r => parseFloat(r.paid) > 0)?.month ?? null;

  async function handleSubmit() {
    if (!numAmount || numAmount <= 0) return;
    try {
      const res = await mutation.mutateAsync({
        amount: numAmount,
        paymentDate: new Date().toISOString().slice(0, 10),
        ...(note.trim()   ? { note: note.trim() } : {}),
        ...(fundAccountId ? { fundAccountId }      : {}),
      });
      const acct = accounts.find(a => a.id === fundAccountId);
      onSuccess({
        receiptNumber: res.receipt.receiptNumber,
        unallocated:   res.unallocatedAmount,
        accountName:   res.payment.fundAccount?.name ?? acct?.name ?? 'Cash in Hand',
        paymentMode:   ACCOUNT_LABEL[(res.payment.fundAccount?.type ?? acct?.type ?? 'CASH') as FundAccountType],
        paidDate:      new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        amount:        numAmount,
        memberName:    member.name,
        memberId:      member.id,
        memberPhone:   member.phone,
        memberCode:    member.memberCode,
        allocations:   fifo.allocations,
      });
    } catch { /* shown via mutation.isError */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 20px 32px' }}>
      {/* Back */}
      <button
        onClick={fromMemberId ? () => router.push(`/members/${fromMemberId}`) : onBack}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'inherit' }}
      >
        <ChevronLeft size={18} color="#7A9185" />
        <span style={{ fontSize: 13, color: '#7A9185', fontWeight: 500 }}>
          {fromMemberId ? 'Back to member' : 'Change member'}
        </span>
      </button>

      {/* Member card */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '14px 18px', boxShadow: '0 1px 4px rgb(10 28 18 / 0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
        <MemberAvatar name={member.name} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</p>
          <p style={{ fontSize: 12, color: '#7A9185', marginTop: 2 }}>{member.memberCode} · {member.contributionPlan.name}</p>
          {ledger && (
            <p style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: outstanding > 0 ? '#C0392B' : '#0C6640' }}>
              {outstanding > 0 ? `${inr(outstanding)} outstanding` : 'All dues clear'}
              {lastPaidMonth && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · Last paid {fmtMonth(lastPaidMonth)}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Amount input */}
      <div style={{ background: '#fff', borderRadius: 18, padding: '20px 20px 18px', boxShadow: '0 1px 4px rgb(10 28 18 / 0.06)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7A9185', marginBottom: 12 }}>Amount (₹)</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: numAmount > 0 ? '#0A1C12' : '#D1D5DB' }}>₹</span>
          <input
            ref={amountRef}
            type="number" inputMode="decimal" min="1" step="1"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 36, fontWeight: 800, fontFamily: 'inherit', color: numAmount > 0 ? '#0A1C12' : '#D1D5DB', letterSpacing: '-0.03em', minWidth: 0 }}
          />
        </div>
        {/* Quick fill chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {effectiveOpeningDue > 0 && (
            <button onClick={() => setAmount(effectiveOpeningDue.toFixed(0))} style={{ height: 32, borderRadius: 10, padding: '0 12px', background: numAmount === effectiveOpeningDue ? '#0C6640' : '#FFFBEB', border: `1.5px solid ${numAmount === effectiveOpeningDue ? '#0C6640' : '#FDE68A'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: numAmount === effectiveOpeningDue ? '#fff' : '#A16207' }}>Old Due {inr(effectiveOpeningDue)}</span>
            </button>
          )}
          {outstanding > 0 && monthlyDue > 0 && monthlyDue < outstanding && (
            <button onClick={() => setAmount(monthlyDue.toFixed(0))} style={{ height: 32, borderRadius: 10, padding: '0 12px', background: numAmount === monthlyDue ? '#0C6640' : '#F0FBF4', border: `1.5px solid ${numAmount === monthlyDue ? '#0C6640' : '#A7F3D0'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: numAmount === monthlyDue ? '#fff' : '#0C6640' }}>This Month {inr(monthlyDue)}</span>
            </button>
          )}
          {outstanding > 0 && (
            <button onClick={() => setAmount(outstanding.toFixed(0))} style={{ height: 32, borderRadius: 10, padding: '0 12px', background: numAmount === outstanding ? '#0C6640' : '#FFF7ED', border: `1.5px solid ${numAmount === outstanding ? '#0C6640' : '#FED7AA'}`, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: numAmount === outstanding ? '#fff' : '#C2410C' }}>Clear All {inr(outstanding)}</span>
            </button>
          )}
          <button onClick={() => { setAmount(''); setTimeout(() => amountRef.current?.focus(), 50); }} style={{ height: 32, borderRadius: 10, padding: '0 12px', background: '#F3F4F6', border: '1.5px solid #E5E7EB', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Custom</span>
          </button>
        </div>
      </div>

      {/* FIFO preview */}
      {numAmount > 0 && fifo.allocations.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 18, padding: '14px 18px', boxShadow: '0 1px 4px rgb(10 28 18 / 0.04)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7A9185', marginBottom: 10 }}>Will clear</p>
          {fifo.allocations.map(a => (
            <div key={a.month} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: '#0A1C12' }}>{fmtMonth(a.month)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0C6640', fontVariantNumeric: 'tabular-nums' }}>{inr(a.applied)}</span>
            </div>
          ))}
          {fifo.unallocated > 0.5 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #F0F2EF', marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#7A9185', fontWeight: 500 }}>+ Advance credit</span>
              <span style={{ fontSize: 12, color: '#7A9185', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{inr(fifo.unallocated)}</span>
            </div>
          )}
        </div>
      )}

      {/* Fund account */}
      {accounts.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7A9185', marginBottom: 10 }}>Received into</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {accounts.map(acc => {
              const sel = fundAccountId === acc.id;
              return (
                <button key={acc.id} onClick={() => setFundAccountId(acc.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48, borderRadius: 14, padding: '0 16px', border: sel ? '2px solid #0E7A52' : '1.5px solid #E2E8E3', background: sel ? '#F0FBF4' : '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s' }}>
                  <span style={{ color: sel ? '#0E7A52' : '#9CA3AF' }}>{ACCOUNT_ICON[acc.type as FundAccountType]}</span>
                  <span style={{ flex: 1, fontSize: 14, color: '#0A1C12', textAlign: 'left' }}>{acc.name}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{ACCOUNT_LABEL[acc.type as FundAccountType]}</span>
                  {sel && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0E7A52' }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Note */}
      <input
        type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)"
        style={{ height: 44, borderRadius: 14, border: '1.5px solid #E2E8E3', background: '#fff', padding: '0 14px', fontSize: 14, fontFamily: 'inherit', color: '#0A1C12', outline: 'none' }}
      />

      {/* Error */}
      {mutation.isError && (
        <div style={{ background: '#FDF2F1', borderRadius: 12, padding: '12px 16px', border: '1px solid rgb(192 57 43 / 0.2)' }}>
          <p style={{ fontSize: 13, color: '#C0392B' }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Payment failed. Please try again.'}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!numAmount || mutation.isPending}
        style={{ height: 52, borderRadius: 14, border: 'none', cursor: !numAmount || mutation.isPending ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: '#fff', background: !numAmount || mutation.isPending ? '#C9D4CB' : 'linear-gradient(135deg, #0C6640 0%, #0E7A52 100%)', boxShadow: numAmount ? '0 4px 16px rgb(12 102 64 / 0.28)' : 'none', transition: 'all 0.15s' }}
      >
        {mutation.isPending ? 'Recording…' : numAmount > 0 ? `Record ${inr(numAmount)}` : 'Enter an amount'}
      </button>
    </div>
  );
}

/* Receipt success panel */
function ReceiptPanel({
  receipt, onRecordAnother,
}: {
  receipt: ReceiptState;
  onRecordAnother: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function buildText() {
    const lines = [
      `Assalamu Alaikum ${receipt.memberName},`,
      '',
      `Your payment of ${inr(receipt.amount)} has been recorded.`,
      `Receipt : ${receipt.receiptNumber}`,
      `Date    : ${receipt.paidDate}`,
      `Mode    : ${receipt.paymentMode} · ${receipt.accountName}`,
    ];
    if (receipt.allocations.length > 0) {
      lines.push('', 'Applied to:');
      receipt.allocations.forEach(a => lines.push(`  ${fmtMonth(a.month)} — ${inr(a.applied)}`));
    }
    if (parseFloat(receipt.unallocated) > 0.01) {
      lines.push(`  Advance credit: ${inr(receipt.unallocated)}`);
    }
    lines.push('', 'JazakAllah Khairan — CommitEase');
    return lines.join('\n');
  }

  function openWhatsApp() {
    const raw   = receipt.memberPhone.replace(/\D/g, '');
    const phone = raw.startsWith('91') ? raw : `91${raw}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildText())}`, '_blank', 'noopener');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* silent */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 40px', gap: 16 }}>
      {/* Success card */}
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 24px rgb(10 28 18 / 0.09)' }}>
        <div style={{ padding: '28px 24px 22px', textAlign: 'center', background: 'linear-gradient(135deg, #0C6640 0%, #0E7A52 100%)' }}>
          <CheckCircle size={40} color="white" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>{inr(receipt.amount)}</p>
          <p style={{ fontSize: 13, color: 'rgb(255 255 255 / 0.75)', marginTop: 6, fontWeight: 500 }}>Recorded for {receipt.memberName}</p>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px dashed #E2E8E3' }}>
            <div>
              <p style={{ fontSize: 10, color: '#7A9185', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Receipt</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#0A1C12', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{receipt.receiptNumber}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, color: '#7A9185', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</p>
              <p style={{ fontSize: 11, color: '#3B5246', marginTop: 4 }}>{receipt.paidDate}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
            <div><p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>Mode</p><p style={{ fontSize: 13, fontWeight: 700, color: '#0A1C12' }}>{receipt.paymentMode}</p></div>
            <div><p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>Into</p><p style={{ fontSize: 13, fontWeight: 700, color: '#0A1C12' }}>{receipt.accountName}</p></div>
          </div>
          {receipt.allocations.length > 0 && (
            <div style={{ borderTop: '1px solid #F0F2EF', paddingTop: 12 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 8 }}>Applied to</p>
              {receipt.allocations.map(a => (
                <div key={a.month} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#0A1C12' }}>{fmtMonth(a.month)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0C6640', fontVariantNumeric: 'tabular-nums' }}>{inr(a.applied)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Action row */}
        <div style={{ borderTop: '1px solid #F0F2EF', padding: '14px 24px', display: 'flex', gap: 8 }}>
          <button onClick={openWhatsApp} disabled={!receipt.memberPhone} style={{ flex: 1, height: 40, borderRadius: 12, background: '#F0FDF4', border: '1.5px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: receipt.memberPhone ? 'pointer' : 'default', opacity: receipt.memberPhone ? 1 : 0.45, fontFamily: 'inherit' }}>
            <MessageCircle size={14} color="#16A34A" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A' }}>WhatsApp</span>
          </button>
          <button onClick={() => window.print()} style={{ flex: 1, height: 40, borderRadius: 12, background: '#EFF6FF', border: '1.5px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Printer size={14} color="#2563EB" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>Print</span>
          </button>
          <button onClick={copy} style={{ flex: 1, height: 40, borderRadius: 12, background: copied ? '#F0FBF4' : '#F9FAFB', border: `1.5px solid ${copied ? '#86EFAC' : '#E5E7EB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {copied ? <Check size={14} color="#16A34A" /> : <Copy size={14} color="#6B7280" />}
            <span style={{ fontSize: 11, fontWeight: 700, color: copied ? '#16A34A' : '#6B7280' }}>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href={`/members/${receipt.memberId}`} style={{ textDecoration: 'none' }}>
          <div style={{ height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #0C6640 0%, #0E7A52 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgb(12 102 64 / 0.22)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>View member</span>
          </div>
        </Link>
        <button onClick={onRecordAnother} style={{ height: 44, borderRadius: 14, background: '#EEF0EB', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#3B5246' }}>
          Record another payment
        </button>
      </div>
    </div>
  );
}

/* Collect tab */
function CollectTab() {
  const [step, setStep]                     = useState<CollectStep>('idle');
  const [selectedMember, setSelectedMember] = useState<EnrichedMember | null>(null);
  const [receipt, setReceipt]               = useState<ReceiptState | null>(null);
  const [search, setSearch]                 = useState('');
  const [fromMemberId, setFromMemberId]     = useState<string | null>(null);
  const autoSelectedRef                     = useRef(false);
  const { data, isLoading }                 = useEnrichedMembers();

  // Read ?member= URL param once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mid = params.get('member');
    if (mid) setFromMemberId(mid);
  }, []);

  // Auto-select and jump to form when member data loads
  useEffect(() => {
    if (!fromMemberId || isLoading || !data || autoSelectedRef.current) return;
    autoSelectedRef.current = true;
    const member = data.members.find(m => m.id === fromMemberId && m.active);
    if (member) {
      setSelectedMember(member);
      setStep('form');
    }
  }, [fromMemberId, isLoading, data]);

  const needle   = search.trim().toLowerCase();
  const filtered = useMemo<EnrichedMember[]>(() => {
    if (!needle) return [];
    return (data?.members ?? []).filter(m =>
      m.active && (
        m.name.toLowerCase().includes(needle) ||
        m.memberCode.toLowerCase().includes(needle) ||
        m.phone.includes(needle)
      ),
    );
  }, [data, needle]);

  function reset() {
    setStep('idle'); setSelectedMember(null); setReceipt(null); setSearch('');
  }

  /* loading skeleton while waiting for pre-selected member data */
  if (step === 'idle' && fromMemberId && !autoSelectedRef.current && isLoading) {
    return (
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', display: 'flex', gap: 14, boxShadow: '0 1px 4px rgb(10 28 18 / 0.05)', animation: 'pulse 1.5s ease-in-out infinite' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EEF0EB', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: 140, height: 14, borderRadius: 5, background: '#EEF0EB', marginBottom: 8 }} />
              <div style={{ width: 90, height: 11, borderRadius: 4, background: '#EEF0EB' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* idle */
  if (step === 'idle') {
    const overdueMembers = (data?.members ?? [])
      .filter(m => m.active && parseFloat(m.totalOutstanding) > 0)
      .sort((a, b) => parseFloat(b.totalOutstanding) - parseFloat(a.totalOutstanding))
      .slice(0, 5);

    return (
      <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Primary CTAs */}
        <button
          onClick={() => setStep('search')}
          style={{ width: '100%', height: 64, borderRadius: 18, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(135deg, #0C6640 0%, #0E7A52 100%)', boxShadow: '0 4px 20px rgb(12 102 64 / 0.3)', display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', transition: 'all 0.15s' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Banknote size={20} color="white" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Record Cash Payment</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Cash, bank transfer, or any manual collection</p>
          </div>
          <ChevronRight size={20} color="rgba(255,255,255,0.6)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </button>

        {/* UPI QR — coming soon */}
        <div style={{ width: '100%', height: 64, borderRadius: 18, border: '1.5px solid #E2E8E3', background: '#fff', display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', opacity: 0.55 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Smartphone size={20} color="#9CA3AF" />
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#6B7280', marginBottom: 2 }}>Generate UPI QR</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>Member scans to pay online</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: '#F3F4F6', color: '#9CA3AF', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>Soon</span>
        </div>

        {/* Quick: members with dues */}
        {overdueMembers.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7A9185', marginBottom: 10 }}>Members with dues</p>
            <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 6px rgb(10 28 18 / 0.06)' }}>
              {overdueMembers.map((m, i) => (
                <button key={m.id} onClick={() => { setSelectedMember(m); setFromMemberId(null); setStep('form'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid #F0F2EF', borderRight: 'none', borderBottom: 'none', borderLeft: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <MemberAvatar name={m.name} size="sm" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{inr(m.totalOutstanding)}</span>
                  <ChevronRight size={14} color="#C9D4CB" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* search */
  if (step === 'search') {
    return (
      <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={reset} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'inherit' }}>
          <ChevronLeft size={18} color="#7A9185" />
          <span style={{ fontSize: 13, color: '#7A9185', fontWeight: 500 }}>Back</span>
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 14, border: '1.5px solid #E2E8E3', padding: '0 14px', height: 48, cursor: 'text', boxShadow: '0 1px 6px rgb(10 28 18 / 0.05)' }}>
          <Search size={16} color="#7A9185" style={{ flexShrink: 0 }} />
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Name, member code, or phone…" autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: '#0A1C12' }}
          />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>}
        </label>

        {isLoading && (
          <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgb(10 28 18 / 0.06)' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '13px 18px', borderTop: i===1?'none':'1px solid #F0F2EF' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ width: 120, height: 12, borderRadius: 4, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: 80, height: 10, borderRadius: 4, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && needle.length > 0 && filtered.length === 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#7A9185', padding: '20px 0' }}>No active members found</p>
        )}

        {!isLoading && filtered.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgb(10 28 18 / 0.07)' }}>
            {filtered.slice(0, 15).map((m, i) => (
              <button key={m.id} onClick={() => { setSelectedMember(m); setFromMemberId(null); setStep('form'); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderTop: i===0?'none':'1px solid #F0F2EF', borderRight: 'none', borderBottom: 'none', borderLeft: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <MemberAvatar name={m.name} size="md" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                  <p style={{ fontSize: 12, color: '#7A9185', marginTop: 2 }}>{m.memberCode} · {m.contributionPlan.name}</p>
                </div>
                {parseFloat(m.totalOutstanding) > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{inr(m.totalOutstanding)}</span>
                )}
                {parseFloat(m.totalOutstanding) === 0 && m.paidThisMonth && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0C6640', flexShrink: 0 }}>Paid</span>
                )}
                <ChevronRight size={14} color="#C9D4CB" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {needle.length === 0 && !isLoading && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#9CA3AF', padding: '16px 0' }}>Start typing to find a member</p>
        )}
      </div>
    );
  }

  /* form */
  if (step === 'form' && selectedMember) {
    return (
      <PaymentFormPanel
        member={selectedMember}
        onBack={() => setStep('search')}
        fromMemberId={fromMemberId}
        onSuccess={r => { setReceipt(r); setStep('success'); }}
      />
    );
  }

  /* success */
  if (step === 'success' && receipt) {
    return <ReceiptPanel receipt={receipt} onRecordAnother={reset} />;
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECENT TAB
   ═══════════════════════════════════════════════════════════════════════════ */
type DateFilter = 'today' | 'week' | 'all';
type ModeFilter = 'all' | 'CASH' | 'UPI' | 'BANK_TRANSFER';

function RecentTab() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  const { data, isLoading } = usePaymentFeed({
    ...getDateRange(dateFilter),
    ...(modeFilter !== 'all' ? { mode: modeFilter } : {}),
    limit: 50,
  });

  const groups = useMemo(() => groupByDate(data?.payments ?? []), [data]);

  return (
    <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Date filter chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['today', 'week', 'all'] as DateFilter[]).map(f => (
          <button key={f} onClick={() => setDateFilter(f)} style={{ height: 32, borderRadius: 10, padding: '0 14px', background: dateFilter === f ? '#0A1C12' : '#fff', border: dateFilter === f ? 'none' : '1.5px solid #E2E8E3', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: dateFilter === f ? 700 : 500, color: dateFilter === f ? '#fff' : '#3B5246', transition: 'all 0.1s' }}>
            {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Mode filter */}
        {(['all', 'CASH', 'UPI', 'BANK_TRANSFER'] as ModeFilter[]).map(m => (
          <button key={m} onClick={() => setModeFilter(m)} style={{ height: 32, borderRadius: 10, padding: '0 12px', background: modeFilter === m ? '#1E40AF' : '#fff', border: modeFilter === m ? 'none' : '1.5px solid #E2E8E3', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: modeFilter === m ? 700 : 500, color: modeFilter === m ? '#fff' : '#6B7280', transition: 'all 0.1s', display: m === 'BANK_TRANSFER' ? 'flex' : undefined, alignItems: 'center' }}>
            {m === 'all' ? 'All' : MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 14, boxShadow: '0 1px 4px rgb(10 28 18 / 0.05)' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: 140, height: 13, borderRadius: 4, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: 90, height: 11, borderRadius: 4, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite', marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groups */}
      {!isLoading && groups.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0A1C12' }}>No payments recorded</p>
          <p style={{ fontSize: 12, color: '#7A9185', marginTop: 6 }}>
            {dateFilter === 'today' ? 'No collections today yet' : dateFilter === 'week' ? 'No collections this week' : 'No payments in the system'}
          </p>
        </div>
      )}

      {!isLoading && groups.map(([label, payments]) => (
        <div key={label}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7A9185', marginBottom: 8 }}>{label}</p>
          <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 6px rgb(10 28 18 / 0.06)' }}>
            {payments.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 18px', borderTop: i === 0 ? 'none' : '1px solid #F0F2EF' }}>
                <MemberAvatar name={p.member.name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.member.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: p.paymentStatus === 'REVERSED' ? '#9CA3AF' : '#0A1C12', fontVariantNumeric: 'tabular-nums', textDecoration: p.paymentStatus === 'REVERSED' ? 'line-through' : 'none', flexShrink: 0 }}>{inr(p.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#7A9185' }}>{fmtTime(p.createdAt)}</span>
                    <span style={{ fontSize: 11, color: MODE_COLOR[p.paymentMode] ?? '#6B7280', fontWeight: 600 }}>{MODE_LABEL[p.paymentMode]}</span>
                    {p.receipt && <span style={{ fontSize: 10, color: '#7A9185' }}>{p.receipt.voidedAt ? '⊘' : ''} {p.receipt.receiptNumber}</span>}
                    <StatusBadge status={p.paymentStatus} />
                  </div>
                  {p.reversal && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' }}>
                      Reversed: {p.reversal.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {data && data.total > data.payments.length && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#7A9185', padding: '8px 0' }}>
          Showing {data.payments.length} of {data.total} — use filters to narrow down
        </p>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   CORRECTIONS TAB
   ═══════════════════════════════════════════════════════════════════════════ */
interface ReversalModal {
  payment: PaymentFeedItem;
  reason:  string;
}

interface TransferModal {
  payment:  PaymentFeedItem;
  search:   string;
  toMember: EnrichedMember | null;
  reason:   string;
}

function CorrectionsTab() {
  const { data, isLoading }     = usePaymentFeed({ limit: 40 });
  const { data: membersData }   = useEnrichedMembers();
  const reversal                = useReversePayment();
  const transfer                = useTransferPayment();
  const committeeRole           = useAuthStore((s) => s.user?.committeeRole);
  const canCorrect              = hasMinRole(committeeRole, 'TREASURER');
  const [modal, setModal]       = useState<ReversalModal | null>(null);
  const [xfrModal, setXfrModal] = useState<TransferModal | null>(null);

  const payments = (data?.payments ?? []).filter(p => p.paymentStatus === 'SUCCESS' || p.paymentStatus === 'REVERSED');

  const xfrNeedle   = xfrModal?.search.trim().toLowerCase() ?? '';
  const xfrFiltered = useMemo<EnrichedMember[]>(() => {
    if (!xfrNeedle) return [];
    return (membersData?.members ?? []).filter(m =>
      m.active &&
      m.id !== xfrModal?.payment.member.id &&
      (m.name.toLowerCase().includes(xfrNeedle) || m.memberCode.toLowerCase().includes(xfrNeedle) || m.phone.includes(xfrNeedle)),
    );
  }, [membersData, xfrNeedle, xfrModal?.payment.member.id]);

  async function confirmReversal() {
    if (!modal || !modal.reason.trim()) return;
    try {
      await reversal.mutateAsync({ memberId: modal.payment.member.id, paymentId: modal.payment.id, reason: modal.reason.trim() });
      setModal(null);
    } catch { /* error shown inline */ }
  }

  async function confirmTransfer() {
    if (!xfrModal || !xfrModal.toMember || !xfrModal.reason.trim()) return;
    try {
      await transfer.mutateAsync({ memberId: xfrModal.payment.member.id, paymentId: xfrModal.payment.id, toMemberId: xfrModal.toMember.id, reason: xfrModal.reason.trim() });
      setXfrModal(null);
    } catch { /* error shown inline */ }
  }

  return (
    <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Info banner */}
      <div style={{ background: '#FFF7ED', borderRadius: 14, padding: '12px 16px', border: '1px solid #FED7AA', display: 'flex', gap: 10 }}>
        <AlertTriangle size={16} color="#C2410C" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
          Reversals void the receipt and restore member dues. Transfers re-assign a payment to another member with a new receipt. Use only for incorrect entries.
        </p>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', height: 72, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!isLoading && payments.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#7A9185', paddingTop: 32 }}>No payments recorded yet.</p>
      )}

      {!isLoading && payments.map(p => (
        <div key={p.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 18px', boxShadow: '0 1px 6px rgb(10 28 18 / 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <MemberAvatar name={p.member.name} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.member.name}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: p.paymentStatus === 'REVERSED' ? '#9CA3AF' : '#0A1C12', textDecoration: p.paymentStatus === 'REVERSED' ? 'line-through' : 'none', fontVariantNumeric: 'tabular-nums' }}>{inr(p.amount)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#7A9185' }}>{fmtTime(p.createdAt)}</span>
                <span style={{ fontSize: 11, color: MODE_COLOR[p.paymentMode] ?? '#6B7280', fontWeight: 600 }}>{MODE_LABEL[p.paymentMode]}</span>
                {p.receipt && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{p.receipt.receiptNumber}</span>}
                <StatusBadge status={p.paymentStatus} />
              </div>
              {p.allocations.length > 0 && (
                <p style={{ fontSize: 11, color: '#7A9185', marginTop: 4 }}>
                  {p.allocations.map(a => `${fmtMonth(a.contributionMonth)} ₹${parseFloat(a.amountAllocated).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`).join(', ')}
                </p>
              )}
              {p.reversal && (
                <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <RotateCcw size={10} color="#9CA3AF" />
                  Reversed: {p.reversal.reason}
                </p>
              )}
            </div>
          </div>
          {p.paymentStatus === 'SUCCESS' && canCorrect && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={() => setXfrModal({ payment: p, search: '', toMember: null, reason: '' })}
                style={{ flex: 1, height: 36, borderRadius: 10, border: '1.5px solid #BFDBFE', background: '#EFF6FF', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <ArrowRightLeft size={12} color="#2563EB" />
                Transfer
              </button>
              <button
                onClick={() => setModal({ payment: p, reason: '' })}
                style={{ flex: 1, height: 36, borderRadius: 10, border: '1.5px solid #FECACA', background: '#FEF2F2', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <RotateCcw size={12} color="#DC2626" />
                Reverse
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Reversal modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => !reversal.isPending && setModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', zIndex: 201 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0A1C12' }}>Reverse Payment</p>
                <p style={{ fontSize: 13, color: '#7A9185', marginTop: 4 }}>
                  {inr(modal.payment.amount)} from {modal.payment.member.name}
                  {modal.payment.receipt ? ` · ${modal.payment.receipt.receiptNumber}` : ''}
                </p>
              </div>
              <button onClick={() => setModal(null)} disabled={reversal.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A9185', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '12px 16px', border: '1px solid #FECACA', marginBottom: 20, display: 'flex', gap: 10 }}>
              <AlertTriangle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.6 }}>
                This will void receipt {modal.payment.receipt?.receiptNumber ?? ''} and restore {modal.payment.member.name}{"'"}s outstanding dues. This action cannot be undone.
              </p>
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#0A1C12', marginBottom: 8 }}>Reason for reversal *</p>
            <textarea
              value={modal.reason}
              onChange={e => setModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
              placeholder="e.g. Duplicate entry, wrong amount recorded…"
              rows={3}
              style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E2E8E3', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', color: '#0A1C12', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            {reversal.isError && (
              <p style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>
                {(reversal.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Reversal failed.'}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(null)} disabled={reversal.isPending} style={{ flex: 1, height: 48, borderRadius: 14, border: '1.5px solid #E2E8E3', background: '#F9FAFB', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#6B7280' }}>Cancel</button>
              <button onClick={confirmReversal} disabled={!modal.reason.trim() || reversal.isPending} style={{ flex: 2, height: 48, borderRadius: 14, border: 'none', background: !modal.reason.trim() || reversal.isPending ? '#FCA5A5' : '#DC2626', cursor: !modal.reason.trim() || reversal.isPending ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff', transition: 'all 0.15s' }}>
                {reversal.isPending ? 'Reversing…' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {xfrModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => !transfer.isPending && setXfrModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 24px 40px', zIndex: 201, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0A1C12' }}>Transfer Payment</p>
                <p style={{ fontSize: 13, color: '#7A9185', marginTop: 4 }}>
                  {inr(xfrModal.payment.amount)} from {xfrModal.payment.member.name}
                  {xfrModal.payment.receipt ? ` · ${xfrModal.payment.receipt.receiptNumber}` : ''}
                </p>
              </div>
              <button onClick={() => setXfrModal(null)} disabled={transfer.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A9185', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {!xfrModal.toMember ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0A1C12', marginBottom: 8 }}>Transfer to *</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F9FAFB', borderRadius: 12, border: '1.5px solid #E2E8E3', padding: '0 12px', height: 44, cursor: 'text', marginBottom: 8 }}>
                  <Search size={14} color="#7A9185" style={{ flexShrink: 0 }} />
                  <input
                    type="search"
                    value={xfrModal.search}
                    onChange={e => setXfrModal(prev => prev ? { ...prev, search: e.target.value } : null)}
                    placeholder="Name, code, or phone…"
                    autoFocus
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', color: '#0A1C12' }}
                  />
                </label>
                {xfrNeedle.length === 0 && <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>Type to search members</p>}
                {xfrNeedle.length > 0 && xfrFiltered.length === 0 && <p style={{ fontSize: 13, color: '#7A9185', textAlign: 'center', padding: '12px 0' }}>No active members found</p>}
                <div>
                  {xfrFiltered.slice(0, 8).map((m, i) => (
                    <button
                      key={m.id}
                      onClick={() => setXfrModal(prev => prev ? { ...prev, toMember: m, search: '' } : null)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #F0F2EF', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                      <MemberAvatar name={m.name} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: '#7A9185', marginTop: 1 }}>{m.memberCode}</p>
                      </div>
                      {parseFloat(m.totalOutstanding) > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#C0392B', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{inr(m.totalOutstanding)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#EFF6FF', borderRadius: 12, padding: '10px 14px', marginBottom: 16, border: '1px solid #BFDBFE' }}>
                  <MemberAvatar name={xfrModal.toMember.name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{xfrModal.toMember.name}</p>
                    <p style={{ fontSize: 11, color: '#7A9185', marginTop: 1 }}>{xfrModal.toMember.memberCode}</p>
                  </div>
                  <button onClick={() => setXfrModal(prev => prev ? { ...prev, toMember: null, search: '' } : null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#2563EB', padding: 0, flexShrink: 0, fontFamily: 'inherit' }}>Change</button>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#0A1C12', marginBottom: 8 }}>Reason *</p>
                <textarea
                  value={xfrModal.reason}
                  onChange={e => setXfrModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                  placeholder="e.g. Payment recorded under wrong member…"
                  rows={3}
                  style={{ width: '100%', borderRadius: 12, border: '1.5px solid #E2E8E3', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', color: '#0A1C12', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                />
                {transfer.isError && (
                  <p style={{ fontSize: 12, color: '#DC2626', marginTop: 8 }}>
                    {(transfer.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Transfer failed.'}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setXfrModal(null)} disabled={transfer.isPending} style={{ flex: 1, height: 48, borderRadius: 14, border: '1.5px solid #E2E8E3', background: '#F9FAFB', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#6B7280' }}>Cancel</button>
                  <button onClick={confirmTransfer} disabled={!xfrModal.reason.trim() || transfer.isPending} style={{ flex: 2, height: 48, borderRadius: 14, border: 'none', background: !xfrModal.reason.trim() || transfer.isPending ? '#93C5FD' : '#2563EB', cursor: !xfrModal.reason.trim() || transfer.isPending ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff', transition: 'all 0.15s' }}>
                    {transfer.isPending ? 'Transferring…' : 'Confirm Transfer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('collect');

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F1', paddingBottom: 80 }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: '#F4F5F1', paddingBottom: 14 }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 20px' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#0A1C12', letterSpacing: '-0.03em' }}>Payments</p>
        </div>
        <KpiStrip />
        <TabNav tab={tab} setTab={t => setTab(t)} />
      </div>

      {/* Tab content */}
      {tab === 'collect'     && <CollectTab />}
      {tab === 'recent'      && <RecentTab />}
      {tab === 'corrections' && <CorrectionsTab />}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @media print { .no-print { display:none!important } }`}</style>
    </div>
  );
}
