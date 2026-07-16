'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, AlertTriangle, Clock, ChevronRight,
  ReceiptText, LogOut, X, Bell, Calendar,
  Banknote, Building2, Smartphone, Globe, RotateCcw, Phone,
} from 'lucide-react';
import { getMemberHome } from '@/lib/api/member.api';
import { memberLogout } from '@/lib/api/member-auth.api';
import { useMemberAuthStore } from '@/lib/store/member-auth.store';
import PaymentIntentSheet from '@/components/portal/PaymentIntentSheet';
import type { ActivityEntry } from '@/lib/api/member.api';

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtAmount(s: string): string {
  return `₹${parseFloat(s).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function fmtNextTurn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const PWA_DISMISS_KEY = 'commitease_pwa_dismissed';

// ─── Activity mode icon ───────────────────────────────────────────────────────

function ModeIcon({ entry }: { entry: ActivityEntry }) {
  if (entry.type === 'REVERSED') {
    return <div style={iconBox('#FEF2F2')}><RotateCcw size={17} color="#EF4444" /></div>;
  }
  const map: Record<string, { icon: React.ReactNode; bg: string }> = {
    'Cash':          { icon: <Banknote   size={17} color="#F59E0B" />, bg: '#FFFBEB' },
    'Bank Transfer': { icon: <Building2  size={17} color="#3B82F6" />, bg: '#EFF6FF' },
    'UPI':           { icon: <Smartphone size={17} color="#8B5CF6" />, bg: '#EDE9FE' },
    'Online':        { icon: <Globe      size={17} color="#3B82F6" />, bg: '#EFF6FF' },
  };
  const cfg = map[entry.paymentMode] ?? { icon: <CheckCircle2 size={17} color="#15803D" />, bg: '#ECFDF5' };
  return <div style={iconBox(cfg.bg)}>{cfg.icon}</div>;
}

function iconBox(bg: string): React.CSSProperties {
  return { width: 38, height: 38, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
}

// ─── Profile Sheet ────────────────────────────────────────────────────────────

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { member, clear } = useMemberAuthStore();

  async function handleLogout() {
    await memberLogout();
    clear();
    router.replace('/portal/login');
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201, background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '0 24px 48px', boxShadow: '0 -16px 48px rgba(0,0,0,0.14)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0D3D26', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>{(member?.name ?? 'M')[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>{member?.name ?? '—'}</p>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{member?.masjidName ?? ''}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#94A3B8', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ borderTop: '1px solid #F1F5F9' }}>
          {[
            { label: 'Member Code', value: member?.memberCode ?? '—' },
            { label: 'Phone',       value: member?.phone ?? '—'       },
            { label: 'Mosque',      value: member?.masjidName ?? '—'  },
            { label: 'Plan',        value: member?.planName ?? '—'    },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 14, color: '#64748B' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => void handleLogout()}
          style={{ width: '100%', height: 50, borderRadius: 16, marginTop: 20, background: '#FEF2F2', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#EF4444', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <LogOut size={16} />
          Log Out
        </button>
      </div>
    </>
  );
}

// ─── Financial Hero Card ──────────────────────────────────────────────────────

type Financial = Awaited<ReturnType<typeof getMemberHome>>['financial'];

function FinancialHeroCard({ financial, onPayNow, onViewHistory }: {
  financial: Financial;
  onPayNow: () => void;
  onViewHistory: () => void;
}) {
  const { isAllClear, overdueMonths, totalOutstanding } = financial;
  const isCritical = overdueMonths > 3;

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '22px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: isAllClear ? '#DCFCE7' : isCritical ? '#FEF2F2' : '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isAllClear
              ? <CheckCircle2 size={14} color="#16A34A" />
              : isCritical ? <AlertTriangle size={13} color="#EF4444" /> : <Clock size={13} color="#F59E0B" />
            }
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: isAllClear ? '#16A34A' : isCritical ? '#EF4444' : '#F59E0B' }}>
            {isAllClear ? 'All Clear' : overdueMonths > 0 ? `${overdueMonths} month${overdueMonths > 1 ? 's' : ''} overdue` : 'Dues pending'}
          </span>
        </div>
        <button onClick={onViewHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#CBD5E1', display: 'flex' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Amount */}
      <p style={{ fontSize: 44, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: -2, lineHeight: 1 }}>
        {fmtAmount(totalOutstanding)}
      </p>
      <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 20px', fontWeight: 500 }}>
        {isAllClear ? 'No outstanding dues' : 'Outstanding Balance'}
      </p>

      {/* Pay Now — only when balance exists */}
      {!isAllClear && (
        <button
          onClick={onPayNow}
          style={{
            width: '100%', height: 50, borderRadius: 14,
            background: 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 15, fontWeight: 700, color: '#FFFFFF',
            boxShadow: '0 6px 20px rgba(21,128,61,0.28)',
            marginBottom: 16,
          }}
        >
          Pay Now
        </button>
      )}

      {/* Last payment line */}
      {financial.lastPaymentAt && (
        <div style={{ paddingTop: isAllClear ? 16 : 0, borderTop: isAllClear ? '1px solid #F1F5F9' : 'none' }}>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
            Last payment — <strong style={{ color: '#64748B', fontWeight: 600 }}>{fmtDate(financial.lastPaymentAt)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Payment Trust Card ───────────────────────────────────────────────────────

function PaymentTrustCard({ activity }: { activity: ActivityEntry | undefined }) {
  if (!activity || activity.type === 'REVERSED') {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Clock size={16} color="#94A3B8" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#64748B', margin: '0 0 2px' }}>No payment recorded yet</p>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Your committee records payments on your behalf.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CheckCircle2 size={16} color="#16A34A" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 2px' }}>Last payment recorded</p>
        <p style={{ fontSize: 12, color: '#64748B', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fmtAmount(activity.amount)} via {activity.paymentMode} · {fmtDate(activity.date)}
          {activity.receiptNumber ? ` · ${activity.receiptNumber}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Chelav Preview Card ──────────────────────────────────────────────────────

function ChelavPreviewCard({ chelav }: { chelav: NonNullable<Awaited<ReturnType<typeof getMemberHome>>['chelav']> }) {
  const router = useRouter();

  const days = chelav.nextTurn ? daysUntil(chelav.nextTurn.date) : null;

  const countdownLabel = days === null ? null
    : days === 0 ? 'Today'
    : days === 1 ? 'Tomorrow'
    : `in ${days} days`;

  return (
    <button
      onClick={() => router.push('/portal/chelav')}
      style={{ width: '100%', background: '#FFFFFF', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 12, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Calendar size={18} color="#15803D" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {chelav.nextTurn ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.7 }}>Your Next Turn</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>{fmtNextTurn(chelav.nextTurn.date)}</p>
          </>
        ) : chelav.today?.isMe ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#15803D', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.7 }}>Today</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>It&apos;s your chelav today</p>
          </>
        ) : (
          <p style={{ fontSize: 14, fontWeight: 500, color: '#64748B', margin: 0 }}>No upcoming chelav assignment</p>
        )}
      </div>

      {countdownLabel && (
        <span style={{ fontSize: 12, fontWeight: 700, color: days === 0 ? '#15803D' : '#64748B', background: days === 0 ? '#DCFCE7' : '#F1F5F9', padding: '4px 10px', borderRadius: 100, flexShrink: 0 }}>
          {countdownLabel}
        </span>
      )}

      <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── Compact Activity Row ─────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const router = useRouter();
  const isReversed = entry.type === 'REVERSED';

  return (
    <button
      onClick={() => router.push(`/portal/receipts/${entry.id}`)}
      style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', textAlign: 'left' }}
    >
      <ModeIcon entry={entry} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isReversed ? 'Payment Reversed' : entry.paymentMode}
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{fmtDate(entry.date)}</p>
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: isReversed ? '#EF4444' : '#0F172A', margin: 0, letterSpacing: -0.4, flexShrink: 0 }}>
        {isReversed ? `−${fmtAmount(entry.amount)}` : fmtAmount(entry.amount)}
      </p>
      <ChevronRight size={14} color="#E2E8F0" style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── PWA Banner ───────────────────────────────────────────────────────────────

function PwaBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(PWA_DISMISS_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(PWA_DISMISS_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{ background: '#ECFDF5', borderRadius: 14, border: '1px solid rgba(21,128,61,0.12)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Phone size={15} color="#15803D" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 1px' }}>Open faster next time</p>
        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Add CommitEase to your home screen</p>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0, display: 'flex' }}>
        <X size={15} />
      </button>
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export default function PortalHomePage() {
  const router = useRouter();
  const { member } = useMemberAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showPaySheet, setShowPaySheet] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['member-home'],
    queryFn: getMemberHome,
    staleTime: 60_000,
  });

  if (isLoading) return <HomeSkeleton />;

  if (isError) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, background: '#F8FAFB' }}>
        <AlertTriangle size={40} color="#EF4444" />
        <p style={{ fontSize: 15, color: '#64748B', textAlign: 'center', margin: 0 }}>Could not load your account. Pull to refresh.</p>
      </div>
    );
  }

  const firstName = (member?.name ?? data?.member.name ?? '').split(' ')[0] ?? '';
  const masjidName = member?.masjidName ?? data?.member.masjidName ?? '';
  const overdueCount = data?.financial.overdueMonths ?? 0;
  const totalDue = data?.financial.totalOutstanding ?? '0';
  const lastPayment = data?.recentActivity.find((a) => a.type === 'PAYMENT');

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} />}
      <PaymentIntentSheet
        open={showPaySheet}
        onClose={() => setShowPaySheet(false)}
        totalDue={totalDue}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#0D3D26', padding: '52px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', margin: 0, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {masjidName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => router.push('/portal/history')}
                style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Bell size={17} color="rgba(255,255,255,0.70)" />
              </button>
              {overdueCount > 0 && (
                <div style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', border: '2px solid #0D3D26', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{overdueCount > 9 ? '9+' : overdueCount}</span>
                </div>
              )}
            </div>
            {/* Avatar */}
            <button
              onClick={() => setShowProfile(true)}
              style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>{firstName[0]?.toUpperCase() ?? 'M'}</span>
            </button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.48)', margin: '0 0 3px' }}>Assalamu Alaikum,</p>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: -0.8, lineHeight: 1.1 }}>
          {firstName || 'Welcome'}
        </h1>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 1. Financial hero card */}
        {data && (
          <FinancialHeroCard
            financial={data.financial}
            onPayNow={() => setShowPaySheet(true)}
            onViewHistory={() => router.push('/portal/history')}
          />
        )}

        {/* 2. Payment trust card */}
        {data && <PaymentTrustCard activity={lastPayment} />}

        {/* 3. Chelav preview card */}
        {data?.chelav && <ChelavPreviewCard chelav={data.chelav} />}

        {/* 4. Recent activity — last 3 */}
        {(data?.recentActivity?.length ?? 0) > 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: 18, padding: '4px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 2px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Recent Activity</h2>
              <button
                onClick={() => router.push('/portal/history')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#15803D', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3, padding: 0 }}
              >
                View all <ChevronRight size={13} />
              </button>
            </div>
            {data!.recentActivity.slice(0, 3).map((event, i, arr) => (
              <div key={event.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid #F8FAFB' : 'none' }}>
                <ActivityRow entry={event} />
              </div>
            ))}
          </div>
        )}

        {/* 5. PWA install banner */}
        <PwaBanner />

      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      <div style={{ background: '#0D3D26', padding: '52px 20px 24px' }}>
        <div style={{ height: 12, width: 100, background: 'rgba(255,255,255,0.10)', borderRadius: 4, marginBottom: 20 }} />
        <div style={{ height: 12, width: 130, background: 'rgba(255,255,255,0.10)', borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 32, width: 160, background: 'rgba(255,255,255,0.10)', borderRadius: 6 }} />
      </div>
      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ height: 148, background: '#FFFFFF', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 68, background: '#FFFFFF', borderRadius: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 68, background: '#FFFFFF', borderRadius: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 168, background: '#FFFFFF', borderRadius: 18, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
