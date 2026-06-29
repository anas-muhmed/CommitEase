'use client';

import Link from 'next/link';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, Search, X, Plus, Users,
  TrendingUp, AlertTriangle, IndianRupee, ArrowUpDown,
  SlidersHorizontal, Calendar, Download, MessageCircle,
  CheckSquare, Square, UtensilsCrossed,
} from 'lucide-react';
import AppLogo from '@/components/layout/AppLogo';
import { useEnrichedMembers } from '@/lib/hooks/useMembers';
import { MemberAvatar } from '@/components/ui/member-avatar';
import type { EnrichedMember } from '@/lib/api/members.api';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function inr(n: string | number, compact = false) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (compact && v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (compact && v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const m = Math.floor(days / 30);
  return m < 12 ? `${m}mo ago` : `${Math.floor(m / 12)}y ago`;
}

function buildReminderText(members: EnrichedMember[]): string {
  if (members.length === 1) {
    const m = members[0]!;
    const amt = inr(m.totalOutstanding);
    return `Assalamu Alaikum ${m.name},\n\nThis is a gentle reminder from our committee.\n\n📋 Dues Summary:\n• Outstanding: ${amt}\n• Months pending: ${m.overdueMonths}\n\nPlease make your contribution at your earliest convenience.\n\nJazakAllahu Khayran 🤲`;
  }
  const lines = members
    .map(m => `• ${m.name}: ${inr(m.totalOutstanding)} (${m.overdueMonths}mo)`)
    .join('\n');
  return `Assalamu Alaikum,\n\nGentle reminder from our committee — the following members have outstanding dues:\n\n${lines}\n\nKindly make your contributions when convenient.\n\nJazakAllahu Khayran 🤲`;
}

function exportCSV(members: EnrichedMember[]) {
  const cols = ['Name', 'Member Code', 'Phone', 'Address', 'Plan', 'Total Due', 'Overdue Months', 'Last Payment', 'Payment Score', 'Status'];
  const rows = members.map(m => [
    m.name, m.memberCode, m.phone, m.address ?? '',
    m.contributionPlan.name,
    parseFloat(m.totalOutstanding).toFixed(2),
    String(m.overdueMonths),
    m.lastPaymentDate ? new Date(m.lastPaymentDate).toLocaleDateString('en-IN') : 'Never',
    String(m.healthScore),
    !m.active ? 'Inactive' : parseFloat(m.totalOutstanding) > 0 ? 'Overdue' : 'Active',
  ]);
  const csv = [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── severity config ─────────────────────────────────────────────────────── */
function getSeverity(m: EnrichedMember) {
  const outstanding = parseFloat(m.totalOutstanding);
  if (!m.active)        return { label: 'Inactive',     bg: '#F3F4F6', color: '#6B7280', dot: '#D1D5DB', accent: null,      cardBorder: '#E5E7EB', cardBg: '#FAFAFA' };
  if (outstanding <= 0) return { label: 'On Track',     bg: '#E8F5EF', color: '#0B6644', dot: '#0E7A52', accent: null,      cardBorder: '#EEF0EE', cardBg: '#FAFBFA' };
  if (m.overdueMonths <= 2) return { label: 'Slight Delay', bg: '#FFFBEB', color: '#A16207', dot: '#D97706', accent: '#D97706', cardBorder: '#FDE68A', cardBg: '#FFFDF5' };
  if (m.overdueMonths <= 6) return { label: 'Pending',      bg: '#FFF7ED', color: '#9A3412', dot: '#EA580C', accent: '#EA580C', cardBorder: '#FED7AA', cardBg: '#FFFAF5' };
  return                     { label: 'Long Pending',   bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444', accent: '#EF4444', cardBorder: '#FECACA', cardBg: '#FFFAFA' };
}

/* ── types ───────────────────────────────────────────────────────────────── */
type StatusFilter  = 'all' | 'active' | 'inactive' | 'overdue';
type PaymentFilter = 'all' | 'paid_month' | 'unpaid' | 'long_pending';
type SortKey = 'highest_due' | 'most_overdue' | 'name' | 'newest' | 'last_payment';

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'active',   label: 'Active'   },
  { key: 'inactive', label: 'Inactive' },
  { key: 'overdue',  label: 'Overdue'  },
];

const PAYMENT_CHIPS: { key: PaymentFilter; label: string }[] = [
  { key: 'all',          label: 'All'              },
  { key: 'paid_month',   label: 'Paid this month'  },
  { key: 'unpaid',       label: 'Has dues'         },
  { key: 'long_pending', label: 'Long pending'     },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'highest_due',  label: 'Highest Due'       },
  { key: 'name',         label: 'Name A–Z'          },
  { key: 'newest',       label: 'Recently Joined'   },
  { key: 'last_payment', label: 'Last Payment'      },
  { key: 'most_overdue', label: 'Longest Unpaid'    },
];

/* ════════════════════════════════════════════════════════════════════════════
   Members Page
   ═══════════════════════════════════════════════════════════════════════════ */
export default function MembersPage() {
  const { data, isLoading } = useEnrichedMembers();
  const members = data?.members ?? [];
  const summary = data?.summary;

  // Search
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');

  // Active filters
  const [statusFilter, setStatus]   = useState<StatusFilter>('all');
  const [paymentFilter, setPayment] = useState<PaymentFilter>('all');
  const [planFilter, setPlan]       = useState<string>('all');

  // Draft filters (inside drawer before Apply)
  const [draftStatus, setDraftStatus]   = useState<StatusFilter>('all');
  const [draftPayment, setDraftPayment] = useState<PaymentFilter>('all');
  const [draftPlan, setDraftPlan]       = useState<string>('all');

  // UI state
  const [sort, setSort]         = useState<SortKey>('highest_due');
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort]     = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Bulk selection
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg]     = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 220);
    return () => clearTimeout(t);
  }, [search]);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset selection when exiting select mode
  useEffect(() => { if (!selectMode) setSelected(new Set()); }, [selectMode]);

  // Unique plans
  const plans = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of members) seen.set(m.contributionPlanId, m.contributionPlan.name);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [members]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = members;
    if (statusFilter === 'active')   list = list.filter(m => m.active);
    if (statusFilter === 'inactive') list = list.filter(m => !m.active);
    if (statusFilter === 'overdue')  list = list.filter(m => m.active && parseFloat(m.totalOutstanding) > 0);
    if (paymentFilter === 'paid_month')   list = list.filter(m => m.paidThisMonth);
    if (paymentFilter === 'unpaid')       list = list.filter(m => parseFloat(m.totalOutstanding) > 0);
    if (paymentFilter === 'long_pending') list = list.filter(m => m.overdueMonths > 6);
    if (planFilter !== 'all') list = list.filter(m => m.contributionPlanId === planFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.address ?? '').toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sort === 'name')         sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'newest')       sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sort === 'highest_due')  sorted.sort((a, b) => parseFloat(b.totalOutstanding) - parseFloat(a.totalOutstanding));
    if (sort === 'most_overdue') sorted.sort((a, b) => b.overdueMonths - a.overdueMonths);
    if (sort === 'last_payment') sorted.sort((a, b) => {
      const ta = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
      const tb = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
      return tb - ta;
    });
    return sorted;
  }, [members, statusFilter, paymentFilter, planFilter, debouncedSearch, sort]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0) + (planFilter !== 'all' ? 1 : 0);

  const openFilterDrawer = useCallback(() => {
    setDraftStatus(statusFilter);
    setDraftPayment(paymentFilter);
    setDraftPlan(planFilter);
    setShowFilter(true);
  }, [statusFilter, paymentFilter, planFilter]);

  const applyFilters = () => {
    setStatus(draftStatus);
    setPayment(draftPayment);
    setPlan(draftPlan);
    setShowFilter(false);
  };

  const clearAllFilters = () => {
    setStatus('all'); setPayment('all'); setPlan('all');
    setSearch(''); setDebounced('');
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedMembers = useMemo(() => members.filter(m => selected.has(m.id)), [members, selected]);

  const handleSendReminders = () => {
    const overdue = selectedMembers.filter(m => parseFloat(m.totalOutstanding) > 0);
    if (overdue.length === 0) { setToastMsg('No overdue members selected'); return; }

    if (overdue.length === 1) {
      const m = overdue[0]!;
      const text = buildReminderText([m]);
      const phone = m.phone.replace(/\D/g, '');
      const normalized = phone.startsWith('0') ? `91${phone.slice(1)}` : phone.startsWith('91') ? phone : `91${phone}`;
      window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(text)}`, '_blank');
      return;
    }

    const text = buildReminderText(overdue);
    void navigator.clipboard.writeText(text);
    setToastMsg(`Reminder text for ${overdue.length} members copied to clipboard`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleExportCSV = () => {
    exportCSV(selectedMembers.length > 0 ? selectedMembers : filtered);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F3]">

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 h-[72px] flex items-center justify-between">
          <div className="w-[220px]">
            <AppLogo />
          </div>
          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-2 rounded-full px-1 py-1 hover:bg-gray-50">
              <div className="w-[36px] h-[36px] rounded-full bg-[#0E7A52] flex items-center justify-center shrink-0">
                <span className="text-white text-[12px] font-bold">AA</span>
              </div>
              <div className="hidden sm:block text-left leading-none">
                <p className="text-[13.5px] font-semibold text-[#111827]">Admin</p>
                <p className="text-[11px] text-[#6B7280] mt-[2px]">Committee</p>
              </div>
              <ChevronDown size={13} className="hidden sm:block text-[#9CA3AF]" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 z-[60] flex items-center gap-3 bg-[#0E7A52] text-white rounded-[16px] px-4 py-3 shadow-lg max-w-[480px] mx-auto">
          <MessageCircle size={15} className="shrink-0" />
          <span className="text-[13px] font-semibold flex-1">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)}><X size={14} /></button>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-6 pb-28">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pt-5 pb-4">
          <div>
            <h1 className="text-[28px] md:text-[32px] font-extrabold text-[#111827] tracking-[-0.025em] leading-tight">Members</h1>
            <p className="text-[13px] font-medium text-[#6B7280] mt-1">
              {!isLoading && summary ? (
                <>{summary.total} total · {summary.activeMembers} active{summary.overdueCount > 0 && <> · <span className="text-[#DC2626] font-semibold">{summary.overdueCount} overdue</span></>}</>
              ) : <span className="inline-block w-32 h-4 bg-gray-100 rounded animate-pulse" />}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectMode(v => !v)}
              className={[
                'hidden sm:flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-3.5 py-2 border transition-all',
                selectMode ? 'bg-[#0E7A52] text-white border-[#0E7A52]' : 'text-[#6B7280] border-[#E8ECE8] hover:bg-gray-50',
              ].join(' ')}
            >
              {selectMode ? <CheckSquare size={13} /> : <Square size={13} />}
              {selectMode ? 'Cancel' : 'Select'}
            </button>
            <Link
              href="/members/new"
              className="hidden sm:flex items-center gap-2 bg-[#0E7A52] text-white text-[13px] font-semibold rounded-full px-4 py-2.5 hover:bg-[#0B6644] shadow-[0_2px_8px_rgba(14,122,82,.30)]"
            >
              <Plus size={14} strokeWidth={2.5} />
              Add Member
            </Link>
          </div>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <KPICard label="Total Members" value={isLoading ? null : (summary?.total ?? 0)} display="number"
            icon={<Users size={16} className="text-[#0E7A52]" />} iconBg="bg-[#E8F5EF]" />
          <KPICard label="Paying On Time" value={isLoading ? null : (summary?.payingOnTimePercent ?? 0)} display="percent"
            icon={<TrendingUp size={16} className="text-[#0E7A52]" />} iconBg="bg-[#E8F5EF]"
            valueColor={(summary?.payingOnTimePercent ?? 0) < 60 ? '#A16207' : '#0E7A52'} />
          <KPICard label="Overdue Members" value={isLoading ? null : (summary?.overdueCount ?? 0)} display="number"
            icon={<AlertTriangle size={16} className={(summary?.overdueCount ?? 0) > 0 ? 'text-[#DC2626]' : 'text-[#9CA3AF]'} />}
            iconBg={(summary?.overdueCount ?? 0) > 0 ? 'bg-[#FEF2F2]' : 'bg-[#F3F4F6]'}
            valueColor={(summary?.overdueCount ?? 0) > 0 ? '#DC2626' : undefined} />
          <KPICard label="Total Due" value={isLoading ? null : summary?.totalReceivable ?? '0'} display="currency"
            icon={<IndianRupee size={16} className={(summary?.overdueCount ?? 0) > 0 ? 'text-[#DC2626]' : 'text-[#9CA3AF]'} />}
            iconBg={(summary?.overdueCount ?? 0) > 0 ? 'bg-[#FEF2F2]' : 'bg-[#F3F4F6]'}
            valueColor={(summary?.overdueCount ?? 0) > 0 ? '#DC2626' : '#111827'} />
        </div>

        {/* ── Control bar: Search + Filter + Sort ─────────────────────────── */}
        <div className="flex items-center gap-2 mb-3">
          {/* Search */}
          <label className="flex-1 flex items-center gap-2.5 bg-white rounded-[14px] border border-[#E8ECE8] px-3.5 h-11 focus-within:border-[#0E7A52] focus-within:shadow-[0_0_0_3px_rgba(14,122,82,.10)] shadow-sm cursor-text transition-all">
            <Search size={15} className="text-[#9CA3AF] shrink-0" strokeWidth={2} />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search members…"
              className="flex-1 bg-transparent border-none outline-none text-[13.5px] font-medium text-[#111827] placeholder:text-[#9CA3AF]"
            />
            {search && (
              <button onClick={() => { setSearch(''); setDebounced(''); }} className="text-[#9CA3AF] hover:text-[#6B7280]">
                <X size={13} strokeWidth={2.2} />
              </button>
            )}
          </label>

          {/* Filter icon button */}
          <button
            onClick={openFilterDrawer}
            className={[
              'relative w-11 h-11 rounded-[14px] border flex items-center justify-center shadow-sm shrink-0 transition-all',
              activeFilterCount > 0 ? 'bg-[#0E7A52] border-[#0E7A52]' : 'bg-white border-[#E8ECE8] hover:border-[#C7D1C9]',
            ].join(' ')}
            aria-label="Open filters"
          >
            <SlidersHorizontal size={17} className={activeFilterCount > 0 ? 'text-white' : 'text-[#374151]'} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-[#0E7A52] text-[10px] font-bold flex items-center justify-center shadow-sm border border-[#C7EDD8]">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort icon button */}
          <div className="relative shrink-0" ref={sortRef}>
            <button
              onClick={() => setShowSort(v => !v)}
              className={[
                'w-11 h-11 rounded-[14px] border flex items-center justify-center shadow-sm transition-all',
                showSort ? 'bg-[#F0FBF6] border-[#0E7A52]' : 'bg-white border-[#E8ECE8] hover:border-[#C7D1C9]',
              ].join(' ')}
              aria-label="Sort options"
            >
              <ArrowUpDown size={17} className={showSort ? 'text-[#0E7A52]' : 'text-[#374151]'} />
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-[16px] shadow-[0_8px_32px_rgba(15,23,42,.12)] border border-gray-100 py-1.5 min-w-[196px]">
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    onClick={() => { setSort(o.key); setShowSort(false); }}
                    className={[
                      'w-full text-left px-4 py-2.5 text-[13px] font-semibold hover:bg-gray-50 flex items-center gap-2',
                      sort === o.key ? 'text-[#0E7A52]' : 'text-[#374151]',
                    ].join(' ')}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${sort === o.key ? 'border-[#0E7A52] bg-[#0E7A52]' : 'border-[#D1D5DB]'}`}>
                      {sort === o.key && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Results count ────────────────────────────────────────────────── */}
        {!isLoading && (
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[12.5px] font-semibold text-[#6B7280]">
              {filtered.length} member{filtered.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 || debouncedSearch ? (
                <button onClick={clearAllFilters} className="ml-2 text-[#0E7A52] hover:opacity-70">· Clear</button>
              ) : null}
            </p>
            {sort !== 'highest_due' && (
              <p className="text-[11.5px] font-medium text-[#9CA3AF]">
                Sorted: {SORT_OPTIONS.find(o => o.key === sort)?.label}
              </p>
            )}
          </div>
        )}

        {/* ── Member list ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <MemberCardSkeleton key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasSearch={!!debouncedSearch}
            hasFilter={activeFilterCount > 0}
            onClear={clearAllFilters}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                selectMode={selectMode}
                selected={selected.has(m.id)}
                onToggleSelect={() => toggleSelect(m.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── FAB (mobile) ─────────────────────────────────────────────────── */}
      {!selectMode && (
        <Link
          href="/members/new"
          className="sm:hidden fixed bottom-20 right-5 z-30 w-14 h-14 rounded-full bg-[#0E7A52] flex items-center justify-center shadow-[0_8px_32px_rgba(14,122,82,.40)] active:scale-95 transition-all"
          aria-label="Add member"
        >
          <Plus size={22} className="text-white" strokeWidth={2.5} />
        </Link>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────────── */}
      {selectMode && (
        <div className={`fixed bottom-20 left-4 right-4 z-50 max-w-[520px] mx-auto transition-all duration-200 ${selected.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div className="bg-[#111827] rounded-[20px] px-4 py-3 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,.30)]">
            <span className="text-[13px] font-bold text-white flex-1">{selected.size} selected</span>
            <button
              onClick={handleSendReminders}
              className="flex items-center gap-1.5 bg-[#25D366] text-white rounded-full px-3.5 py-2 text-[12.5px] font-bold hover:opacity-90"
            >
              <MessageCircle size={13} /> Remind
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-[#0E7A52] text-white rounded-full px-3.5 py-2 text-[12.5px] font-bold hover:opacity-90"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={() => setSelectMode(false)}
              className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Filter Drawer ────────────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${showFilter ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowFilter(false)}
      />

      {/* Sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[24px] shadow-[0_-4px_32px_rgba(15,23,42,.15)] transition-transform duration-300 max-h-[85vh] overflow-y-auto ${showFilter ? 'translate-y-0' : 'translate-y-full'}`}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-[4px] rounded-full bg-[#D1D5DB]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <p className="text-[17px] font-bold text-[#111827]">Filters</p>
          <button
            onClick={() => { setDraftStatus('all'); setDraftPayment('all'); setDraftPlan('all'); }}
            className="text-[13px] font-semibold text-[#6B7280] hover:text-[#0E7A52]"
          >
            Clear all
          </button>
        </div>

        {/* Groups */}
        <div className="px-5 space-y-5 pb-2">
          <FilterGroup label="Status" chips={STATUS_CHIPS} active={draftStatus} onSelect={setDraftStatus} />
          <FilterGroup label="Payment" chips={PAYMENT_CHIPS} active={draftPayment} onSelect={setDraftPayment} />
          {plans.length > 1 && (
            <FilterGroup
              label="Plan"
              chips={[{ key: 'all', label: 'All plans' }, ...plans.map(p => ({ key: p.id, label: p.name }))]}
              active={draftPlan}
              onSelect={setDraftPlan}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 mt-2 border-t border-[#F0F2EF]">
          <button
            onClick={applyFilters}
            className="w-full bg-[#0E7A52] text-white font-bold rounded-[14px] py-3.5 text-[14px] hover:bg-[#0B6644] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function FilterGroup<T extends string>({
  label, chips, active, onSelect,
}: { label: string; chips: { key: T; label: string }[]; active: T; onSelect: (k: T) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => onSelect(c.key)}
            className={[
              'rounded-full px-4 py-2 text-[12.5px] font-semibold transition-all',
              active === c.key
                ? 'bg-[#0E7A52] text-white shadow-[0_2px_8px_rgba(14,122,82,.28)]'
                : 'border border-[#E8ECE8] text-[#6B7280] hover:bg-gray-50',
            ].join(' ')}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function KPICard({ label, value, display, icon, iconBg, valueColor }: {
  label: string; value: number | string | null;
  display: 'number' | 'percent' | 'currency';
  icon: React.ReactNode; iconBg: string; valueColor?: string;
}) {
  const formatted = value === null ? null
    : display === 'percent'  ? `${value}%`
    : display === 'currency' ? inr(value as string, true)
    : String(value);

  return (
    <div className="bg-white rounded-[20px] shadow-[0_4px_16px_rgba(15,23,42,.06)] px-4 py-4">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
        <p className="text-[12.5px] font-semibold text-[#374151] leading-tight">{label}</p>
      </div>
      <div className="mt-3">
        {formatted === null ? (
          <div className="h-7 w-14 rounded-lg bg-gray-100 animate-pulse" />
        ) : (
          <p className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: valueColor ?? '#111827' }}>
            {formatted}
          </p>
        )}
      </div>
    </div>
  );
}

function MemberCard({ member: m, selectMode, selected, onToggleSelect }: {
  member: EnrichedMember;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const outstanding = parseFloat(m.totalOutstanding);
  const sev = getSeverity(m);
  const lastPaidLabel = m.lastPaymentDate ? `Last paid ${timeAgo(m.lastPaymentDate)}` : 'Never paid';

  const inner = (
    <div
      className={[
        'relative flex items-center gap-3 rounded-[16px] px-4 py-3.5 border transition-all duration-200',
        !selectMode && 'hover:-translate-y-px hover:shadow-[0_8px_28px_rgba(15,23,42,.09)] hover:border-[#D4E8DC]',
        'active:translate-y-0 active:scale-[0.998]',
        !m.active ? 'opacity-70' : '',
      ].join(' ')}
      style={{ background: sev.cardBg, borderColor: sev.cardBorder }}
    >
      {/* Left severity accent bar */}
      {sev.accent && (
        <div className="absolute left-0 top-[14px] bottom-[14px] w-[3px] rounded-full" style={{ background: sev.accent }} />
      )}

      {/* Checkbox or Avatar */}
      {selectMode ? (
        <div
          className={[
            'w-[22px] h-[22px] rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all',
            selected ? 'bg-[#0E7A52] border-[#0E7A52]' : 'bg-white border-[#D1D5DB]',
          ].join(' ')}
        >
          {selected && <span className="text-white text-[11px] font-bold">✓</span>}
        </div>
      ) : (
        <MemberAvatar name={m.name} size="md" />
      )}

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[14px] font-semibold text-[#111827] truncate">{m.name}</p>
          {!m.chelavParticipation && (
            <span title="Not in chelav rotation">
              <UtensilsCrossed size={12} color="#D97706" strokeWidth={2.2} />
            </span>
          )}
        </div>
        <p className="text-[12px] font-medium text-[#6B7280] mt-[2px] truncate">
          {m.memberCode}
          <span className="mx-1.5 text-[#C7CDD6]">·</span>
          {m.contributionPlan.name}
        </p>
        <p className="text-[11.5px] text-[#9CA3AF] mt-[3px] flex items-center gap-1.5">
          <Calendar size={11} />
          {lastPaidLabel}
        </p>
      </div>

      {/* Right: severity badge + amount */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-[100px]">
        <span
          className="inline-flex items-center gap-[5px] rounded-full px-2.5 py-[5px] text-[11px] font-semibold"
          style={{ background: sev.bg, color: sev.color }}
        >
          <span className="w-[5px] h-[5px] rounded-full" style={{ background: sev.dot }} />
          {sev.label}
        </span>

        {outstanding > 0 ? (
          <div className="text-right">
            <p className="text-[13px] font-bold tabular-nums" style={{ color: sev.color }}>
              {inr(m.totalOutstanding)}
            </p>
            {m.overdueMonths > 0 && (
              <p className="text-[10.5px] font-medium" style={{ color: sev.dot }}>{m.overdueMonths}mo overdue</p>
            )}
          </div>
        ) : (
          <p className="text-[11.5px] font-medium text-[#9CA3AF]">All clear</p>
        )}
      </div>

      {!selectMode && <ChevronRight size={15} className="text-[#D1D5DB] shrink-0" strokeWidth={2} />}
    </div>
  );

  if (selectMode) {
    return <button className="block w-full text-left" onClick={onToggleSelect}>{inner}</button>;
  }

  return <Link href={`/members/${m.id}`} className="block">{inner}</Link>;
}

function MemberCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-[16px] px-4 py-4 bg-white border border-[#EEF0EE]">
      <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-[14px] w-36 rounded-lg bg-gray-100 animate-pulse" />
        <div className="h-[12px] w-24 rounded-lg bg-gray-100 animate-pulse" />
        <div className="h-[11px] w-20 rounded-lg bg-gray-100 animate-pulse" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-[22px] w-24 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-[14px] w-16 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState({ hasSearch, hasFilter, onClear }: { hasSearch: boolean; hasFilter: boolean; onClear: () => void }) {
  const isEmpty = !hasSearch && !hasFilter;
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-[0_4px_16px_rgba(15,23,42,.07)]">
        <Users size={22} className="text-[#9CA3AF]" />
      </div>
      <div>
        <p className="text-[16px] font-bold text-[#111827]">{isEmpty ? 'No members yet' : 'No members found'}</p>
        <p className="text-[13px] font-medium text-[#6B7280] mt-1">
          {isEmpty ? 'Add your first member to get started' : 'Try adjusting your search or filters'}
        </p>
      </div>
      {isEmpty ? (
        <Link href="/members/new" className="flex items-center gap-2 bg-[#0E7A52] text-white text-[13px] font-semibold rounded-full px-5 py-2.5 shadow-[0_2px_8px_rgba(14,122,82,.30)]">
          <Plus size={14} strokeWidth={2.5} /> Add first member
        </Link>
      ) : (
        <button onClick={onClear} className="text-[13px] font-semibold text-[#0E7A52] hover:opacity-70">
          Clear all filters
        </button>
      )}
    </div>
  );
}
