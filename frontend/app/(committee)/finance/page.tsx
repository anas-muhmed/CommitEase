'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Plus, PiggyBank, Landmark, Smartphone, Shield, Lock,
  ArrowDownLeft, ArrowUpRight, UserCheck, SlidersHorizontal, RefreshCw, Undo2,
  AlertCircle, CheckCircle2, Loader2, Clock, Receipt, Zap, X, Wallet,
  ChevronRight, MoreVertical, Pencil, ArrowLeftRight, Archive, Trash2,
  SlidersVertical, Eye, EyeOff,
} from 'lucide-react';
import {
  useTreasury, useAccounts, useReserves, useTreasuryLedger,
  useCreateAccount, useUpdateAccount, useSetOpeningBalance,
  useCreateReserve, useUpdateReserve, useTransferFunds, useDeleteAccount,
  useVerifyIntegrity,
} from '@/lib/hooks/useTreasury';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import type { IntegrityResult } from '@/lib/api/treasury.api';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { useExpenses, useCreateExpense, useReimburseExpense, useTeam } from '@/lib/hooks/useExpenses';
import type { FundAccountType, TreasuryLedgerEntry, LedgerEntryType, FundAccount } from '@/lib/api/treasury.api';
import type { TreasurySnapshot } from '@/lib/api/dashboard.api';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/api/expense.api';
import type { ExpenseType, Expense } from '@/lib/api/expense.api';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function inr(n: string | number, compact = false) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (compact && v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (compact && v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function timeAgo(d: string) {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  return days === 1 ? '1d ago' : `${days}d ago`;
}
function apiMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Something went wrong.';
}

/* ── SVG decorations ─────────────────────────────────────────────────────── */
function IslamicPatternFine() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.055 }} aria-hidden="true">
      <defs>
        <pattern id="fp-geo" x="0" y="0" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M22,2 L42,22 L22,42 L2,22 Z" fill="none" stroke="white" strokeWidth="0.45"/>
          <path d="M22,11 L33,22 L22,33 L11,22 Z" fill="none" stroke="white" strokeWidth="0.28"/>
          <circle cx="22" cy="2"  r="0.8" fill="white" opacity="0.7"/>
          <circle cx="42" cy="22" r="0.8" fill="white" opacity="0.7"/>
          <circle cx="22" cy="42" r="0.8" fill="white" opacity="0.7"/>
          <circle cx="2"  cy="22" r="0.8" fill="white" opacity="0.7"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#fp-geo)"/>
    </svg>
  );
}

function GoldArcPremium() {
  return (
    <svg className="absolute right-0 top-0 h-full pointer-events-none" style={{ width: '44%' }}
      viewBox="0 0 640 220" preserveAspectRatio="xMaxYMid meet" fill="none" aria-hidden="true">
      <defs>
        <filter id="fp-bloom-xl" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="26" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="fp-glow-core" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9"/>
        </filter>
        <filter id="fp-node-bloom" x="-250%" y="-250%" width="600%" height="600%">
          <feGaussianBlur stdDeviation="16"/>
        </filter>
      </defs>
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="100" opacity="0.015"/>
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="45"  opacity="0.035"/>
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="22"  opacity="0.12" filter="url(#fp-bloom-xl)"/>
      <circle cx="120" cy="500" r="452" stroke="#EBC34A" strokeWidth="2.8" opacity="0.92"/>
      <circle cx="120" cy="500" r="372" stroke="#D4AF37" strokeWidth="1.1" opacity="0.30"/>
      <circle cx="120" cy="500" r="294" stroke="#D4AF37" strokeWidth="0.6" opacity="0.17"/>
      <circle cx="120" cy="48"  r="42"  fill="#D4AF37"  opacity="0.18" filter="url(#fp-node-bloom)"/>
      <circle cx="120" cy="48"  r="14"  fill="#EBC34A"  opacity="0.75" filter="url(#fp-glow-core)"/>
      <circle cx="120" cy="48"  r="10"  stroke="#EFD050" strokeWidth="1.8" fill="none" opacity="0.70"/>
      <circle cx="120" cy="48"  r="4.5" fill="white" opacity="1"/>
    </svg>
  );
}

function MosqueArchFine() {
  return (
    <svg className="absolute right-0 top-0 h-full pointer-events-none" style={{ width: '28%', opacity: 0.075 }}
      viewBox="0 0 320 220" preserveAspectRatio="xMaxYMax meet" fill="none" aria-hidden="true">
      <path d="M 42,220 L 42,102 Q 42,18 160,10 Q 278,18 278,102 L 278,220"  stroke="white" strokeWidth="0.9"/>
      <path d="M 68,220 L 68,114 Q 68,32 160,24 Q 252,32 252,114 L 252,220"  stroke="white" strokeWidth="0.7"/>
      <path d="M 92,220 L 92,126 Q 92,48 160,40 Q 228,48 228,126 L 228,220"  stroke="white" strokeWidth="0.5"/>
      <line x1="42"  y1="200" x2="278" y2="200" stroke="white" strokeWidth="0.45"/>
      <line x1="56"  y1="210" x2="264" y2="210" stroke="white" strokeWidth="0.35"/>
      <path d="M 160,8 L 170,18 L 160,28 L 150,18 Z" fill="white" opacity="0.9"/>
    </svg>
  );
}

/* ── constants ───────────────────────────────────────────────────────────── */
const HERO_GRADIENT = 'linear-gradient(150deg, #052E1E 0%, #073D28 28%, #0B5538 62%, #0E7A52 100%)';
const INPUT_CLS     = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[13.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#0E7A52] focus:ring-1 focus:ring-[#0E7A52]/20';

type Tab = 'overview' | 'sources' | 'expenses' | 'ledger' | 'reserves';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'Overview'      },
  { id: 'sources',   label: 'Money Sources' },
  { id: 'expenses',  label: 'Expenses'      },
  { id: 'ledger',    label: 'Ledger'        },
  { id: 'reserves',  label: 'Reserves'      },
];

