'use client';

import Link from 'next/link';
import AppLogo from '@/components/layout/AppLogo';
import { useRef, useState, useMemo } from 'react';
import {
  ChevronDown, TrendingUp, TrendingDown, Minus,
  Users, Wallet, AlertTriangle, ArrowRight, Download, Target,
} from 'lucide-react';
import { useDashboard, useCollectionReport, useOverdueReport } from '@/lib/hooks/useDashboard';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function inr(n: number, compact = false) {
  if (compact && n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (compact && n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function parseinr(s: string) { return parseFloat(s) || 0; }
function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}
function initials(name: string) {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const AVATAR_COLORS = ['#0E7A52','#2563EB','#7C3AED','#DC2626','#D97706'];

type Period = '1M' | '3M' | '6M' | '12M';
const PERIOD_N: Record<Period, number> = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 };

function getPeriodMonths(period: Period, now: Date) {
  const n = PERIOD_N[period];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

function getPrevPeriodMonths(period: Period, now: Date) {
  const n = PERIOD_N[period];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n * 2 - 1 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}

function formatRange(months: { year: number; month: number }[]): string {
  if (months.length === 0) return '';
  const f = months[0];
  const l = months[months.length - 1];
  const s = new Date(f.year, f.month, 1);
  const e = new Date(l.year, l.month + 1, 0);
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return months.length === 1 ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

/* ─── overdue member type (local) ─────────────────────────────────────────── */
type OverdueMem = {
  memberId: string; memberCode: string; name: string;
  totalOutstanding: string; overdueMonths: number;
  severity: 'mild' | 'serious' | 'critical';
};

/* ═══════════════════════════════════════════════════════════════════════════
   Insights Page
   ══════════════════════════════════════════════════════════════════════════ */
export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>('3M');
  const nowRef = useRef(new Date());
  const now = nowRef.current;
  const thisYear = now.getFullYear();

  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: col,  isLoading: colLoading }  = useCollectionReport(thisYear);
  const { data: colPrev, isLoading: colPrevLoading } = useCollectionReport(thisYear - 1);
  const { data: overdue, isLoading: overdueLoading } = useOverdueReport();

  const anyLoading = dashLoading || colLoading || colPrevLoading || overdueLoading;

  /* ── Period month lists ──────────────────────────────────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currMonths = useMemo(() => getPeriodMonths(period, now), [period]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevMonths = useMemo(() => getPrevPeriodMonths(period, now), [period]);
  const rangeLabel = useMemo(() => formatRange(currMonths), [currMonths]);

  /* ── Unified collection map (year + prev year) ───────────────────────────── */
  const colMap = useMemo(() => {
    const m: Record<string, { amt: number; pmts: number }> = {};
    col?.forEach(d => { m[d.month] = { amt: parseinr(d.totalCollected), pmts: d.paymentCount }; });
    colPrev?.forEach(d => { m[d.month] = { amt: parseinr(d.totalCollected), pmts: d.paymentCount }; });
    return m;
  }, [col, colPrev]);

  /* ── Sum helpers ─────────────────────────────────────────────────────────── */
  const curr = useMemo(() => {
    let amt = 0, pmts = 0;
    currMonths.forEach(({ year, month }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const d = colMap[key];
      if (d) { amt += d.amt; pmts += d.pmts; }
    });
    return { amt, pmts };
  }, [currMonths, colMap]);

  const prev = useMemo(() => {
    let amt = 0, pmts = 0;
    prevMonths.forEach(({ year, month }) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const d = colMap[key];
      if (d) { amt += d.amt; pmts += d.pmts; }
    });
    return { amt, pmts };
  }, [prevMonths, colMap]);

  /* ── KPIs ────────────────────────────────────────────────────────────────── */
  const activeMem  = dash?.members.active ?? 0;
  const odTotal    = overdue?.summary.total ?? 0;
  const odAmt      = parseinr(overdue?.summary.totalOutstanding ?? '0');
  const totalOuts  = parseinr(dash?.totalOutstandingAllMembers ?? '0');
  const n          = PERIOD_N[period];
  const currRate   = activeMem > 0 ? Math.min(Math.round((curr.pmts / (activeMem * n)) * 100), 100) : 0;
  const prevRate   = activeMem > 0 ? Math.min(Math.round((prev.pmts / (activeMem * n)) * 100), 100) : 0;
  const amtDelta   = pctDelta(curr.amt, prev.amt);
  const rateDelta  = pctDelta(currRate, prevRate);

  /* ── Chart data ──────────────────────────────────────────────────────────── */
  const chartData = useMemo(() => currMonths.map(({ year, month }) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const d = colMap[key];
    return { label: MONTHS_SHORT[month], amt: d?.amt ?? 0, count: d?.pmts ?? 0 };
  }), [currMonths, colMap]);

  /* ── Dues aging buckets ──────────────────────────────────────────────────── */
  const duesAging = useMemo(() => {
    const m = overdue?.members ?? [];
    return [
      { label: '0-30 days',  count: m.filter(x => x.overdueMonths <= 1).length, color: '#22C55E' },
      { label: '31-60 days', count: m.filter(x => x.overdueMonths === 2).length, color: '#EAB308' },
      { label: '61-90 days', count: m.filter(x => x.overdueMonths === 3).length, color: '#F97316' },
      { label: '90+ days',   count: m.filter(x => x.overdueMonths >= 4).length, color: '#EF4444' },
    ];
  }, [overdue]);

  /* ── Top 5 overdue ───────────────────────────────────────────────────────── */
  const topOverdue = useMemo(() => {
    if (!overdue?.members) return [] as OverdueMem[];
    return [...overdue.members]
      .sort((a, b) => parseinr(b.totalOutstanding) - parseinr(a.totalOutstanding))
      .slice(0, 5) as OverdueMem[];
  }, [overdue]);

  /* ── Smart insights ──────────────────────────────────────────────────────── */
  type InsightType = 'positive' | 'warning' | 'info' | 'negative';
  const smartInsights = useMemo((): { emoji: string; type: InsightType; title: string; desc: string }[] => {
    const list: { emoji: string; type: InsightType; title: string; desc: string }[] = [];
    if (amtDelta !== null && amtDelta > 0)
      list.push({ emoji: '📈', type: 'positive', title: `Collections improved ${amtDelta}%`, desc: 'Great job! Collections are up compared to the previous period.' });
    else if (amtDelta !== null && amtDelta < 0)
      list.push({ emoji: '📉', type: 'negative', title: `Collections down ${Math.abs(amtDelta)}%`, desc: 'Collections are lower than the previous period. Consider following up.' });

    if (odTotal > 0)
      list.push({ emoji: '👤', type: 'warning', title: `${odTotal} members are overdue`, desc: 'Consider following up with members who have pending dues.' });
    else
      list.push({ emoji: '✅', type: 'positive', title: 'All members are current', desc: 'Excellent! No members have overdue contributions.' });

    if (currRate >= 80)
      list.push({ emoji: '🎯', type: 'positive', title: `${currRate}% collection rate`, desc: `Strong! ${currRate}% of expected contributions collected this period.` });
    else if (currRate > 0)
      list.push({ emoji: '🎯', type: 'info', title: `Collection rate at ${currRate}%`, desc: 'Track this metric monthly to spot trends and improve outreach.' });

    list.push({ emoji: '💡', type: 'info', title: 'Payment mode tracking coming soon', desc: "Soon you'll see UPI vs Cash vs Bank transfer breakdowns here." });
    return list.slice(0, 4);
  }, [amtDelta, odTotal, currRate]);

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#F6F7F3]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <AppLogo />
          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-gray-50 transition-colors">
              <div className="w-[36px] h-[36px] rounded-full bg-[#0E7A52] flex items-center justify-center shrink-0">
                <span className="text-white text-[12px] font-bold">AA</span>
              </div>
              <div className="hidden sm:block text-left leading-none">
                <p className="text-[13.5px] font-semibold text-[#111827]">Admin</p>
                <p className="text-[11px] text-[#6B7280] mt-[2px]">Committee</p>
              </div>
              <ChevronDown size={13} className="hidden sm:block text-[#9CA3AF]" strokeWidth={2.2}/>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 pb-28">

        {/* ── Page heading + period selector ──────────────────────────── */}
        <div className="flex items-start justify-between pt-5 pb-5 gap-4 flex-wrap">
          <div>
            <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#111827] tracking-[-0.025em] leading-tight">
              Insights
            </h1>
            <p className="text-[13.5px] font-medium text-[#6B7280] mt-1">
              Track performance and understand your collection trends
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Period toggle */}
            <div className="flex items-center gap-0.5 bg-[#F1F5F1] rounded-[10px] p-[3px]">
              {(['1M','3M','6M','12M'] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={[
                    'px-3.5 py-[6px] rounded-[7px] text-[12.5px] font-bold transition-all duration-150',
                    period === p
                      ? 'bg-[#0E7A52] text-white shadow-[0_2px_8px_rgba(14,122,82,0.30)]'
                      : 'text-[#9CA3AF] hover:text-[#374151]',
                  ].join(' ')}>
                  {p}
                </button>
              ))}
            </div>
            {/* Date range */}
            <span className="hidden md:block text-[12px] font-medium text-[#9CA3AF]">{rangeLabel}</span>
            {/* Export */}
            <button className="flex items-center gap-1.5 px-4 py-[7px] rounded-[9px] bg-white border border-gray-200 text-[12.5px] font-semibold text-[#374151] hover:bg-gray-50 transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <Download size={13} strokeWidth={2}/>
              Export
            </button>
          </div>
        </div>

        {/* ── KPI strip (5 cards) ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <KPICard loading={anyLoading}
            icon={<Wallet size={16} className="text-[#0E7A52]"/>} iconBg="#E8F5EF"
            label="Total Collected" value={inr(curr.amt, true)}
            delta={amtDelta} deltaNote={`vs last ${n} month${n > 1 ? 's' : ''}`}/>
          <KPICard loading={anyLoading}
            icon={<Target size={16} className="text-[#2563EB]"/>} iconBg="#EFF6FF"
            label="Collection Rate" value={`${currRate}%`}
            delta={rateDelta} deltaNote="vs last period"
            gauge={{ value: currRate, color: currRate >= 80 ? '#22C55E' : currRate >= 60 ? '#EAB308' : '#EF4444' }}/>
          <KPICard loading={anyLoading}
            icon={<AlertTriangle size={16} className="text-[#DC2626]"/>} iconBg="#FEF2F2"
            label="Overdue Members" value={String(odTotal)}
            delta={null} deltaNote=""
            subtext={odTotal > 0 ? `${inr(odAmt, true)} outstanding` : 'All current!'}
            subtextColor={odTotal > 0 ? '#DC2626' : '#0E7A52'}/>
          <KPICard loading={anyLoading}
            icon={<AlertTriangle size={16} className="text-[#D97706]"/>} iconBg="#FFFBEB"
            label="Total Outstanding" value={inr(totalOuts, true)}
            delta={null} deltaNote=""
            subtext="All members"/>
          <KPICard loading={anyLoading}
            icon={<Users size={16} className="text-[#7C3AED]"/>} iconBg="#F5F3FF"
            label="Active Members" value={String(activeMem)}
            delta={null} deltaNote=""
            subtext="Currently enrolled"/>
        </div>

        {/* ── Chart row ────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-4 mb-4">

          {/* Trend chart — 3 of 5 cols */}
          <div className="lg:col-span-3 bg-white rounded-[24px] shadow-[0_4px_16px_rgba(15,23,42,.06)] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
              <div>
                <h2 className="text-[15.5px] font-bold text-[#111827]">Collection Trend</h2>
                {!colLoading && curr.amt > 0 && (
                  <p className="text-[12px] text-[#6B7280] mt-0.5">
                    {inr(curr.amt, true)} total · {curr.pmts} payments
                  </p>
                )}
              </div>
              {/* Chart legend */}
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#374151]">
                  <svg width="14" height="4" aria-hidden="true"><rect x="0" y="1" width="14" height="2" rx="1" fill="#0E7A52"/></svg>
                  Collected
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF]">
                  <svg width="14" height="4" aria-hidden="true">
                    <line x1="0" y1="2" x2="14" y2="2" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="3 2"/>
                  </svg>
                  Avg
                </span>
              </div>
            </div>
            <div className="px-6 py-5">
              {colLoading || colPrevLoading ? (
                <div className="h-[220px] rounded-xl bg-gray-50 animate-pulse"/>
              ) : chartData.every(d => d.amt === 0) ? (
                <div className="h-[220px] flex flex-col items-center justify-center gap-2">
                  <Wallet size={28} className="text-gray-200"/>
                  <p className="text-[13px] text-[#9CA3AF]">No data for selected period</p>
                </div>
              ) : (
                <TrendChart data={chartData}/>
              )}
            </div>
          </div>

          {/* Payment mode — 2 of 5 cols */}
          <div className="lg:col-span-2 bg-white rounded-[24px] shadow-[0_4px_16px_rgba(15,23,42,.06)] overflow-hidden flex flex-col">
            <div className="px-6 pt-5 pb-4 border-b border-gray-50">
              <h2 className="text-[15.5px] font-bold text-[#111827]">Payment Mode Breakdown</h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">UPI · Cash · Bank transfer</p>
            </div>
            <div className="flex-1 px-6 py-6 flex flex-col items-center justify-center gap-5">
              {/* Placeholder donut */}
              <div className="relative">
                <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
                  <circle cx="70" cy="70" r="50" fill="none" stroke="#F3F4F6" strokeWidth="20"/>
                  <circle cx="70" cy="70" r="50" fill="none" stroke="#E5E7EB" strokeWidth="20"
                    strokeDasharray="80 234" transform="rotate(-90 70 70)"/>
                  <circle cx="70" cy="70" r="50" fill="none" stroke="#EBEBEB" strokeWidth="20"
                    strokeDasharray="55 234" strokeDashoffset="-80" transform="rotate(-90 70 70)"/>
                  <text x="70" y="66" textAnchor="middle" fontSize="11" fontWeight="700" fill="#D1D5DB"
                    fontFamily="var(--font-manrope)">Coming</text>
                  <text x="70" y="82" textAnchor="middle" fontSize="11" fontWeight="700" fill="#D1D5DB"
                    fontFamily="var(--font-manrope)">Soon</text>
                </svg>
              </div>
              <div className="flex flex-col gap-2.5 w-full">
                {[
                  { label: 'UPI',           color: '#22C55E', pct: '—' },
                  { label: 'Cash',          color: '#3B82F6', pct: '—' },
                  { label: 'Bank Transfer', color: '#A855F7', pct: '—' },
                ].map(({ label, color, pct }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }}/>
                      <span className="text-[12.5px] font-medium text-[#9CA3AF]">{label}</span>
                    </div>
                    <span className="text-[12.5px] text-[#C4C9C0]">{pct}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-center text-[#C4C9C0] leading-relaxed">
                Requires payment method tracking<br/>— coming in a future update
              </p>
            </div>
          </div>
        </div>

        {/* ── Bottom row (3 equal columns) ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Period Comparison Table */}
          <ComparisonTable
            loading={anyLoading}
            curr={curr} prev={prev}
            currRate={currRate} prevRate={prevRate}
            odTotal={odTotal} totalOuts={totalOuts}
            period={period}
          />

          {/* Dues Aging Donut */}
          <DuesAgingCard loading={overdueLoading} aging={duesAging} total={odTotal}/>

          {/* Top Overdue Members */}
          <TopOverdueCard loading={overdueLoading} members={topOverdue}/>
        </div>

        {/* ── Smart Insights strip ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-bold text-[#111827]">Smart Insights</h2>
            <span className="text-[16px] leading-none">⚡</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {smartInsights.map((ins, i) => (
              <SmartInsightCard key={i} emoji={ins.emoji} type={ins.type} title={ins.title} desc={ins.desc}/>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   KPI Card
   ══════════════════════════════════════════════════════════════════════════ */
function KPICard({
  loading, icon, iconBg, label, value, delta, deltaNote, subtext, subtextColor, gauge,
}: {
  loading: boolean; icon: React.ReactNode; iconBg: string; label: string; value: string;
  delta: number | null; deltaNote: string;
  subtext?: string; subtextColor?: string;
  gauge?: { value: number; color: string };
}) {
  return (
    <div className="bg-white rounded-[20px] shadow-[0_4px_16px_rgba(15,23,42,.06)] px-4 py-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: iconBg }}>
            {icon}
          </div>
          <p className="text-[11.5px] font-semibold text-[#6B7280] leading-tight truncate">{label}</p>
        </div>
        {gauge && !loading && <SmallRing value={gauge.value} color={gauge.color}/>}
      </div>

      {loading ? (
        <div className="h-8 w-20 rounded-lg bg-gray-100 animate-pulse"/>
      ) : (
        <p className="text-[26px] font-extrabold text-[#111827] tracking-[-0.02em] leading-none tabular-nums">
          {value}
        </p>
      )}

      {loading ? (
        <div className="h-3.5 w-24 rounded bg-gray-100 animate-pulse"/>
      ) : delta !== null ? (
        <div className="flex flex-col gap-0.5">
          <DeltaBadge value={delta}/>
          {deltaNote && <p className="text-[10.5px] text-[#C4C9C0]">{deltaNote}</p>}
        </div>
      ) : subtext ? (
        <p className="text-[11.5px] font-medium" style={{ color: subtextColor ?? '#9CA3AF' }}>{subtext}</p>
      ) : null}
    </div>
  );
}

/* ── Small ring gauge ─────────────────────────────────────────────────────── */
function SmallRing({ value, color }: { value: number; color: string }) {
  const r = 13, cx = 18, cy = 18, circ = 2 * Math.PI * r;
  const filled = Math.min(value / 100, 1) * circ;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth="4"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Period Comparison Table
   ══════════════════════════════════════════════════════════════════════════ */
function ComparisonTable({
  loading, curr, prev, currRate, prevRate, odTotal, totalOuts, period,
}: {
  loading: boolean;
  curr: { amt: number; pmts: number };
  prev: { amt: number; pmts: number };
  currRate: number; prevRate: number;
  odTotal: number; totalOuts: number;
  period: Period;
}) {
  const n = PERIOD_N[period];
  const thisLabel = n === 1 ? 'This Month' : `This ${n}M`;
  const prevLabel = n === 1 ? 'Last Month' : `Prev ${n}M`;

  const rows = [
    { label: 'Collected Amount', curr: inr(curr.amt, true), prev: inr(prev.amt, true),
      delta: pctDelta(curr.amt, prev.amt), lowerBetter: false },
    { label: 'Collection Rate', curr: `${currRate}%`, prev: `${prevRate}%`,
      delta: pctDelta(currRate, prevRate), lowerBetter: false },
    { label: 'Overdue Members', curr: String(odTotal), prev: '—', delta: null, lowerBetter: true },
    { label: 'Outstanding',     curr: inr(totalOuts, true), prev: '—', delta: null, lowerBetter: true },
  ];

  return (
    <div className="bg-white rounded-[24px] shadow-[0_4px_16px_rgba(15,23,42,.06)] overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-gray-50">
        <h2 className="text-[15.5px] font-bold text-[#111827]">Period Comparison</h2>
        <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">{thisLabel} vs {prevLabel}</p>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_90px_70px] px-5 py-2.5 border-b border-gray-50">
        <span className="text-[10.5px] font-bold text-[#9CA3AF] uppercase tracking-[0.08em]">Metric</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0E7A52] shrink-0"/>
          <span className="text-[10.5px] font-bold text-[#0E7A52] uppercase tracking-[0.08em]">{thisLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#9CA3AF] shrink-0"/>
          <span className="text-[10.5px] font-bold text-[#9CA3AF] uppercase tracking-[0.08em]">{prevLabel}</span>
        </div>
      </div>

      <div className="px-5">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="py-3 border-b border-gray-50 last:border-0">
              <div className="h-4 w-full rounded bg-gray-50 animate-pulse"/>
            </div>
          ))
        ) : rows.map((row, i) => (
          <div key={i}
            className={`grid grid-cols-[1fr_90px_70px] items-center py-3 ${i < rows.length - 1 ? 'border-b border-gray-50' : ''}`}>
            <span className="text-[12px] font-medium text-[#374151]">{row.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-[#111827] tabular-nums">{row.curr}</span>
              {row.delta !== null && (
                <span className={[
                  'text-[9.5px] font-bold px-1 py-[2px] rounded-full leading-none',
                  row.delta > 0
                    ? (row.lowerBetter ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#DCFCE7] text-[#15803D]')
                    : row.delta < 0
                    ? (row.lowerBetter ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#DC2626]')
                    : 'bg-gray-100 text-[#6B7280]',
                ].join(' ')}>
                  {row.delta > 0 ? '↑' : row.delta < 0 ? '↓' : '—'}{Math.abs(row.delta)}%
                </span>
              )}
            </div>
            <span className="text-[12px] text-[#9CA3AF] tabular-nums">{row.prev}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Dues Aging Donut Card
   ══════════════════════════════════════════════════════════════════════════ */
function DuesAgingCard({
  loading, aging, total,
}: {
  loading: boolean;
  aging: { label: string; count: number; color: string }[];
  total: number;
}) {
  return (
    <div className="bg-white rounded-[24px] shadow-[0_4px_16px_rgba(15,23,42,.06)] overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-gray-50">
        <h2 className="text-[15.5px] font-bold text-[#111827]">Dues Aging</h2>
        <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Overdue breakdown by duration</p>
      </div>
      <div className="px-5 py-5">
        {loading ? (
          <div className="h-[220px] rounded-xl bg-gray-50 animate-pulse"/>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="36" fill="none" stroke="#DCFCE7" strokeWidth="16"/>
            </svg>
            <p className="text-[13px] font-bold text-[#0E7A52]">No overdue members</p>
            <p className="text-[12px] text-[#9CA3AF]">All contributions are up to date</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <DonutChart segments={aging} size={152} strokeWidth={22}
              centerTop={String(total)} centerBottom="Members"/>
            <div className="flex flex-col gap-2 w-full">
              {aging.map(({ label, count, color }) => count > 0 && (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }}/>
                    <span className="text-[12px] font-medium text-[#374151]">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-[#111827]">{count}</span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      ({total > 0 ? Math.round((count / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/members"
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0E7A52] hover:underline mt-1">
              View Overdue Members <ArrowRight size={13} strokeWidth={2.2}/>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Top Overdue Members Card
   ══════════════════════════════════════════════════════════════════════════ */
function TopOverdueCard({ loading, members }: { loading: boolean; members: OverdueMem[] }) {
  return (
    <div className="bg-white rounded-[24px] shadow-[0_4px_16px_rgba(15,23,42,.06)] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50">
        <div>
          <h2 className="text-[15.5px] font-bold text-[#111827]">Top Overdue Members</h2>
          <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">Highest outstanding first</p>
        </div>
        <Link href="/members"
          className="text-[12px] font-semibold text-[#0E7A52] hover:underline">
          View All
        </Link>
      </div>
      <div className="px-5 py-3">
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse shrink-0"/>
              <div className="flex-1">
                <div className="h-3 w-24 rounded bg-gray-100 animate-pulse mb-1.5"/>
                <div className="h-2.5 w-16 rounded bg-gray-50 animate-pulse"/>
              </div>
            </div>
          ))
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users size={28} className="text-gray-200"/>
            <p className="text-[13px] font-semibold text-[#0E7A52]">No overdue members</p>
            <p className="text-[12px] text-[#9CA3AF]">Everyone is current!</p>
          </div>
        ) : (
          members.map((m, i) => {
            const approxDays = m.overdueMonths * 30;
            const dayColor = approxDays > 90 ? '#DC2626' : approxDays > 60 ? '#F97316' : '#D97706';
            const bgColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <div key={m.memberId}
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                  style={{ background: bgColor }}>
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#111827] truncate">{m.name}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{m.memberCode}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12.5px] font-bold text-[#111827] tabular-nums">
                    {inr(parseinr(m.totalOutstanding), true)}
                  </p>
                  <p className="text-[11px] font-semibold tabular-nums" style={{ color: dayColor }}>
                    {approxDays} days
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Smart Insight Card
   ══════════════════════════════════════════════════════════════════════════ */
function SmartInsightCard({
  emoji, type, title, desc,
}: {
  emoji: string; type: 'positive' | 'warning' | 'info' | 'negative';
  title: string; desc: string;
}) {
  const bg = { positive: '#F0FDF4', warning: '#FFFBEB', info: '#F0F9FF', negative: '#FFF7F7' }[type];
  const border = { positive: '#BBF7D0', warning: '#FDE68A', info: '#BAE6FD', negative: '#FECACA' }[type];
  const titleColor = { positive: '#15803D', warning: '#B45309', info: '#0369A1', negative: '#DC2626' }[type];

  return (
    <div className="rounded-[18px] px-5 py-4 flex flex-col gap-2 border"
      style={{ background: bg, borderColor: border }}>
      <div className="flex items-center gap-2">
        <span className="text-[18px] leading-none">{emoji}</span>
        <p className="text-[12.5px] font-bold leading-tight" style={{ color: titleColor }}>{title}</p>
      </div>
      <p className="text-[11.5px] font-medium text-[#6B7280] leading-relaxed">{desc}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SVG Donut Chart
   ══════════════════════════════════════════════════════════════════════════ */
function DonutChart({
  segments, size = 140, strokeWidth = 20, centerTop, centerBottom,
}: {
  segments: { label: string; count: number; color: string }[];
  size?: number; strokeWidth?: number;
  centerTop?: string; centerBottom?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.count, 0);

  const nonZero = segments.filter(s => s.count > 0);
  const GAP = nonZero.length > 1 ? 2 : 0;
  const totalGapDeg = GAP * nonZero.length;
  const availDeg = 360 - totalGapDeg;

  let currentDeg = -90;
  const arcs = nonZero.map(seg => {
    const segDeg = (seg.count / total) * availDeg;
    const segLen = (segDeg / 360) * circ;
    const startDeg = currentDeg;
    currentDeg += segDeg + GAP;
    return { color: seg.color, startDeg, segLen };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth}/>
      {arcs.map((arc, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none" stroke={arc.color} strokeWidth={strokeWidth}
          strokeDasharray={`${arc.segLen} ${circ}`}
          transform={`rotate(${arc.startDeg} ${cx} ${cy})`}
          strokeLinecap="butt"/>
      ))}
      {centerTop && (
        <text x={cx} y={cy - (centerBottom ? 8 : 0)} textAnchor="middle"
          fontSize="18" fontWeight="800" fill="#111827" fontFamily="var(--font-manrope)">
          {centerTop}
        </text>
      )}
      {centerBottom && (
        <text x={cx} y={cy + 14} textAnchor="middle"
          fontSize="11" fill="#9CA3AF" fontFamily="var(--font-manrope)">
          {centerBottom}
        </text>
      )}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Delta Badge
   ══════════════════════════════════════════════════════════════════════════ */
function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value > 0, zero = value === 0;
  const Icon = zero ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <div className={[
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold',
      zero ? 'bg-gray-100 text-[#6B7280]'
        : up ? 'bg-[#DCFCE7] text-[#15803D]'
        : 'bg-[#FEE2E2] text-[#DC2626]',
    ].join(' ')}>
      <Icon size={11} strokeWidth={2.5}/>
      {up ? '+' : zero ? '' : '−'}{Math.abs(value)}%
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trend Chart — smooth cubic Bezier area, avg reference line, peak callout
   ══════════════════════════════════════════════════════════════════════════ */
function TrendChart({ data }: { data: { label: string; amt: number; count: number }[] }) {
  const W = 640, H = 220;
  const PAD = { top: 44, right: 30, bottom: 36, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  const amounts = data.map(d => d.amt);
  const maxAmt  = Math.max(...amounts, 1);
  const avgAmt  = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const n       = data.length;
  const peakIdx = amounts.reduce((pi, a, i) => a > amounts[pi] ? i : pi, 0);

  const xOf = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => PAD.top + plotH - (v / maxAmt) * plotH;
  const pts  = data.map((_, i) => [xOf(i), yOf(data[i].amt)] as [number, number]);

  let linePath = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const cpX = (x0 + x1) / 2;
    linePath += ` C ${cpX} ${y0} ${cpX} ${y1} ${x1} ${y1}`;
  }

  const bottomY = PAD.top + plotH;
  const areaPath = n <= 1
    ? `M ${pts[0][0]} ${pts[0][1]} L ${pts[0][0]} ${bottomY} Z`
    : `${linePath} L ${pts[n-1][0]} ${bottomY} L ${pts[0][0]} ${bottomY} Z`;

  const avgY = yOf(avgAmt);
  const [pkX, pkY] = pts[peakIdx];
  const yTicks = [0, 0.5, 1].map(f => ({ y: yOf(f * maxAmt), label: inr(f * maxAmt, true) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} aria-hidden="true">
      <defs>
        <linearGradient id="ins-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0E7A52" stopOpacity="0.13"/>
          <stop offset="70%"  stopColor="#0E7A52" stopOpacity="0.03"/>
          <stop offset="100%" stopColor="#0E7A52" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map(({ y }, i) => (
        <line key={i} x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y} stroke="#F0F1EE" strokeWidth="1"/>
      ))}

      {/* Average line */}
      <line x1={PAD.left} y1={avgY} x2={PAD.left + plotW} y2={avgY}
        stroke="#D4AF37" strokeWidth="1.3" strokeDasharray="5 3" opacity="0.7"/>
      <text x={PAD.left + plotW + 6} y={avgY + 4} fontSize="9.5"
        fill="#C49A0B" fontFamily="var(--font-manrope)" fontWeight="700">avg</text>

      {/* Area fill + line */}
      <path d={areaPath} fill="url(#ins-fill)"/>
      <path d={linePath} fill="none" stroke="#0E7A52" strokeWidth="2.4" strokeLinecap="round"/>

      {/* Dots */}
      {pts.map(([x, y], i) => i !== peakIdx && (
        <circle key={i} cx={x} cy={y} r="4.5" fill="white" stroke="#0E7A52" strokeWidth="2"/>
      ))}

      {/* Peak callout */}
      {n > 1 && (() => {
        const bw = 66, bh = 24;
        const bx = Math.min(Math.max(pkX - bw / 2, PAD.left), PAD.left + plotW - bw);
        const by = pkY - bh - 12;
        return (
          <g>
            <rect x={bx} y={by} width={bw} height={bh} rx="8" fill="#0E7A52"/>
            <polygon points={`${pkX-5},${by+bh} ${pkX+5},${by+bh} ${pkX},${by+bh+7}`} fill="#0E7A52"/>
            <text x={pkX} y={by + bh/2 + 4.5} textAnchor="middle"
              fontSize="11" fill="white" fontFamily="var(--font-manrope)" fontWeight="800">
              {inr(data[peakIdx].amt, true)}
            </text>
            <circle cx={pkX} cy={pkY} r="9"  fill="white" stroke="#0E7A52" strokeWidth="1.5" opacity="0.3"/>
            <circle cx={pkX} cy={pkY} r="5.5" fill="white" stroke="#0E7A52" strokeWidth="2.2"/>
            <circle cx={pkX} cy={pkY} r="2.5" fill="#0E7A52"/>
          </g>
        );
      })()}

      {/* X labels */}
      {data.map((d, i) => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
          fontSize="11" fill="#9CA3AF" fontFamily="var(--font-manrope)" fontWeight="600">
          {d.label}
        </text>
      ))}

      {/* Y labels */}
      {yTicks.map(({ y, label }, i) => (
        <text key={i} x={PAD.left - 8} y={y + 4} textAnchor="end"
          fontSize="10" fill="#9CA3AF" fontFamily="var(--font-manrope)">
          {label}
        </text>
      ))}
    </svg>
  );
}
