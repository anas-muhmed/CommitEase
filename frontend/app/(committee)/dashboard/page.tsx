'use client';

import Link from 'next/link';
import AppLogo from '@/components/layout/AppLogo';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, RotateCcw,
  Users, Receipt, CreditCard,
  PlusCircle, BarChart2, Landmark,
  Settings, ShieldCheck, UserCog, ClipboardList, LogOut,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDashboard, useCollectionReport } from '@/lib/hooks/useDashboard';
import { MemberAvatar } from '@/components/ui/member-avatar';
import { useAuthStore } from '@/lib/store/auth.store';
import { logout } from '@/lib/api/auth.api';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function inr(n: string | number, compact = false) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (compact && v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (compact && v >= 1_000)   return `₹${(v / 1_000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dashboard — operational command center ("what needs attention today?")
   Deep analytics live in the Insights tab, not here.
   ══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { data, isLoading }       = useDashboard();
  const [adminOpen, setAdminOpen] = useState(false);
  const adminRef                  = useRef<HTMLDivElement>(null);
  const router                    = useRouter();
  const clearAuth                 = useAuthStore(s => s.clear);

  const handleSignOut = async () => {
    setAdminOpen(false);
    await logout();
    clearAuth();
    router.replace('/login');
  };
  const thisYear                  = new Date().getFullYear();

  /* Collection report — used only for the MoM stat card */
  const { data: collectionData, isLoading: collectionLoading } = useCollectionReport(thisYear);

  /* Close admin dropdown on outside click */
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setAdminOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  /* ── Derived values ───────────────────────────────────────────────────── */
  const outstanding   = data?.totalOutstandingAllMembers ?? '0';
  const collected     = data?.collection.thisMonth.totalAmount ?? '0';
  const pmtCount      = data?.collection.thisMonth.paymentCount ?? 0;
  const active        = data?.members.active ?? 0;
  const inactive      = data?.members.inactive ?? 0;
  const treasury      = data?.treasury;
  const hasTreasury   = treasury?.hasAccounts ?? false;

  const accountsByType = (treasury?.accounts ?? []).reduce<Record<string, number>>(
    (acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + parseFloat(a.balance); return acc; },
    {},
  );

  const progressPct = active > 0 ? Math.min(Math.round((pmtCount / active) * 100), 100) : 0;
  const pending     = Math.max(0, active - pmtCount);

  /* Month-over-month % change */
  const momChange = useMemo(() => {
    if (!collectionData) return null;
    const now  = new Date();
    const curr = `${thisYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = now.getMonth() === 0
      ? `${thisYear - 1}-12`
      : `${thisYear}-${String(now.getMonth()).padStart(2, '0')}`;
    const currAmt = parseFloat(collectionData.find(d => d.month === curr)?.totalCollected ?? '0');
    const prevAmt = parseFloat(collectionData.find(d => d.month === prev)?.totalCollected ?? '0');
    if (prevAmt === 0) return null;
    return Math.round(((currAmt - prevAmt) / prevAmt) * 100);
  }, [collectionData, thisYear]);

  return (
    <div className="min-h-screen bg-[#F6F7F3]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <div className="w-[220px]">
            <AppLogo />
          </div>

          <div className="flex items-center gap-2.5">

            {/* Avatar + admin dropdown */}
            <div ref={adminRef} className="relative">
              <button
                onClick={() => setAdminOpen(v => !v)}
                className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-gray-50 transition-colors"
              >
                <div className="w-[36px] h-[36px] rounded-full bg-[#0E7A52] flex items-center justify-center shrink-0">
                  <span className="text-white text-[12px] font-bold">AA</span>
                </div>
                <div className="hidden sm:block text-left leading-none">
                  <p className="text-[13.5px] font-semibold text-[#111827]">Admin</p>
                  <p className="text-[11px] text-[#6B7280] mt-[2px]">Committee</p>
                </div>
                <ChevronDown size={13}
                  className={`hidden sm:block text-[#9CA3AF] transition-transform duration-150 ${adminOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2.2} />
              </button>

              {adminOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[220px] bg-white rounded-[16px] shadow-[0_16px_48px_rgba(15,23,42,.14)] border border-gray-100 overflow-hidden z-50">
                  <p className="px-4 pt-3.5 pb-1.5 text-[10.5px] font-semibold text-[#9CA3AF] tracking-[0.12em] uppercase">
                    Administration
                  </p>
                  {[
                    { icon: <Users size={14}/>,         label: 'Member Types / Plans', href: '/plans'     },
                    { icon: <UserCog size={14}/>,       label: 'Committee Users',      href: null         },
                    { icon: <ShieldCheck size={14}/>,   label: 'Roles & Permissions',  href: null         },
                    { icon: <ClipboardList size={14}/>, label: 'Audit Logs',           href: null         },
                    { icon: <Settings size={14}/>,      label: 'Settings',             href: '/settings'  },
                  ].map(({ icon, label, href }) => href ? (
                    <Link key={label} href={href} onClick={() => setAdminOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#374151] hover:bg-gray-50 transition-colors">
                      <span className="text-[#9CA3AF]">{icon}</span>
                      {label}
                    </Link>
                  ) : (
                    <div key={label} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#D1D5DB] cursor-not-allowed select-none">
                      <span className="text-[#D1D5DB]">{icon}</span>
                      {label}
                      <span className="ml-auto text-[10px] font-semibold text-[#D1D5DB] bg-gray-100 px-1.5 py-0.5 rounded-full">Soon</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-50 mt-1">
                    <button onClick={() => { void handleSignOut(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-[#DC2626] hover:bg-red-50 transition-colors">
                      <LogOut size={14}/> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="max-w-[1440px] mx-auto px-6 pb-28">

        {/* Greeting */}
        <div className="pt-5 pb-4">
          <p className="text-[13.5px] font-medium text-[#6B7280]">{greeting()},</p>
          <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#111827] tracking-[-0.025em] mt-0.5 leading-[1.1]">
            Committee Dashboard
          </h1>
        </div>

        {/* Hero banner — outstanding + progress reframe */}
        <div
          className="relative rounded-[24px] overflow-hidden min-h-[248px]"
          style={{ background: 'linear-gradient(145deg, #052E1E 0%, #073D28 30%, #0B5538 65%, #0E7A52 100%)' }}
        >
          <IslamicPatternFine />
          <MosqueArchFine />
          {/* warm gold glow — lower-left */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 18% 110%, rgba(212,175,55,0.22) 0%, transparent 55%)',
          }} />
          {/* deep green glow — upper-right */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 92% 8%, rgba(14,122,82,0.30) 0%, transparent 50%)',
          }} />
          <GoldArcPremium />

          <div className="absolute inset-0 z-10 flex flex-col justify-between px-10 pt-8 pb-7">
            <div>
              {isLoading ? (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="h-3 w-32 rounded-lg bg-white/[0.10] animate-pulse" />
                  <div className="h-[42px] w-44 rounded-xl bg-white/[0.12] animate-pulse mt-1" />
                  <div className="h-3 w-48 rounded-lg bg-white/[0.08] animate-pulse mt-2" />
                </div>
              ) : hasTreasury ? (
                /* Treasury balance hero */
                <>
                  <p className="text-[9.5px] font-semibold tracking-[0.22em] uppercase text-white/50">
                    Total Balance
                  </p>
                  <p className="text-[44px] md:text-[48px] font-extrabold text-white tracking-[-0.04em] mt-1 leading-none tabular-nums">
                    {inr(treasury!.totalBalance)}
                  </p>
                  {/* BalancePills — grouped by account type */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {Object.entries(accountsByType).map(([type, amount]) => (
                      <span key={type}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2.5 py-[5px]"
                        style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.78)' }}>
                        <span className="text-[#D4AF37] text-[9.5px] font-bold tracking-[0.08em]">{type}</span>
                        {inr(amount, true)}
                      </span>
                    ))}
                  </div>
                  {/* KpiChips — dues + reimbursements */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    {parseFloat(outstanding) > 0 && (
                      <p className="text-[12px] font-medium text-white/60">
                        Pending dues{' '}
                        <span className="text-white font-bold">{inr(outstanding, true)}</span>
                      </p>
                    )}
                    {treasury!.pendingReimbursements !== '0.00' && (
                      <p className="text-[12px] font-medium text-white/60">
                        Pending reimb.{' '}
                        <span className="text-orange-300 font-bold">{inr(treasury!.pendingReimbursements, true)}</span>
                        {treasury!.pendingReimbursementCount > 0 && (
                          <span className="text-white/45"> ×{treasury!.pendingReimbursementCount}</span>
                        )}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                /* Outstanding hero + treasury setup nudge */
                <>
                  <p className="text-[9.5px] font-semibold tracking-[0.22em] uppercase text-white/50">
                    Total Outstanding
                  </p>
                  <p className="text-[44px] md:text-[48px] font-extrabold text-white tracking-[-0.04em] mt-1 leading-none tabular-nums">
                    {inr(outstanding)}
                  </p>
                  <div className="mt-3 flex items-center gap-3 max-w-[340px]">
                    <div className="flex-1 h-[5px] rounded-full bg-white/[0.18] overflow-hidden">
                      <div className="h-full rounded-full bg-white transition-all duration-700"
                        style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-[11.5px] font-bold text-white/80 shrink-0 tabular-nums">
                      {progressPct}%
                    </span>
                  </div>
                  <p className="text-[12.5px] font-medium text-white/55 mt-2">
                    <span className="text-white/82 font-semibold">{pmtCount}</span> contributions this month
                    {' · '}
                    <span className="text-white/82 font-semibold">{pending}</span> members pending
                  </p>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link href="/finance"
                className="flex items-center gap-1.5 text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 border border-white/20 hover:bg-white/[0.10] transition-all duration-150"
                style={{ background: 'rgba(0,0,0,0.24)', backdropFilter: 'blur(6px)' }}>
                <Landmark size={13} strokeWidth={2} />
                View Finance
                <ChevronRight size={12} strokeWidth={2.2} />
              </Link>
              <Link href="/payments"
                className="flex items-center gap-1.5 text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 border border-white/20 hover:bg-white/[0.10] transition-all duration-150"
                style={{ background: 'rgba(0,0,0,0.24)', backdropFilter: 'blur(6px)' }}>
                <PlusCircle size={13} strokeWidth={2} />
                Record Payment
              </Link>
            </div>
          </div>
        </div>

        {/* Analytics strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <StatCard
            label="Collected This Month"
            value={isLoading ? null : inr(collected, true)}
            sub={isLoading ? null : `${pmtCount} contribution${pmtCount !== 1 ? 's' : ''}`}
            icon={<CreditCard size={16} className="text-[#0E7A52]" />}
            iconBg="bg-[#E8F5EF]"
          />
          <Link href="/members" className="block group">
            <StatCard
              label="Active Members"
              value={isLoading ? null : String(active)}
              sub={isLoading ? null : `${inactive} inactive`}
              icon={<Users size={16} className="text-[#0E7A52]" />}
              iconBg="bg-[#E8F5EF]"
              tappable
            />
          </Link>
          <StatCard
            label="vs. Last Month"
            value={isLoading || collectionLoading ? null : momChange === null ? '—' : `${momChange > 0 ? '+' : ''}${momChange}%`}
            sub={isLoading || collectionLoading ? null : momChange === null ? 'No prior data' : momChange > 0 ? 'Collections up' : momChange < 0 ? 'Collections down' : 'No change'}
            icon={
              momChange === null || momChange === 0
                ? <BarChart2 size={16} className="text-[#9CA3AF]" />
                : momChange > 0
                  ? <TrendingUp size={16} className="text-[#0E7A52]" />
                  : <TrendingDown size={16} className="text-[#DC2626]" />
            }
            iconBg={
              momChange === null || momChange === 0 ? 'bg-[#F3F4F6]'
                : momChange > 0 ? 'bg-[#E8F5EF]'
                : 'bg-[#FEF2F2]'
            }
            valueColor={
              momChange === null || momChange === 0 ? undefined
                : momChange > 0 ? '#0B6644'
                : '#DC2626'
            }
          />
        </div>

        {/* Recent Payments + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_286px] gap-3 mt-3">
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h2 className="text-[15.5px] font-bold text-[#111827]">Recent Payments</h2>
              <Link href="/payments"
                className="flex items-center gap-0.5 text-[12.5px] font-semibold text-[#0E7A52] hover:opacity-70 transition-opacity">
                View All <ChevronRight size={12} strokeWidth={2.2} />
              </Link>
            </div>
            {isLoading ? (
              <PaymentRowSkeleton />
            ) : !data?.recentPayments.length ? (
              <div className="py-10 text-center">
                <p className="text-[13.5px] text-[#9CA3AF]">No payments recorded yet</p>
              </div>
            ) : (
              data.recentPayments.map((p, i) => (
                <Link key={p.id} href={`/members/${p.member.id}`}
                  className={`flex items-center gap-3.5 px-6 py-3.5 hover:bg-gray-50/60 transition-colors ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <MemberAvatar name={p.member.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111827] truncate">{p.member.name}</p>
                    <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                      {p.receipt?.receiptNumber ?? '—'}{p.paymentDate ? ` · ${fmtDate(p.paymentDate)}` : ''}
                    </p>
                  </div>
                  <span className="text-[14px] font-bold text-[#0E7A52] tabular-nums shrink-0">
                    {inr(p.amount)}
                  </span>
                  <ChevronRight size={13} className="text-[#D1D5DB] shrink-0" strokeWidth={2} />
                </Link>
              ))
            )}
          </div>

          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-[15.5px] font-bold text-[#111827]">Quick Actions</h2>
            </div>
            <div className="divide-y divide-gray-50">
              <QuickActionItem href="/finance"
                icon={<Landmark size={16} className="text-[#0E7A52]" />}
                iconBg="bg-[#E8F5EF]"
                label="Finance"
                desc="Manage treasury and reserves" />
              <QuickActionItem href="/reports/overdue"
                icon={<Users size={16} className="text-[#DC2626]" />}
                iconBg="bg-[#FEF2F2]"
                label="Overdue Members"
                desc="See members with pending dues" />
              <QuickActionItem href="/members/new"
                icon={<Receipt size={16} className="text-[#C49A0B]" />}
                iconBg="bg-[#FBF5E0]"
                label="Add Member"
                desc="Register a new committee member" />
              <QuickActionItem href="/insights"
                icon={<BarChart2 size={16} className="text-[#6B7280]" />}
                iconBg="bg-[#F3F4F6]"
                label="View Insights"
                desc="Trends, growth and analytics" />
            </div>
          </div>
        </div>

        {/* Reversals — conditional */}
        {!isLoading && !!data?.recentReversals.length && (
          <div className="mt-3 bg-white rounded-[24px] shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-[15.5px] font-bold text-[#111827]">Reversals</h2>
            </div>
            {data.recentReversals.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3.5 px-6 py-3.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <RotateCcw size={15} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#111827] truncate">{r.payment.member.name}</p>
                  <p className="text-[11.5px] text-[#6B7280] mt-0.5 truncate">&ldquo;{r.reason}&rdquo;</p>
                </div>
                <span className="text-[14px] font-bold text-red-500 tabular-nums shrink-0">
                  -{inr(r.payment.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Decorative SVG components
   ══════════════════════════════════════════════════════════════════════════ */

function GoldArcPremium() {
  return (
    <svg className="absolute right-0 top-0 h-full pointer-events-none"
      style={{ width: '44%' }} viewBox="0 0 240 248"
      preserveAspectRatio="xMaxYMid meet" fill="none" aria-hidden="true">
      <defs>
        <filter id="dash-arc-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="dash-bloom-ambient" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="22"/>
        </filter>
        <filter id="dash-bloom-halo" x="-180%" y="-180%" width="460%" height="460%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
        </filter>
        <filter id="dash-bloom-core" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4"/>
        </filter>
      </defs>
      {/* ambient bands */}
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="80"  opacity="0.018"/>
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="34"  opacity="0.038"/>
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="13"  opacity="0.065" filter="url(#dash-arc-glow)"/>
      {/* hair-line companions */}
      <circle cx="120" cy="500" r="520" stroke="#D4AF37" strokeWidth="0.6" opacity="0.14"/>
      <circle cx="120" cy="500" r="452" stroke="#D4AF37" strokeWidth="1.7" opacity="0.70"/>
      <circle cx="120" cy="500" r="370" stroke="#D4AF37" strokeWidth="0.9" opacity="0.36"/>
      <circle cx="120" cy="500" r="296" stroke="#D4AF37" strokeWidth="0.5" opacity="0.18"/>
      {/* 3-layer bloom at crown node */}
      <circle cx="120" cy="48"  r="48"  fill="#D4AF37" opacity="0.12" filter="url(#dash-bloom-ambient)"/>
      <circle cx="120" cy="48"  r="18"  fill="#D4AF37" opacity="0.45" filter="url(#dash-bloom-halo)"/>
      <circle cx="120" cy="48"  r="6"   fill="#EBC34A" opacity="0.82" filter="url(#dash-bloom-core)"/>
      <circle cx="120" cy="48"  r="2.5" fill="white"   opacity="0.96"/>
    </svg>
  );
}

function MosqueArchFine() {
  return (
    <svg className="absolute right-0 top-0 h-full pointer-events-none"
      style={{ width: '30%', opacity: 0.075 }} viewBox="0 0 280 248"
      preserveAspectRatio="xMaxYMax meet" fill="none" aria-hidden="true">
      <path d="M 40,248 L 40,126 Q 40,15 140,7 Q 240,15 240,126 L 240,248"  stroke="white" strokeWidth="0.9"/>
      <path d="M 63,248 L 63,134 Q 63,32 140,24 Q 217,32 217,134 L 217,248"  stroke="white" strokeWidth="0.7"/>
      <path d="M 86,248 L 86,142 Q 86,49 140,41 Q 194,49 194,142 L 194,248"  stroke="white" strokeWidth="0.5"/>
      <line x1="50"  y1="212" x2="230" y2="212" stroke="white" strokeWidth="0.45"/>
      <line x1="62"  y1="199" x2="218" y2="199" stroke="white" strokeWidth="0.35"/>
      <path d="M 140,9 L 149,18 L 140,27 L 131,18 Z" fill="white" opacity="0.9"/>
    </svg>
  );
}

function IslamicPatternFine() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.05 }} aria-hidden="true">
      <defs>
        <pattern id="dash-geo-lattice" x="0" y="0" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M22,2 L42,22 L22,42 L2,22 Z" fill="none" stroke="white" strokeWidth="0.45"/>
          <path d="M22,11 L33,22 L22,33 L11,22 Z" fill="none" stroke="white" strokeWidth="0.30"/>
          <circle cx="22" cy="2"  r="0.9" fill="white" opacity="0.8"/>
          <circle cx="42" cy="22" r="0.9" fill="white" opacity="0.8"/>
          <circle cx="22" cy="42" r="0.9" fill="white" opacity="0.8"/>
          <circle cx="2"  cy="22" r="0.9" fill="white" opacity="0.8"/>
          <circle cx="22" cy="22" r="0.7" fill="white" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dash-geo-lattice)"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════════════════════ */

function StatCard({
  label, value, sub, icon, iconBg, tappable, valueColor,
}: {
  label: string; value: string | null; sub?: string | null;
  icon: React.ReactNode; iconBg: string; tappable?: boolean; valueColor?: string;
}) {
  return (
    <div className={[
      'bg-white rounded-[20px] shadow-[0_4px_16px_rgba(15,23,42,0.06)] px-5 py-4',
      tappable ? 'hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : '',
    ].join(' ')}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
        <p className="text-[13px] font-semibold text-[#374151] leading-tight">{label}</p>
      </div>
      <div className="mt-3">
        {value === null ? (
          <div className="h-7 w-20 rounded-lg bg-gray-100 animate-pulse" />
        ) : (
          <p className="text-[28px] font-extrabold leading-none tracking-tight tabular-nums"
            style={{ color: valueColor ?? '#111827' }}>{value}</p>
        )}
        {value === null ? (
          <div className="h-3 w-28 rounded-lg bg-gray-100 animate-pulse mt-1.5" />
        ) : sub ? (
          <p className="text-[11.5px] text-[#6B7280] mt-1">{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

function QuickActionItem({ href, icon, iconBg, label, desc }: {
  href: string; icon: React.ReactNode; iconBg: string; label: string; desc: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3.5 px-6 py-3.5 hover:bg-gray-50/70 transition-colors">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-[#111827] leading-tight">{label}</p>
        <p className="text-[11.5px] text-[#6B7280] mt-[2px]">{desc}</p>
      </div>
      <ChevronRight size={13} className="text-[#D1D5DB] shrink-0" strokeWidth={2} />
    </Link>
  );
}

function PaymentRowSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex items-center gap-3.5 px-6 py-3.5 ${i > 1 ? 'border-t border-gray-50' : ''}`}>
          <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="w-32 h-3.5 rounded-lg bg-gray-100 animate-pulse" />
            <div className="w-24 h-2.5 rounded-lg bg-gray-100 animate-pulse" />
          </div>
          <div className="w-12 h-3.5 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      ))}
    </>
  );
}