/* ════════════════════════════════════════════════════════════════════════════
   Finance Hub — /finance
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FinancePage() {
  const { data: treasury, isLoading } = useTreasury();
  const { data: dashData }            = useDashboard();
  const [tab, setTab]                 = useState<Tab>('overview');

  const hasAccounts = treasury?.hasAccounts ?? false;
  const pendingDues = dashData?.totalOutstandingAllMembers ?? '0';

  return (
    <div className="min-h-screen bg-[#F6F7F3]">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 h-[64px] flex items-center gap-3">
          <Link href="/dashboard"
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-gray-50 transition-colors">
            <ChevronLeft size={18} strokeWidth={2.2} className="text-[#374151]"/>
          </Link>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#111827] tracking-[-0.02em] leading-none">Finance</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Treasury · Money Sources · Reserves</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 pb-32">
        <div className="pt-5 pb-4">
          {isLoading ? (
            <HeroSkeleton/>
          ) : hasAccounts ? (
            <TreasuryHero treasury={treasury!} pendingDues={pendingDues}/>
          ) : (
            <EmptyHero onAddSource={() => setTab('sources')}/>
          )}
        </div>

        <SegmentedTabs active={tab} onChange={setTab}/>

        <div className="mt-4 space-y-4">
          {tab === 'overview'  && <OverviewTab treasury={treasury ?? null} hasAccounts={hasAccounts} onGoToSources={() => setTab('sources')}/>}
          {tab === 'sources'   && <MoneySourcesTab/>}
          {tab === 'expenses'  && <ExpensesTab/>}
          {tab === 'ledger'    && <LedgerTab/>}
          {tab === 'reserves'  && <ReservesTab treasury={treasury ?? null}/>}
        </div>
      </main>
    </div>
  );
}

/* ─── Hero: has money sources ────────────────────────────────────────────── */
function TreasuryHero({ treasury, pendingDues }: { treasury: TreasurySnapshot; pendingDues: string }) {
  const cashTotal = treasury.accounts.filter(a => a.type === 'CASH').reduce((s, a) => s + parseFloat(a.balance), 0);
  const bankTotal = treasury.accounts.filter(a => a.type === 'BANK').reduce((s, a) => s + parseFloat(a.balance), 0);
  const upiTotal  = treasury.accounts.filter(a => a.type === 'UPI' ).reduce((s, a) => s + parseFloat(a.balance), 0);
  const hasReimb  = treasury.pendingReimbursements !== '0.00';
  const hasDues   = parseFloat(pendingDues) > 0;

  return (
    <div className="relative rounded-[28px] overflow-hidden" style={{ background: HERO_GRADIENT }}>
      <IslamicPatternFine/>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 110% at -5% 50%, rgba(212,175,55,0.09), transparent 65%)' }}/>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 100% at 105% 50%, rgba(5,46,30,0.50), transparent 60%)' }}/>
      <GoldArcPremium/>
      <MosqueArchFine/>

      <div className="relative z-10 px-10 py-9 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[9.5px] font-semibold tracking-[0.28em] uppercase text-white/40">Current Balance</p>
          <p className="text-[54px] font-extrabold text-white tracking-[-0.045em] tabular-nums leading-none mt-1">
            {inr(treasury.totalBalance)}
          </p>

          <div className="flex gap-2 mt-5 flex-wrap">
            {cashTotal > 0 && (
              <BalancePill icon={<PiggyBank size={14}/>} label="Cash" amount={inr(cashTotal, true)}/>
            )}
            {bankTotal > 0 && (
              <BalancePill icon={<Landmark  size={14}/>} label="Bank" amount={inr(bankTotal, true)}/>
            )}
            {upiTotal  > 0 && (
              <BalancePill icon={<Smartphone size={14}/>} label="UPI" amount={inr(upiTotal, true)}/>
            )}
          </div>

          {(hasDues || hasReimb) && (
            <div className="flex gap-3 mt-3 flex-wrap">
              {hasDues && (
                <div className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5"
                  style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-[10px] font-medium text-white/45">Pending Dues</span>
                  <span className="text-[13px] font-bold text-white tabular-nums">{inr(pendingDues, true)}</span>
                </div>
              )}
              {hasReimb && (
                <div className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5"
                  style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Clock size={10} className="text-orange-300"/>
                  <span className="text-[10px] font-medium text-white/45">Pending Reimb.</span>
                  <span className="text-[13px] font-bold text-orange-300 tabular-nums">
                    {inr(treasury.pendingReimbursements, true)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:block shrink-0 text-right pl-6 pt-1">
          <p className="text-[9px] font-semibold tracking-[0.22em] uppercase text-white/35">Net Usable</p>
          <p className="text-[34px] font-extrabold text-white tabular-nums mt-1 leading-none">
            {inr(treasury.netUsable)}
          </p>
          <p className="text-[11.5px] text-white/40 mt-1.5">After reserves & pending</p>
        </div>
      </div>
    </div>
  );
}

function BalancePill({ icon, label, amount }: { icon: React.ReactNode; label: string; amount: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] px-4 py-3"
      style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <span className="text-white/60">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold text-white/45 leading-none tracking-wide">{label}</p>
        <p className="text-[15px] font-bold text-white tabular-nums mt-1">{amount}</p>
      </div>
    </div>
  );
}

/* ─── Hero: no sources ───────────────────────────────────────────────────── */
function EmptyHero({ onAddSource }: { onAddSource: () => void }) {
  return (
    <div className="relative rounded-[28px] overflow-hidden" style={{ background: HERO_GRADIENT, minHeight: '168px' }}>
      <IslamicPatternFine/>
      <GoldArcPremium/>
      <div className="relative z-10 px-10 py-9">
        <p className="text-[9.5px] font-semibold tracking-[0.28em] uppercase text-white/40">Treasury</p>
        <p className="text-[28px] font-extrabold text-white tracking-tight mt-1">Set up your treasury</p>
        <p className="text-[13px] text-white/50 mt-1.5 max-w-sm">
          Track every rupee — cash, bank and UPI — in one place.
        </p>
        <button onClick={onAddSource}
          className="mt-5 inline-flex items-center gap-2 bg-[#0E7A52] text-white rounded-[14px] px-5 py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] transition-colors">
          <Plus size={14} strokeWidth={2.5}/>Add First Money Source
        </button>
      </div>
    </div>
  );
}

/* ─── Segmented Tabs ─────────────────────────────────────────────────────── */
function SegmentedTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="bg-white rounded-[16px] shadow-[0_2px_12px_rgba(15,23,42,0.05)] p-1 flex gap-0.5 overflow-x-auto">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={[
            'flex-1 min-w-max rounded-[12px] px-4 py-2.5 text-[12.5px] font-semibold transition-all duration-150 whitespace-nowrap',
            active === t.id
              ? 'bg-[#0E7A52] text-white shadow-[0_2px_8px_rgba(14,122,82,0.28)]'
              : 'text-[#6B7280] hover:text-[#374151] hover:bg-gray-50',
          ].join(' ')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Overview Tab ───────────────────────────────────────────────────────── */
function IntegrityCard() {
  const verify        = useVerifyIntegrity();
  const committeeRole = useAuthStore((s) => s.user?.committeeRole);
  const canVerify     = hasMinRole(committeeRole, 'TREASURER');
  const result        = verify.data as IntegrityResult | undefined;

  if (!canVerify) return null;

  return (
    <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.06)] px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[13px] font-bold text-[#111827]">Ledger Integrity</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Verify account balances match ledger history</p>
        </div>
        <button
          onClick={() => verify.mutate()}
          disabled={verify.isPending}
          className="h-8 px-4 rounded-[10px] text-[12px] font-bold transition-colors"
          style={{
            background: verify.isPending ? '#E8F5EF' : '#0E7A52',
            color: verify.isPending ? '#0E7A52' : '#fff',
            border: 'none', cursor: verify.isPending ? 'default' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {verify.isPending ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      {result && (
        <div>
          <div className={`flex items-center gap-2 rounded-[12px] px-4 py-3 mb-3 ${result.ok ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]'}`}>
            <span style={{ fontSize: 16 }}>{result.ok ? '✓' : '⚠'}</span>
            <p className={`text-[13px] font-bold ${result.ok ? 'text-[#15803D]' : 'text-[#DC2626]'}`}>
              {result.ok ? 'All accounts balanced' : `${result.accounts.filter(a => !a.ok).length} account(s) have drift`}
            </p>
          </div>
          {!result.ok && result.accounts.filter(a => !a.ok).map(a => (
            <div key={a.accountId} className="flex justify-between items-center text-[12px] py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-[#374151] font-medium">{a.name}</span>
              <span className="text-[#DC2626] font-bold tabular-nums">drift ₹{a.drift}</span>
            </div>
          ))}
          <p className="text-[10px] text-[#9CA3AF] mt-2">
            Checked {new Date(result.checkedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        </div>
      )}

      {verify.isError && (
        <p className="text-[12px] text-[#DC2626] mt-2">Check failed. Ensure you have treasurer access.</p>
      )}
    </div>
  );
}

function OverviewTab({
  treasury, hasAccounts, onGoToSources,
}: {
  treasury: TreasurySnapshot | null;
  hasAccounts: boolean;
  onGoToSources: () => void;
}) {
  if (!hasAccounts) return <SetupWizard/>;

  return (
    <div className="space-y-3">
      {treasury && (
        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.06)] px-6 py-5">
          <p className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[#9CA3AF] mb-4">Net Usable Calculation</p>
          <div className="space-y-2.5 text-[14px]">
            <div className="flex justify-between items-center">
              <span className="text-[#374151]">Total Balance</span>
              <span className="font-bold text-[#111827] tabular-nums">{inr(treasury.totalBalance)}</span>
            </div>
            {treasury.pendingReimbursements !== '0.00' && (
              <div className="flex justify-between items-center text-orange-600">
                <span className="flex items-center gap-1.5"><Clock size={13}/>Pending Reimbursements</span>
                <span className="font-bold tabular-nums">−{inr(treasury.pendingReimbursements)}</span>
              </div>
            )}
            {treasury.totalReserved !== '0.00' && (
              <div className="flex justify-between items-center text-[#C49A0B]">
                <span className="flex items-center gap-1.5"><Lock size={13}/>Reserved Funds</span>
                <span className="font-bold tabular-nums">−{inr(treasury.totalReserved)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <span className="text-[15px] font-bold text-[#0E7A52]">Net Usable</span>
              <span className="text-[18px] font-extrabold text-[#0E7A52] tabular-nums">{inr(treasury.netUsable)}</span>
            </div>
          </div>
        </div>
      )}

      {treasury && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { value: treasury.accounts.length, label: 'Money Sources' },
            { value: treasury.reserves.length, label: 'Reserves'      },
            {
              value: inr(treasury.netUsable, true),
              label: 'Available',
              color: parseFloat(treasury.netUsable) >= 0 ? '#0E7A52' : '#DC2626',
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-[18px] shadow-[0_4px_18px_rgba(15,23,42,0.05)] px-4 py-4 text-center">
              <p className="text-[22px] font-extrabold tabular-nums"
                style={{ color: s.color ?? '#111827' }}>
                {s.value}
              </p>
              <p className="text-[11px] font-semibold text-[#9CA3AF] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={onGoToSources}
        className="w-full flex items-center justify-between bg-white rounded-[18px] shadow-[0_4px_18px_rgba(15,23,42,0.05)] px-5 py-4 hover:shadow-[0_6px_24px_rgba(15,23,42,0.09)] transition-shadow group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-[#E8F5EF] flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-[#0E7A52]"/>
          </div>
          <div className="text-left">
            <p className="text-[14px] font-bold text-[#111827]">Money Sources</p>
            <p className="text-[12px] text-[#9CA3AF]">Manage your cash, bank and UPI sources</p>
          </div>
        </div>
        <ChevronRight size={16} className="text-[#D1D5DB] group-hover:text-[#9CA3AF] transition-colors"/>
      </button>

      <IntegrityCard/>
    </div>
  );
}

/* ─── First-time Setup Wizard ────────────────────────────────────────────── */
type SetupStep = 1 | 2 | 3;
const SETUP_STEPS: {
  num: SetupStep; type: FundAccountType; label: string;
  desc: string; required: boolean; defaultName: string;
}[] = [
  { num: 1, type: 'CASH', label: 'Cash in Hand', desc: 'Physical cash — collection box or petty cash', required: true,  defaultName: 'Cash in Hand' },
  { num: 2, type: 'BANK', label: 'Bank Account', desc: 'Primary bank account for the masjid',          required: true,  defaultName: 'Main Bank'    },
  { num: 3, type: 'UPI',  label: 'UPI Wallet',   desc: 'PhonePe, GPay or any UPI wallet (optional)',   required: false, defaultName: 'UPI Wallet'   },
];

function SetupWizard() {
  const [step, setStep]     = useState<SetupStep>(1);
  const [done, setDone]     = useState<SetupStep[]>([]);
  const [name, setName]     = useState('');
  const [amount, setAmount] = useState('');
  const [err, setErr]       = useState('');
  const createAccount = useCreateAccount();
  const setOpening    = useSetOpeningBalance();
  const isPending     = createAccount.isPending || setOpening.isPending;
  const current       = SETUP_STEPS[step - 1]!;

  function advance() {
    setDone(d => [...d, step]);
    setName(''); setAmount(''); setErr('');
    if (step < 3) setStep(s => (s + 1) as SetupStep);
  }

  function handleSave() {
    const n = name.trim() || current.defaultName;
    const a = parseFloat(amount);
    if (!Number.isFinite(a) || a < 0) { setErr('Enter a valid opening balance (0 is fine).'); return; }
    setErr('');
    createAccount.mutate({ name: n, type: current.type }, {
      onSuccess: (acct) => {
        if (a > 0) {
          setOpening.mutate({ id: acct.id, amount: a }, {
            onSuccess: advance,
            onError: (e) => setErr(apiMsg(e)),
          });
        } else {
          advance();
        }
      },
      onError: (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <div className="bg-white rounded-[24px] shadow-[0_4px_20px_rgba(15,23,42,0.07)] overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50">
        <h2 className="text-[15.5px] font-bold text-[#111827]">Treasury Setup</h2>
        <p className="text-[12.5px] text-[#9CA3AF] mt-0.5">Add your money sources to start tracking</p>
      </div>
      <div className="p-5 space-y-2.5">
        {SETUP_STEPS.map((s) => {
          const isDone   = done.includes(s.num);
          const isActive = step === s.num && !isDone;
          const isLocked = s.num > step && !isDone;
          return (
            <div key={s.num} className={[
              'rounded-[18px] border transition-all',
              isDone   ? 'bg-[#F0FBF6] border-[#C5E8D6]'                                              : '',
              isActive ? 'bg-white border-[#0E7A52]/25 shadow-[0_0_0_3px_rgba(14,122,82,0.07)]'      : '',
              isLocked ? 'bg-gray-50/70 border-gray-100 opacity-50'                                    : '',
            ].join(' ')}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                  isDone || isActive ? 'bg-[#0E7A52] text-white' : 'bg-gray-200 text-gray-400',
                ].join(' ')}>
                  {isDone ? <CheckCircle2 size={14}/> : s.num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13.5px] font-bold leading-none ${isDone ? 'text-[#0E7A52]' : isLocked ? 'text-[#9CA3AF]' : 'text-[#111827]'}`}>
                    {s.label}
                    {!s.required && (
                      <span className="ml-2 text-[10px] font-semibold text-[#9CA3AF] bg-gray-100 rounded-md px-1.5 py-0.5 align-middle">
                        Optional
                      </span>
                    )}
                  </p>
                  <p className={`text-[11.5px] mt-0.5 ${isDone ? 'text-[#0E7A52]/55' : 'text-[#9CA3AF]'}`}>{s.desc}</p>
                </div>
                {isDone && <CheckCircle2 size={16} className="text-[#0E7A52] shrink-0"/>}
              </div>

              {isActive && (
                <div className="px-4 pb-4 space-y-2">
                  <div className="h-px bg-gray-100 mb-3"/>
                  <input type="text"
                    placeholder={`Name (default: ${s.defaultName})`}
                    value={name} onChange={e => setName(e.target.value)}
                    className={INPUT_CLS}/>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6B7280]">₹</span>
                    <input type="number" min="0" step="0.01" placeholder="Initial migration balance (0 if unknown)"
                      value={amount} onChange={e => setAmount(e.target.value)}
                      className={`${INPUT_CLS} pl-9`}/>
                  </div>
                  {err && (
                    <p className="flex items-center gap-1.5 text-[12px] text-red-500">
                      <AlertCircle size={11}/>{err}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSave} disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#0E7A52] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] disabled:opacity-60 transition-colors">
                      {isPending ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
                      Save & Continue
                    </button>
                    {!s.required && (
                      <button onClick={advance}
                        className="px-5 text-[13px] font-semibold text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
                        Skip
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Money Sources Tab ──────────────────────────────────────────────────── */
function MoneySourcesTab() {
  const { data: accounts, isLoading } = useAccounts();
  const [showModal,    setShowModal]    = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  if (isLoading) return <SectionSkeleton rows={2}/>;

  const active   = (accounts ?? []).filter(a =>  a.active);
  const archived = (accounts ?? []).filter(a => !a.active);
  const visible  = showArchived ? [...active, ...archived] : active;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15.5px] font-bold text-[#111827]">Money Sources</h2>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Cash, bank and UPI balances</p>
        </div>
        <div className="flex items-center gap-2">
          {archived.length > 0 && (
            <button onClick={() => setShowArchived(v => !v)}
              className={[
                'flex items-center gap-1.5 text-[12px] font-semibold rounded-xl px-3 py-2 transition-colors',
                showArchived
                  ? 'bg-[#111827] text-white'
                  : 'text-[#6B7280] bg-gray-100 hover:bg-gray-200',
              ].join(' ')}>
              {showArchived ? <EyeOff size={13}/> : <Eye size={13}/>}
              {showArchived ? 'Hide Archived' : `Archived (${archived.length})`}
            </button>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-[#0E7A52] rounded-xl px-3.5 py-2 hover:bg-[#0B5D3D] transition-colors">
            <Plus size={13} strokeWidth={2.5}/>Add Money Source
          </button>
        </div>
      </div>

      {!visible.length ? (
        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.06)] py-12 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-[#E8F5EF] flex items-center justify-center mx-auto mb-3">
            <Wallet size={20} className="text-[#0E7A52]"/>
          </div>
          <p className="text-[14px] font-bold text-[#111827]">No money sources yet</p>
          <p className="text-[12.5px] text-[#9CA3AF] mt-1 max-w-xs mx-auto">
            Add your cash, bank accounts and UPI wallets to start tracking the treasury.
          </p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-1.5 bg-[#0E7A52] text-white rounded-xl px-4 py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] transition-colors">
            <Plus size={13} strokeWidth={2.5}/>Add First Money Source
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((account) => (
            <MoneySourceCard key={account.id} account={account}/>
          ))}
        </div>
      )}

      {showModal && <AddMoneySourceModal onClose={() => setShowModal(false)}/>}
    </div>
  );
}

/* ─── Add Money Source Modal ─────────────────────────────────────────────── */
function AddMoneySourceModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<FundAccountType | null>(null);

  const TYPE_OPTIONS = [
    { type: 'CASH' as FundAccountType, icon: <PiggyBank size={22}/>,  label: 'Cash', desc: 'Physical cash on hand',       color: '#0E7A52', bg: '#E8F5EF' },
    { type: 'BANK' as FundAccountType, icon: <Landmark  size={22}/>,  label: 'Bank', desc: 'Bank or savings account',      color: '#0B5D3D', bg: '#E8F0EF' },
    { type: 'UPI'  as FundAccountType, icon: <Smartphone size={22}/>, label: 'UPI',  desc: 'PhonePe, GPay or any wallet',  color: '#7C3AED', bg: '#F3EEFF' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-[460px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#111827]">
              {step === 1 ? 'Choose Source Type' : 'Add Money Source'}
            </h2>
            {step === 2 && type && (
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                {type === 'CASH' ? 'Cash source' : type === 'BANK' ? 'Bank account' : 'UPI wallet'}
              </p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={14} strokeWidth={2.5} className="text-[#374151]"/>
          </button>
        </div>

        {step === 1 ? (
          <div className="p-6">
            <p className="text-[13px] text-[#6B7280] mb-4">What kind of money source are you adding?</p>
            <div className="grid grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt.type}
                  onClick={() => { setType(opt.type); setStep(2); }}
                  className="flex flex-col items-start gap-3 rounded-[18px] border-2 border-gray-100 px-4 py-4 hover:border-[#0E7A52]/25 hover:shadow-[0_0_0_4px_rgba(14,122,82,0.06)] transition-all text-left">
                  <div className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
                    style={{ background: opt.bg, color: opt.color }}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-[#111827]">{opt.label}</p>
                    <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 leading-snug">{opt.desc}</p>
                  </div>
                </button>
              ))}
              <button disabled
                className="flex flex-col items-start gap-3 rounded-[18px] border-2 border-dashed border-gray-100 px-4 py-4 opacity-40 cursor-not-allowed text-left">
                <div className="w-11 h-11 rounded-[13px] bg-gray-100 flex items-center justify-center shrink-0">
                  <Wallet size={22} className="text-gray-400"/>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#9CA3AF]">Other</p>
                  <p className="text-[11.5px] text-[#C4C9D4] mt-0.5">Coming soon</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          type && <MoneySourceForm type={type} onBack={() => setStep(1)} onClose={onClose}/>
        )}
      </div>
    </div>
  );
}

/* ─── Money Source Form (modal step 2) ──────────────────────────────────── */
function MoneySourceForm({ type, onBack, onClose }: { type: FundAccountType; onBack: () => void; onClose: () => void }) {
  const createAccount  = useCreateAccount();
  const setOpeningHook = useSetOpeningBalance();
  const isPending      = createAccount.isPending || setOpeningHook.isPending;

  const [cashName,    setCashName]    = useState('');
  const [bankName,    setBankName]    = useState('');
  const [bankNick,    setBankNick]    = useState('');
  const [bankLast4,   setBankLast4]   = useState('');
  const [upiProvider, setUpiProvider] = useState('');
  const [upiId,       setUpiId]       = useState('');
  const [opening,     setOpening]     = useState('');
  const [err,         setErr]         = useState('');

  function buildName(): string {
    if (type === 'CASH') return cashName.trim() || 'Cash in Hand';
    if (type === 'BANK') {
      const b = bankName.trim(); const n = bankNick.trim();
      return b && n ? `${b} — ${n}` : b || 'Bank Account';
    }
    const p = upiProvider.trim();
    return p ? `${p} UPI` : 'UPI Wallet';
  }

  function handleSubmit() {
    if (type === 'BANK' && !bankName.trim()) { setErr('Bank name is required.'); return; }
    if (type === 'UPI'  && !upiProvider.trim()) { setErr('Provider name is required.'); return; }
    const amt = parseFloat(opening);
    if (!Number.isFinite(amt) || amt < 0) { setErr('Enter a valid opening balance (0 is fine).'); return; }
    setErr('');
    createAccount.mutate({ name: buildName(), type }, {
      onSuccess: (acct) => {
        if (amt > 0) {
          setOpeningHook.mutate({ id: acct.id, amount: amt }, {
            onSuccess: onClose,
            onError:   (e) => setErr(apiMsg(e)),
          });
        } else {
          onClose();
        }
      },
      onError: (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <div className="p-6 space-y-4">
      {type === 'CASH' && (
        <FormField label="Source Name">
          <input type="text" placeholder="Cash in Hand" value={cashName} onChange={e => setCashName(e.target.value)} className={INPUT_CLS}/>
        </FormField>
      )}

      {type === 'BANK' && (
        <>
          <FormField label="Bank Name *">
            <input type="text" placeholder="e.g. SBI, HDFC, Axis" value={bankName} onChange={e => setBankName(e.target.value)} className={INPUT_CLS}/>
          </FormField>
          <FormField label="Account Nickname">
            <input type="text" placeholder="e.g. Savings Account, Current" value={bankNick} onChange={e => setBankNick(e.target.value)} className={INPUT_CLS}/>
          </FormField>
          <FormField label="Last 4 digits (optional)">
            <input type="text" inputMode="numeric" maxLength={4} placeholder="XXXX"
              value={bankLast4}
              onChange={e => setBankLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className={INPUT_CLS}/>
          </FormField>
        </>
      )}

      {type === 'UPI' && (
        <>
          <FormField label="Provider *">
            <input type="text" placeholder="e.g. PhonePe, GPay, Paytm" value={upiProvider} onChange={e => setUpiProvider(e.target.value)} className={INPUT_CLS}/>
          </FormField>
          <FormField label="UPI ID (optional)">
            <input type="text" placeholder="e.g. masjid@okicici" value={upiId} onChange={e => setUpiId(e.target.value)} className={INPUT_CLS}/>
          </FormField>
        </>
      )}

      <FormField label="Initial Migration Balance">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6B7280]">₹</span>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={opening} onChange={e => setOpening(e.target.value)}
            className={`${INPUT_CLS} pl-9`}/>
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-1.5 leading-snug">
          Use this once to migrate your existing offline balance. Future changes happen only through payments, expenses, or adjustments.
        </p>
      </FormField>

      {err && (
        <p className="flex items-center gap-1.5 text-[12px] text-red-500">
          <AlertCircle size={11}/>{err}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onBack}
          className="px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button onClick={handleSubmit} disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 bg-[#0E7A52] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] disabled:opacity-60 transition-colors">
          {isPending ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
          Add Money Source
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#374151] mb-1.5">{label}</p>
      {children}
    </div>
  );
}

/* ─── Money Source Card ─────────────────────────────────────────────────── */
type SourceAction = 'rename' | 'adjust' | 'transfer';

function MoneySourceCard({ account }: { account: FundAccount }) {
  const updateAccount  = useUpdateAccount();
  const deleteAcct     = useDeleteAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [action,   setAction]   = useState<SourceAction | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function pick(a: SourceAction) { setMenuOpen(false); setAction(a); }

  function handleArchive() {
    setMenuOpen(false);
    if (account.active && parseFloat(account.currentBalance) > 0) {
      alert('Cannot archive a source with a non-zero balance. Adjust the balance to ₹0 first.');
      return;
    }
    updateAccount.mutate({ id: account.id, body: { active: false } });
  }

  function handleReactivate() {
    setMenuOpen(false);
    updateAccount.mutate({ id: account.id, body: { active: true } });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Permanently delete "${account.name}"?\n\nThis cannot be undone.`)) return;
    deleteAcct.mutate(account.id);
  }

  const icon   = account.type === 'CASH' ? <PiggyBank size={16} className="text-[#0E7A52]"/>
    : account.type === 'BANK' ? <Landmark  size={16} className="text-[#0B5D3D]"/>
    : <Smartphone size={16} className="text-purple-500"/>;
  const iconBg = account.type === 'CASH' ? 'bg-[#E8F5EF]'
    : account.type === 'BANK' ? 'bg-[#E8F0EF]' : 'bg-purple-50';
  const typeLabel = account.type === 'CASH' ? 'Cash' : account.type === 'BANK' ? 'Bank' : 'UPI';

  return (
    <>
      <div className={[
        'bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.07)] px-5 py-4',
        !account.active ? 'opacity-60' : '',
      ].join(' ')}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-[14px] ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] font-bold text-[#111827]">{account.name}</p>
              <span className="text-[10px] font-semibold text-[#6B7280] bg-gray-100 rounded-md px-1.5 py-0.5">{typeLabel}</span>
              {!account.active && (
                <span className="text-[10px] font-semibold text-[#9CA3AF] bg-gray-100 rounded-md px-1.5 py-0.5">Archived</span>
              )}
            </div>
            <p className={[
              'text-[22px] font-extrabold tabular-nums tracking-tight mt-0.5',
              account.active ? 'text-[#0E7A52]' : 'text-[#9CA3AF]',
            ].join(' ')}>
              {inr(account.currentBalance)}
            </p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              Updated {timeAgo(account.updatedAt)}
            </p>
          </div>

          {/* Kebab menu */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                menuOpen ? 'bg-gray-100 text-[#374151]' : 'text-[#9CA3AF] hover:bg-gray-100 hover:text-[#374151]',
              ].join(' ')}>
              <MoreVertical size={15} strokeWidth={2}/>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] w-[210px] bg-white rounded-[16px] shadow-[0_8px_32px_rgba(15,23,42,0.14)] border border-gray-100 z-20 py-1.5">
                <MenuItem icon={<Pencil size={14}/>}         label="Rename"            onClick={() => pick('rename')}/>
                <MenuItem icon={<SlidersVertical size={14}/>} label="Adjust Balance"   onClick={() => pick('adjust')}/>
                {account.active && (
                  <MenuItem icon={<ArrowLeftRight size={14}/>} label="Transfer Funds"  onClick={() => pick('transfer')}/>
                )}
                <div className="h-px bg-gray-100 mx-2 my-1.5"/>
                {account.active ? (
                  <MenuItem icon={<Archive size={14}/>} label="Archive" onClick={handleArchive} warn/>
                ) : (
                  <MenuItem icon={<Archive size={14}/>} label="Reactivate" onClick={handleReactivate}/>
                )}
                {account.deleteEligible && (
                  <MenuItem icon={<Trash2 size={14}/>} label="Delete Permanently" onClick={handleDelete} danger/>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {action === 'rename'   && <RenameModal      account={account} onClose={() => setAction(null)}/>}
      {action === 'adjust'   && <AdjustBalanceModal account={account} onClose={() => setAction(null)}/>}
      {action === 'transfer' && <TransferModal     account={account} onClose={() => setAction(null)}/>}
    </>
  );
}

function MenuItem({
  icon, label, onClick, warn, danger,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; warn?: boolean; danger?: boolean;
}) {
  const color = danger ? 'text-red-500 hover:bg-red-50'
    : warn ? 'text-orange-500 hover:bg-orange-50'
    : 'text-[#374151] hover:bg-gray-50';
  const iconColor = danger ? 'text-red-400' : warn ? 'text-orange-400' : 'text-[#9CA3AF]';
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${color}`}>
      <span className={iconColor}>{icon}</span>
      {label}
    </button>
  );
}

/* ─── Shared modal shell ─────────────────────────────────────────────────── */
function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-[460px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#111827]">{title}</h2>
            {subtitle && <p className="text-[12px] text-[#9CA3AF] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={14} strokeWidth={2.5} className="text-[#374151]"/>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Rename Modal ───────────────────────────────────────────────────────── */
function RenameModal({ account, onClose }: { account: FundAccount; onClose: () => void }) {
  const updateAccount = useUpdateAccount();
  const [name, setName] = useState(account.name);
  const [err,  setErr]  = useState('');

  function handleSubmit() {
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (name.trim() === account.name) { onClose(); return; }
    setErr('');
    updateAccount.mutate({ id: account.id, body: { name: name.trim() } }, {
      onSuccess: onClose,
      onError:   (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <Modal title="Rename Money Source" subtitle={account.name} onClose={onClose}>
      <div className="p-6 space-y-4">
        <FormField label="New name">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className={INPUT_CLS} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}/>
        </FormField>
        {err && <p className="flex items-center gap-1.5 text-[12px] text-red-500"><AlertCircle size={11}/>{err}</p>}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={updateAccount.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0E7A52] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] disabled:opacity-60 transition-colors">
            {updateAccount.isPending ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Adjust Balance Modal ───────────────────────────────────────────────── */
const ADJUST_REASONS = ['Correction', 'Cash count mismatch', 'Transfer', 'Other'];

function AdjustBalanceModal({ account, onClose }: { account: FundAccount; onClose: () => void }) {
  const setOpening = useSetOpeningBalance();
  const [newBal,  setNewBal]  = useState(parseFloat(account.currentBalance).toFixed(2));
  const [reason,  setReason]  = useState(ADJUST_REASONS[0]!);
  const [notes,   setNotes]   = useState('');
  const [err,     setErr]     = useState('');

  const curr  = parseFloat(account.currentBalance);
  const newN  = parseFloat(newBal);
  const delta = Number.isFinite(newN) ? newN - curr : null;

  function handleSubmit() {
    if (!Number.isFinite(newN) || newN < 0) { setErr('Enter a valid non-negative balance.'); return; }
    setErr('');
    const note = notes.trim() ? `${reason} — ${notes.trim()}` : reason;
    setOpening.mutate({ id: account.id, amount: newN, note }, {
      onSuccess: onClose,
      onError:   (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <Modal title="Adjust Balance" subtitle={account.name} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between bg-[#F6F7F3] rounded-xl px-4 py-3">
          <span className="text-[13px] text-[#6B7280]">Current balance</span>
          <span className="text-[15px] font-bold text-[#111827] tabular-nums">{inr(account.currentBalance)}</span>
        </div>

        <FormField label="New balance">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6B7280]">₹</span>
            <input type="number" min="0" step="0.01" value={newBal}
              onChange={e => setNewBal(e.target.value)}
              className={`${INPUT_CLS} pl-9`} autoFocus/>
          </div>
          {delta !== null && delta !== 0 && (
            <p className={`text-[11.5px] font-semibold mt-1.5 ${delta > 0 ? 'text-[#0E7A52]' : 'text-red-500'}`}>
              {delta > 0 ? `+${inr(delta)} increase` : `${inr(Math.abs(delta))} decrease`}
            </p>
          )}
        </FormField>

        <FormField label="Reason">
          <select value={reason} onChange={e => setReason(e.target.value)} className={INPUT_CLS}>
            {ADJUST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>

        <FormField label="Notes (optional)">
          <input type="text" placeholder="Add context for the audit trail"
            value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_CLS}/>
        </FormField>

        {err && <p className="flex items-center gap-1.5 text-[12px] text-red-500"><AlertCircle size={11}/>{err}</p>}

        <p className="text-[11px] text-[#9CA3AF] bg-[#F6F7F3] rounded-xl px-3.5 py-2.5">
          Every adjustment creates an immutable ledger entry visible in the Ledger tab.
        </p>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={setOpening.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0E7A52] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] disabled:opacity-60 transition-colors">
            {setOpening.isPending ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
            Save Adjustment
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Transfer Funds Modal ───────────────────────────────────────────────── */
function TransferModal({ account, onClose }: { account: FundAccount; onClose: () => void }) {
  const { data: allAccounts } = useAccounts();
  const transfer = useTransferFunds();
  const destinations = (allAccounts ?? []).filter(a => a.active && a.id !== account.id);

  const [toId,   setToId]   = useState(() => destinations[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [notes,  setNotes]  = useState('');
  const [err,    setErr]    = useState('');

  useEffect(() => {
    if (!toId && destinations.length > 0) setToId(destinations[0]!.id);
  }, [destinations, toId]);

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a positive amount.'); return; }
    if (!toId) { setErr('Select a destination.'); return; }
    setErr('');
    transfer.mutate({ fromId: account.id, toId, amount: amt, note: notes.trim() }, {
      onSuccess: onClose,
      onError:   (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <Modal title="Transfer Funds" subtitle={`From: ${account.name}`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between bg-[#F6F7F3] rounded-xl px-4 py-3">
          <span className="text-[13px] text-[#6B7280]">Available</span>
          <span className="text-[15px] font-bold text-[#0E7A52] tabular-nums">{inr(account.currentBalance)}</span>
        </div>

        {destinations.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[13.5px] font-semibold text-[#6B7280]">No other active money sources</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">Add another source first to enable transfers.</p>
          </div>
        ) : (
          <>
            <FormField label="To">
              <select value={toId} onChange={e => setToId(e.target.value)} className={INPUT_CLS}>
                {destinations.map(d => (
                  <option key={d.id} value={d.id}>{d.name} — {inr(d.currentBalance)}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Amount">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6B7280]">₹</span>
                <input type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  className={`${INPUT_CLS} pl-9`} autoFocus/>
              </div>
            </FormField>

            <FormField label="Notes (optional)">
              <input type="text" placeholder="Reason for transfer"
                value={notes} onChange={e => setNotes(e.target.value)} className={INPUT_CLS}/>
            </FormField>

            {err && <p className="flex items-center gap-1.5 text-[12px] text-red-500"><AlertCircle size={11}/>{err}</p>}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={transfer.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-[#0E7A52] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] disabled:opacity-60 transition-colors">
                {transfer.isPending ? <Loader2 size={13} className="animate-spin"/> : <ArrowLeftRight size={13}/>}
                Transfer
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ─── Expenses Tab ───────────────────────────────────────────────────────── */
type ExpenseFilter = 'ALL' | 'MOSQUE_PAID' | 'PENDING_REIMB' | 'REIMBURSED';
const EXPENSE_FILTERS: { id: ExpenseFilter; label: string }[] = [
  { id: 'ALL',          label: 'All'          },
  { id: 'MOSQUE_PAID',  label: 'Mosque-paid'  },
  { id: 'PENDING_REIMB', label: 'Pending Reimb.' },
  { id: 'REIMBURSED',  label: 'Reimbursed'   },
];

function ExpensesTab() {
  const [filter, setFilter]     = useState<ExpenseFilter>('ALL');
  const [showModal, setShowModal] = useState(false);
  const { data: allExpenses, isLoading } = useExpenses();

  const expenses = (allExpenses ?? []).filter(e => {
    if (filter === 'ALL')          return true;
    if (filter === 'MOSQUE_PAID')  return e.expenseType === 'MOSQUE_PAID';
    if (filter === 'PENDING_REIMB') return e.status === 'PENDING_REIMB';
    if (filter === 'REIMBURSED')   return e.status === 'REIMBURSED';
    return true;
  });

  const pendingCount = (allExpenses ?? []).filter(e => e.status === 'PENDING_REIMB').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15.5px] font-bold text-[#111827]">Expenses</h2>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Mosque-paid and personal reimbursements</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-[#0E7A52] rounded-xl px-3.5 py-2 hover:bg-[#0B5D3D] transition-colors">
          <Plus size={13} strokeWidth={2.5}/>Add Expense
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-[14px] px-4 py-3 mb-3">
          <Clock size={14} className="text-orange-500 shrink-0"/>
          <p className="text-[12.5px] font-semibold text-orange-700">
            {pendingCount} expense{pendingCount > 1 ? 's' : ''} pending reimbursement
          </p>
        </div>
      )}

      <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 flex gap-1.5 overflow-x-auto">
          {EXPENSE_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={[
                'rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold shrink-0 transition-colors',
                filter === f.id ? 'bg-[#111827] text-white' : 'text-[#6B7280] border border-gray-100 hover:border-gray-200',
              ].join(' ')}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? <LedgerRowSkeleton/> : expenses.length === 0 ? (
          <div className="py-10 text-center">
            <Receipt size={28} className="text-[#D1D5DB] mx-auto mb-3"/>
            <p className="text-[13.5px] font-semibold text-[#6B7280]">No expenses recorded</p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">Add your first expense above</p>
          </div>
        ) : (
          expenses.map((e, i) => <ExpenseRow key={e.id} expense={e} divider={i > 0}/>)
        )}
      </div>

      {showModal && <AddExpenseModal onClose={() => setShowModal(false)}/>}
    </div>
  );
}

function ExpenseRow({ expense, divider }: { expense: Expense; divider: boolean }) {
  const [showReimburse, setShowReimburse] = useState(false);
  const catLabel = EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category;
  const isMosque = expense.expenseType === 'MOSQUE_PAID';
  const isPending = expense.status === 'PENDING_REIMB';

  return (
    <>
      <div className={`flex items-center gap-3.5 px-5 py-4 ${divider ? 'border-t border-gray-50' : ''}`}>
        <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0 ${isMosque ? 'bg-red-50' : 'bg-orange-50'}`}>
          {isMosque
            ? <ArrowUpRight size={15} className="text-red-500"/>
            : <Clock size={15} className="text-orange-500"/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[13.5px] font-semibold text-[#111827]">{catLabel}</p>
            <span className={[
              'text-[9.5px] font-bold rounded-md px-1.5 py-0.5',
              isMosque        ? 'text-[#374151] bg-gray-100'       : '',
              isPending       ? 'text-orange-600 bg-orange-50'     : '',
              expense.status === 'REIMBURSED' ? 'text-[#0E7A52] bg-[#E8F5EF]' : '',
              expense.status === 'SETTLED'    ? 'text-[#374151] bg-gray-100'   : '',
            ].join(' ')}>
              {expense.status === 'SETTLED'    ? 'Settled'    : ''}
              {expense.status === 'PENDING_REIMB' ? 'Pending Reimb.' : ''}
              {expense.status === 'REIMBURSED' ? 'Reimbursed'  : ''}
            </span>
          </div>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5 truncate">
            {expense.fundAccount ? `From ${expense.fundAccount.name}` : expense.paidBy ? `By ${expense.paidBy.name}` : ''}
            {expense.description ? ` · ${expense.description}` : ''}
            {' · '}{fmtDate(expense.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-[15px] font-bold tabular-nums text-red-500">−{inr(expense.amount)}</p>
          </div>
          {isPending && (
            <button onClick={() => setShowReimburse(true)}
              className="text-[11.5px] font-semibold text-orange-600 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5 hover:bg-orange-100 transition-colors whitespace-nowrap">
              Reimburse
            </button>
          )}
        </div>
      </div>
      {showReimburse && <ReimburseModal expense={expense} onClose={() => setShowReimburse(false)}/>}
    </>
  );
}

/* ─── Add Expense Modal ──────────────────────────────────────────────────── */
function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<ExpenseType>('MOSQUE_PAID');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose}/>
      <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#111827]">
              {step === 1 ? 'Add Expense' : type === 'MOSQUE_PAID' ? 'Mosque-paid Expense' : 'Personal Expense'}
            </h2>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">
              {step === 1 ? 'Choose how this expense was paid' : type === 'MOSQUE_PAID' ? 'Deducted from a money source' : 'Will be reimbursed to the payer'}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={14} strokeWidth={2.5} className="text-[#374151]"/>
          </button>
        </div>

        {step === 1 ? (
          <div className="p-6 space-y-3">
            {([
              { t: 'MOSQUE_PAID'  as ExpenseType, icon: <ArrowUpRight size={22}/>, label: 'Paid from Mosque', desc: 'Money was paid directly from a mosque fund. Balance decrements.', color: '#DC2626', bg: '#FEF2F2' },
              { t: 'PERSONAL_PAID' as ExpenseType, icon: <Clock size={22}/>,       label: 'Paid Personally',  desc: 'A committee member paid out of pocket. Reimbursement pending.', color: '#C2410C', bg: '#FFF7ED' },
            ] as const).map((opt) => (
              <button key={opt.t} onClick={() => { setType(opt.t); setStep(2); }}
                className="w-full flex items-center gap-4 rounded-[18px] border-2 border-gray-100 px-5 py-4 hover:border-[#0E7A52]/20 hover:shadow-[0_0_0_4px_rgba(14,122,82,0.06)] transition-all text-left">
                <div className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0"
                  style={{ background: opt.bg, color: opt.color }}>
                  {opt.icon}
                </div>
                <div>
                  <p className="text-[14.5px] font-bold text-[#111827]">{opt.label}</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5 leading-snug max-w-[280px]">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <ExpenseForm type={type} onBack={() => setStep(1)} onClose={onClose}/>
        )}
      </div>
    </div>
  );
}

function ExpenseForm({ type, onBack, onClose }: { type: ExpenseType; onBack: () => void; onClose: () => void }) {
  const { data: accounts } = useAccounts();
  const { data: team }     = useTeam();
  const createExpense      = useCreateExpense();

  const activeAccounts = (accounts ?? []).filter(a => a.active);
  const isMosque = type === 'MOSQUE_PAID';

  const [category,      setCategory]      = useState('');
  const [amount,        setAmount]        = useState('');
  const [description,   setDescription]   = useState('');
  const [fundAccountId, setFundAccountId] = useState(() => activeAccounts[0]?.id ?? '');
  const [paidByUserId,  setPaidByUserId]  = useState(() => team?.[0]?.id ?? '');
  const [err,           setErr]           = useState('');

  useEffect(() => {
    if (!fundAccountId && activeAccounts.length > 0) setFundAccountId(activeAccounts[0]!.id);
  }, [activeAccounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!paidByUserId && team && team.length > 0) setPaidByUserId(team[0]!.id);
  }, [team?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    if (!category)  { setErr('Select a category.'); return; }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setErr('Enter a valid amount.'); return; }
    if (isMosque && !fundAccountId) { setErr('Select a money source.'); return; }
    if (!isMosque && !paidByUserId) { setErr('Select who paid.'); return; }
    setErr('');

    createExpense.mutate({
      expenseType: type,
      category:    category as ReturnType<typeof Object.keys>[0],
      amount:      amt,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(isMosque  ? { fundAccountId }  : {}),
      ...(!isMosque ? { paidByUserId }   : {}),
    } as Parameters<typeof createExpense.mutate>[0], {
      onSuccess: onClose,
      onError:   (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <div className="p-6 space-y-4">
      <FormField label="Category *">
        <select value={category} onChange={e => setCategory(e.target.value)} className={INPUT_CLS}>
          <option value="">Select category…</option>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </FormField>

      <FormField label="Amount *">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6B7280]">₹</span>
          <input type="number" min="0.01" step="0.01" placeholder="0.00"
            value={amount} onChange={e => setAmount(e.target.value)}
            className={`${INPUT_CLS} pl-9`} autoFocus/>
        </div>
      </FormField>

      {isMosque ? (
        <FormField label="Paid from *">
          {activeAccounts.length === 0 ? (
            <p className="text-[12px] text-orange-500">No active money sources. Add one first.</p>
          ) : (
            <select value={fundAccountId} onChange={e => setFundAccountId(e.target.value)} className={INPUT_CLS}>
              {activeAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {inr(a.currentBalance)}</option>
              ))}
            </select>
          )}
        </FormField>
      ) : (
        <FormField label="Paid by *">
          {!team || team.length === 0 ? (
            <p className="text-[12px] text-[#9CA3AF]">No committee members found.</p>
          ) : (
            <select value={paidByUserId} onChange={e => setPaidByUserId(e.target.value)} className={INPUT_CLS}>
              {team.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.committeeRole})</option>
              ))}
            </select>
          )}
        </FormField>
      )}

      <FormField label="Description (optional)">
        <input type="text" placeholder="What was this expense for?"
          value={description} onChange={e => setDescription(e.target.value)} className={INPUT_CLS}/>
      </FormField>

      {!isMosque && (
        <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-100 rounded-[12px] px-3.5 py-3">
          <Clock size={13} className="text-orange-500 mt-0.5 shrink-0"/>
          <p className="text-[11.5px] text-orange-700 leading-snug">
            This expense will be marked as <strong>Pending Reimbursement</strong>. The treasury balance won't change until you reimburse the payer.
          </p>
        </div>
      )}

      {err && <p className="flex items-center gap-1.5 text-[12px] text-red-500"><AlertCircle size={11}/>{err}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onBack}
          className="px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button onClick={handleSubmit} disabled={createExpense.isPending}
          className="flex-1 flex items-center justify-center gap-2 bg-[#0E7A52] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#0B5D3D] disabled:opacity-60 transition-colors">
          {createExpense.isPending ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
          Record Expense
        </button>
      </div>
    </div>
  );
}

/* ─── Reimburse Modal ────────────────────────────────────────────────────── */
function ReimburseModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const { data: accounts } = useAccounts();
  const reimburse = useReimburseExpense();
  const activeAccounts = (accounts ?? []).filter(a => a.active);

  const [fundAccountId, setFundAccountId] = useState(() => activeAccounts[0]?.id ?? '');
  const [note,          setNote]          = useState('');
  const [err,           setErr]           = useState('');

  useEffect(() => {
    if (!fundAccountId && activeAccounts.length > 0) setFundAccountId(activeAccounts[0]!.id);
  }, [activeAccounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    if (!fundAccountId) { setErr('Select a money source.'); return; }
    setErr('');
    reimburse.mutate({ expenseId: expense.id, body: { fundAccountId, ...(note.trim() ? { note: note.trim() } : {}) } }, {
      onSuccess: onClose,
      onError:   (e) => setErr(apiMsg(e)),
    });
  }

  return (
    <Modal title="Reimburse Expense" subtitle={`${EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category} · ${inr(expense.amount)}`} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-[11px] text-orange-600 font-semibold">Reimburse to</p>
            <p className="text-[14px] font-bold text-[#111827]">{expense.paidBy?.name ?? 'Member'}</p>
          </div>
          <p className="text-[18px] font-extrabold text-orange-600 tabular-nums">{inr(expense.amount)}</p>
        </div>

        <FormField label="Pay from *">
          {activeAccounts.length === 0 ? (
            <p className="text-[12px] text-orange-500">No active money sources.</p>
          ) : (
            <select value={fundAccountId} onChange={e => setFundAccountId(e.target.value)} className={INPUT_CLS}>
              {activeAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {inr(a.currentBalance)}</option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Note (optional)">
          <input type="text" placeholder="e.g. Cash handed over"
            value={note} onChange={e => setNote(e.target.value)} className={INPUT_CLS}/>
        </FormField>

        {err && <p className="flex items-center gap-1.5 text-[12px] text-red-500"><AlertCircle size={11}/>{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="px-4 py-2.5 text-[13px] font-semibold text-[#6B7280] border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={reimburse.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors">
            {reimburse.isPending ? <Loader2 size={13} className="animate-spin"/> : <UserCheck size={13}/>}
            Mark as Reimbursed
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Ledger Tab ─────────────────────────────────────────────────────────── */
const LEDGER_FILTERS: { label: string; value: LedgerEntryType | 'ALL' }[] = [
  { label: 'All',            value: 'ALL'          },
  { label: 'Income',         value: 'INCOME'        },
  { label: 'Expenses',       value: 'EXPENSE'       },
  { label: 'Reimbursements', value: 'REIMBURSEMENT' },
  { label: 'Adjustments',    value: 'ADJUSTMENT'    },
  { label: 'Reversals',      value: 'REVERSAL'      },
];

function LedgerTab() {
  const [filter, setFilter] = useState<LedgerEntryType | 'ALL'>('ALL');
  const { data: entries, isLoading } = useTreasuryLedger(
    filter !== 'ALL' ? { entryType: filter } : undefined,
  );

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-[15.5px] font-bold text-[#111827]">Transaction Ledger</h2>
        <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Immutable account-level audit trail</p>
      </div>
      <div className="bg-white rounded-[24px] shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="flex gap-1.5 px-5 py-3.5 border-b border-gray-50 overflow-x-auto">
          {LEDGER_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={[
                'rounded-[10px] px-3.5 py-1.5 text-[12.5px] font-semibold shrink-0 transition-colors',
                filter === f.value ? 'bg-[#111827] text-white' : 'text-[#6B7280] border border-gray-100 hover:border-gray-200',
              ].join(' ')}>
              {f.label}
            </button>
          ))}
        </div>
        {isLoading ? <LedgerRowSkeleton/> : !entries?.length ? (
          <div className="py-10 text-center">
            <p className="text-[13.5px] text-[#9CA3AF]">No transactions recorded yet</p>
          </div>
        ) : (
          entries.map((entry, i) => <LedgerRow key={entry.id} entry={entry} divider={i > 0}/>)
        )}
      </div>
    </div>
  );
}

function LedgerRow({ entry, divider }: { entry: TreasuryLedgerEntry; divider: boolean }) {
  const isCredit = entry.direction === 'CREDIT';
  const iconCfg: Record<string, { icon: React.ReactNode; bg: string }> = {
    INCOME:        { icon: <ArrowDownLeft     size={14} className="text-[#0E7A52]"/>,    bg: 'bg-[#E8F5EF]'  },
    EXPENSE:       { icon: <ArrowUpRight      size={14} className="text-red-500"/>,      bg: 'bg-red-50'     },
    REIMBURSEMENT: { icon: <UserCheck         size={14} className="text-orange-500"/>,   bg: 'bg-orange-50'  },
    RESERVE_IN:    { icon: <Lock              size={14} className="text-[#C49A0B]"/>,    bg: 'bg-[#FBF5E0]' },
    RESERVE_OUT:   { icon: <RefreshCw         size={14} className="text-[#C49A0B]"/>,    bg: 'bg-[#FBF5E0]' },
    ADJUSTMENT:    { icon: <SlidersHorizontal size={14} className="text-[#6B7280]"/>,    bg: 'bg-gray-100'   },
    TRANSFER:      { icon: <RefreshCw         size={14} className="text-blue-500"/>,     bg: 'bg-blue-50'    },
    REVERSAL:      { icon: <Undo2             size={14} className="text-purple-500"/>,   bg: 'bg-purple-50'  },
  };
  const cfg = iconCfg[entry.entryType] ?? iconCfg['ADJUSTMENT']!;

  return (
    <div className={`flex items-center gap-3.5 px-5 py-3.5 ${divider ? 'border-t border-gray-50' : ''}`}>
      <div className={`w-9 h-9 rounded-[11px] ${cfg.bg} flex items-center justify-center shrink-0`}>{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-[#111827] truncate">
          {entry.note ?? entry.entryType.replace(/_/g, ' ')}
        </p>
        <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">
          {entry.account.name} · {fmtDate(entry.createdAt)} · {entry.createdBy.name}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-[15px] font-bold tabular-nums ${isCredit ? 'text-[#0E7A52]' : 'text-red-500'}`}>
          {isCredit ? '+' : '−'}{inr(entry.amount)}
        </p>
        <p className="text-[10.5px] text-[#9CA3AF] mt-0.5">{entry.entryType}</p>
      </div>
    </div>
  );
}

/* ─── Reserves Tab ───────────────────────────────────────────────────────── */
function ReservesTab({ treasury }: { treasury: TreasurySnapshot | null }) {
  const { data: reserves, isLoading } = useReserves();
  const createReserve = useCreateReserve();
  const updateReserve = useUpdateReserve();

  const [showCreate,    setShowCreate]    = useState(false);
  const [newTitle,      setNewTitle]      = useState('');
  const [newPurpose,    setNewPurpose]    = useState('');
  const [newAmount,     setNewAmount]     = useState('');
  const [newRestricted, setNewRestricted] = useState(false);
  const [newApproval,   setNewApproval]   = useState(false);
  const [createErr,     setCreateErr]     = useState('');

  function handleCreate() {
    if (!newTitle.trim()) { setCreateErr('Title is required.'); return; }
    const a = parseFloat(newAmount);
    if (!Number.isFinite(a) || a < 0) { setCreateErr('Enter a valid amount.'); return; }
    setCreateErr('');
    createReserve.mutate({
      title: newTitle.trim(),
      ...(newPurpose.trim() ? { purpose: newPurpose.trim() } : {}),
      amount: a,
      restricted: newRestricted,
      ...(newRestricted ? { approvalRequired: newApproval } : {}),
    }, {
      onSuccess: () => {
        setShowCreate(false);
        setNewTitle(''); setNewPurpose(''); setNewAmount('');
        setNewRestricted(false); setNewApproval(false);
      },
      onError: (e) => setCreateErr(apiMsg(e)),
    });
  }

  if (isLoading) return <SectionSkeleton rows={2}/>;

  const totalReserved = (reserves ?? []).filter(r => r.active).reduce((s, r) => s + parseFloat(r.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15.5px] font-bold text-[#111827]">Reserved Funds</h2>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Ring-fenced portions of the treasury</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-[#C49A0B] rounded-xl px-3.5 py-2 hover:bg-[#A07F08] transition-colors">
          <Plus size={13} strokeWidth={2.5}/>Add Reserve
        </button>
      </div>

      {/* Net Usable formula */}
      {treasury && (
        <div className="bg-[#F6F7F3] border border-gray-200 rounded-[18px] px-5 py-4 mb-3">
          <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#9CA3AF] mb-2.5">Net Usable Calculation</p>
          <div className="space-y-1.5 text-[13.5px]">
            <div className="flex justify-between">
              <span className="text-[#374151]">Total Balance</span>
              <span className="font-bold text-[#111827] tabular-nums">{inr(treasury.totalBalance)}</span>
            </div>
            {treasury.pendingReimbursements !== '0.00' && (
              <div className="flex justify-between text-orange-600">
                <span>− Pending Reimbursements</span>
                <span className="font-bold tabular-nums">{inr(treasury.pendingReimbursements)}</span>
              </div>
            )}
            {treasury.totalReserved !== '0.00' && (
              <div className="flex justify-between text-[#C49A0B]">
                <span>− Reserved Funds</span>
                <span className="font-bold tabular-nums">{inr(treasury.totalReserved)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="font-bold text-[#0E7A52]">= Net Usable</span>
              <span className="text-[15px] font-extrabold text-[#0E7A52] tabular-nums">{inr(treasury.netUsable)}</span>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.07)] px-5 py-4 mb-3">
          <p className="text-[13px] font-bold text-[#111827] mb-3">New Reserve Fund</p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="text" placeholder="Title (e.g. Masjid Renovation)" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                className={`flex-1 ${INPUT_CLS}`}/>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#6B7280]">₹</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                  className={`w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-[13.5px] focus:outline-none focus:border-[#D4AF37]`}/>
              </div>
            </div>
            <input type="text" placeholder="Purpose (optional)" value={newPurpose} onChange={e => setNewPurpose(e.target.value)}
              className={INPUT_CLS}/>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newRestricted}
                  onChange={e => { setNewRestricted(e.target.checked); if (!e.target.checked) setNewApproval(false); }}
                  className="accent-[#C49A0B] w-4 h-4"/>
                <span className="text-[13px] font-medium text-[#374151]">Restricted fund</span>
              </label>
              {newRestricted && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newApproval} onChange={e => setNewApproval(e.target.checked)}
                    className="accent-orange-500 w-4 h-4"/>
                  <span className="text-[13px] font-medium text-[#374151]">Requires approval</span>
                </label>
              )}
            </div>
            {createErr && (
              <p className="flex items-center gap-1.5 text-[12px] text-red-500">
                <AlertCircle size={11}/>{createErr}
              </p>
            )}
            <button onClick={handleCreate} disabled={createReserve.isPending}
              className="flex items-center gap-1.5 bg-[#C49A0B] text-white rounded-xl px-4 py-2.5 text-[13px] font-semibold hover:bg-[#A07F08] disabled:opacity-60 transition-colors">
              {createReserve.isPending ? <Loader2 size={13} className="animate-spin"/> : <CheckCircle2 size={13}/>}
              Create Reserve
            </button>
          </div>
        </div>
      )}

      {!reserves?.length ? (
        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.06)] py-10 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FBF5E0] flex items-center justify-center mx-auto mb-3">
            <Shield size={20} className="text-[#C49A0B]"/>
          </div>
          <p className="text-[14px] font-bold text-[#111827]">No reserves set up</p>
          <p className="text-[12.5px] text-[#6B7280] mt-1 max-w-xs mx-auto">
            Ring-fence portions of your treasury for specific purposes — building fund, zakat, emergencies.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reserves.map((reserve) => (
            <div key={reserve.id}
              className={`bg-white rounded-[20px] shadow-[0_4px_18px_rgba(15,23,42,0.07)] px-5 py-4 ${reserve.restricted ? 'border-l-[3px] border-[#D4AF37]' : ''}`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0 ${reserve.restricted ? 'bg-[#FBF5E0]' : 'bg-[#F3F4F6]'}`}>
                  {reserve.restricted ? <Lock size={15} className="text-[#C49A0B]"/> : <Shield size={15} className="text-[#9CA3AF]"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14.5px] font-bold text-[#111827]">{reserve.title}</p>
                    {reserve.restricted && (
                      <span className="text-[10px] font-bold text-[#C49A0B] bg-[#FBF5E0] rounded-md px-1.5 py-0.5">Restricted</span>
                    )}
                    {reserve.approvalRequired && (
                      <span className="text-[10px] font-bold text-orange-500 bg-orange-50 rounded-md px-1.5 py-0.5">Approval Req.</span>
                    )}
                    {!reserve.active && (
                      <span className="text-[10px] font-bold text-[#6B7280] bg-gray-100 rounded-md px-1.5 py-0.5">Inactive</span>
                    )}
                  </div>
                  {reserve.purpose && <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{reserve.purpose}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-[20px] font-extrabold text-[#C49A0B] tabular-nums">{inr(reserve.amount)}</p>
                  {reserve.active && (
                    <button onClick={() => updateReserve.mutate({ id: reserve.id, body: { active: false } })}
                      className="text-[11px] font-semibold text-[#6B7280] bg-gray-100 rounded-lg px-2.5 py-1.5 hover:bg-gray-200 transition-colors">
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {totalReserved > 0 && (
            <div className="bg-[#FEF9E7] border border-[#D4AF37]/20 rounded-[16px] px-4 py-3 flex items-start gap-2.5">
              <Lock size={13} className="text-[#C49A0B] mt-0.5 shrink-0"/>
              <p className="text-[12px] text-[#92700A] leading-relaxed">
                Reserved amounts are ring-fenced from Net Usable. They remain in your accounts — this is a logical allocation, not a transfer.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Skeletons ──────────────────────────────────────────────────────────── */
function HeroSkeleton() {
  return <div className="rounded-[28px] h-[200px] bg-gradient-to-br from-[#052E1E] to-[#0E7A52] animate-pulse"/>;
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2.5">
      <div className="h-5 w-36 bg-gray-200 rounded-lg animate-pulse mb-3"/>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-[20px] h-[76px] animate-pulse"/>
      ))}
    </div>
  );
}

function LedgerRowSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex items-center gap-3.5 px-5 py-3.5 ${i > 1 ? 'border-t border-gray-50' : ''}`}>
          <div className="w-9 h-9 rounded-[11px] bg-gray-100 animate-pulse shrink-0"/>
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 bg-gray-100 rounded-lg animate-pulse"/>
            <div className="h-2.5 w-28 bg-gray-100 rounded-lg animate-pulse"/>
          </div>
          <div className="h-4 w-16 bg-gray-100 rounded-lg animate-pulse"/>
        </div>
      ))}
    </>
  );
}
