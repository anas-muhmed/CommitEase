'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, AlertTriangle, Clock, ChevronRight,
  ReceiptText, UtensilsCrossed, Phone, LogOut, X,
  Bell, Calendar, Banknote, Building2, Smartphone, Globe, RotateCcw,
} from 'lucide-react';
import { getMemberHome } from '@/lib/api/member.api';
import { memberLogout } from '@/lib/api/member-auth.api';
import { useMemberAuthStore } from '@/lib/store/member-auth.store';
import type { ActivityEntry } from '@/lib/api/member.api';

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtAmount(s: string): string {
  return `₹${parseFloat(s).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtNextTurnDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function fmtDayOfWeek(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
}

// ─── Activity icon mapping ────────────────────────────────────────────────────

function ActivityIcon({ entry }: { entry: ActivityEntry }) {
  if (entry.type === 'REVERSED') {
    return (
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <RotateCcw size={18} color="#EF4444" />
      </div>
    );
  }
  const map: Record<string, { icon: React.ReactNode; bg: string }> = {
    'Cash':          { icon: <Banknote size={18} color="#F59E0B" />, bg: '#FFFBEB' },
    'Bank Transfer': { icon: <Building2 size={18} color="#3B82F6" />, bg: '#EFF6FF' },
    'UPI':           { icon: <Smartphone size={18} color="#8B5CF6" />, bg: '#EDE9FE' },
    'Online':        { icon: <Globe size={18} color="#3B82F6" />, bg: '#EFF6FF' },
  };
  const cfg = map[entry.paymentMode] ?? { icon: <CheckCircle2 size={18} color="#15803D" />, bg: '#ECFDF5' };
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {cfg.icon}
    </div>
  );
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

  const rows = [
    { label: 'Member Code', value: member?.memberCode ?? '—' },
    { label: 'Phone', value: member?.phone ?? '—' },
    { label: 'Mosque', value: member?.masjidName ?? '—' },
    { label: 'Plan', value: member?.planName ?? '—' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#FFFFFF', borderRadius: '28px 28px 0 0',
        padding: '0 24px 48px',
        boxShadow: '0 -20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #15803D, #0E6B43)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{(member?.name ?? 'M')[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0 }}>{member?.name ?? '—'}</p>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{member?.masjidName ?? ''}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#94A3B8' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ borderTop: '1px solid #F1F5F9' }}>
          {rows.map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 14, color: '#64748B' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{value}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => void handleLogout()}
          style={{ width: '100%', height: 52, borderRadius: 18, marginTop: 24, background: '#FEF2F2', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#EF4444', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <LogOut size={17} />
          Log Out
        </button>
      </div>
    </>
  );
}

// ─── Status Card ──────────────────────────────────────────────────────────────

type FinancialData = Awaited<ReturnType<typeof getMemberHome>>['financial'];

function StatusCard({ financial, onClick }: { financial: FinancialData | undefined; onClick: () => void }) {
  const isAllClear = financial?.isAllClear ?? true;
  const overdueMonths = financial?.overdueMonths ?? 0;
  const outstanding = financial?.totalOutstanding ?? '0';
  const lastPaymentAt = financial?.lastPaymentAt;
  const isCritical = overdueMonths > 3;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: '#FFFFFF', borderRadius: 24,
        padding: '22px 22px 18px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Decorative illustration */}
      <div style={{ position: 'absolute', right: -8, top: -8, opacity: 0.08, pointerEvents: 'none' }}>
        <svg width="100" height="90" viewBox="0 0 100 90" fill="none">
          <rect x="10" y="32" width="72" height="48" rx="12" fill="#0F172A"/>
          <rect x="10" y="42" width="72" height="38" rx="10" fill="#0F172A"/>
          <rect x="56" y="48" width="26" height="22" rx="6" fill="#64748B"/>
          <circle cx="69" cy="59" r="5" fill="#C9A54C"/>
          <ellipse cx="30" cy="34" rx="14" ry="5.5" fill="#C9A54C"/>
          <ellipse cx="30" cy="28" rx="14" ry="5.5" fill="#C9A54C"/>
          <ellipse cx="30" cy="22" rx="14" ry="5.5" fill="#C9A54C"/>
          <ellipse cx="30" cy="17" rx="14" ry="5.5" fill="#C9A54C"/>
        </svg>
      </div>

      {/* Chevron */}
      <div style={{ position: 'absolute', top: 22, right: 20 }}>
        <ChevronRight size={18} color="#CBD5E1" />
      </div>

      {isAllClear ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#16A34A" />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', letterSpacing: 0.5 }}>All Clear</span>
          </div>
          <p style={{ fontSize: 40, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', letterSpacing: -1.5, lineHeight: 1 }}>₹0</p>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>No outstanding dues</p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: isCritical ? '#FEF2F2' : '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isCritical ? <AlertTriangle size={15} color="#EF4444" /> : <Clock size={15} color="#F59E0B" />}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: isCritical ? '#EF4444' : '#F59E0B', letterSpacing: 0.3 }}>
              {overdueMonths > 0 ? `${overdueMonths} month${overdueMonths > 1 ? 's' : ''} overdue` : 'Dues pending'}
            </span>
          </div>
          <p style={{ fontSize: 48, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', letterSpacing: -2, lineHeight: 1 }}>
            {fmtAmount(outstanding)}
          </p>
          <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 18px' }}>Outstanding Balance</p>
          <a
            href="tel:"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 40, paddingLeft: 16, paddingRight: 16, borderRadius: 12,
              background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 13, fontWeight: 700, color: '#EF4444', textDecoration: 'none',
            }}
          >
            <Phone size={13} />
            Contact Committee
          </a>
        </>
      )}

      {lastPaymentAt && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
            Last payment — <strong style={{ color: '#64748B' }}>{fmtDate(lastPaymentAt)}</strong>
          </p>
        </div>
      )}
    </button>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ event }: { event: ActivityEntry }) {
  const isReversed = event.type === 'REVERSED';
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18, padding: '16px 18px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <ActivityIcon entry={event} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: mode + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            {isReversed ? 'Payment Reversed' : event.paymentMode}
          </p>
          <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, flexShrink: 0, marginLeft: 8 }}>{fmtDate(event.date)}</p>
        </div>
        {/* Description */}
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 6px', lineHeight: 1.4 }}>
          {event.description}
        </p>
        {/* Receipt chip + amount row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {event.receiptNumber ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F8FAFB', borderRadius: 7, padding: '2px 8px' }}>
              <ReceiptText size={11} color="#94A3B8" />
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{event.receiptNumber}</span>
            </div>
          ) : <span />}
          <p style={{ fontSize: 16, fontWeight: 800, color: isReversed ? '#EF4444' : '#0F172A', margin: 0, letterSpacing: -0.5 }}>
            {isReversed ? `−${fmtAmount(event.amount)}` : fmtAmount(event.amount)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Chelav Card ──────────────────────────────────────────────────────────────

function ChelavCard({ chelav }: { chelav: NonNullable<Awaited<ReturnType<typeof getMemberHome>>['chelav']> }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/portal/chelav')}
      style={{
        width: '100%', background: '#FFFFFF', borderRadius: 18,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        padding: '18px 18px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Decorative calendar bg */}
      <div style={{ position: 'absolute', right: -4, top: -4, opacity: 0.05, pointerEvents: 'none' }}>
        <Calendar size={88} color="#0F172A" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Calendar size={22} color="#15803D" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {chelav.nextTurn ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Your Next Turn
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 1px', letterSpacing: -0.5, lineHeight: 1.1 }}>
                {fmtNextTurnDate(chelav.nextTurn.date)}
              </p>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                {fmtDayOfWeek(chelav.nextTurn.date)}
              </p>
            </>
          ) : chelav.today ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#15803D', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.6 }}>Today</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', margin: '0 0 1px' }}>{chelav.today.displayLabel}</p>
              {chelav.today.isMe && <p style={{ fontSize: 13, color: '#15803D', margin: 0, fontWeight: 600 }}>← That&apos;s you!</p>}
            </>
          ) : (
            <p style={{ fontSize: 15, fontWeight: 600, color: '#64748B', margin: 0 }}>No upcoming assignment</p>
          )}
        </div>

        <ChevronRight size={18} color="#CBD5E1" style={{ flexShrink: 0, position: 'relative' }} />
      </div>
    </button>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export default function PortalHomePage() {
  const router = useRouter();
  const { member } = useMemberAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

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
        <p style={{ fontSize: 15, color: '#64748B', textAlign: 'center' }}>Could not load your account. Please try again.</p>
      </div>
    );
  }

  const firstName = (member?.name ?? data?.member.name ?? '').split(' ')[0] ?? '';
  const masjidName = member?.masjidName ?? data?.member.masjidName ?? '';
  const overdueCount = data?.financial.overdueMonths ?? 0;

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} />}

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)',
        padding: '52px 24px 80px',
        position: 'relative',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', margin: 0, fontWeight: 500 }}>
            {masjidName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Bell with badge */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => router.push('/portal/history')}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Bell size={18} color="rgba(255,255,255,0.75)" />
              </button>
              {overdueCount > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#EF4444', border: '2px solid #06251c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{overdueCount > 9 ? '9+' : overdueCount}</span>
                </div>
              )}
            </div>
            {/* Avatar */}
            <button
              onClick={() => setShowProfile(true)}
              style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.10)', border: '1.5px solid rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF' }}>{firstName[0]?.toUpperCase() ?? 'M'}</span>
            </button>
          </div>
        </div>

        {/* Greeting */}
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.50)', margin: '0 0 4px', fontWeight: 400 }}>
          Assalamu Alaikum,
        </p>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#FFFFFF', margin: '0 0 36px', letterSpacing: -1, lineHeight: 1.1 }}>
          {firstName || 'Welcome'}
        </h1>

        {/* Status card — overlaps hero */}
        <div style={{ position: 'absolute', bottom: -1, left: 20, right: 20 }}>
          <StatusCard financial={data?.financial} onClick={() => router.push('/portal/history')} />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Spacer for overlapping status card */}
        <div style={{ height: 140 }} />

        {/* Install banner */}
        {showBanner && (
          <div style={{
            background: '#ECFDF5', borderRadius: 16, border: '1px solid rgba(21,128,61,0.15)',
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Phone size={15} color="#15803D" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#15803D', margin: '0 0 1px' }}>Open faster next time</p>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Add CommitEase to your home screen</p>
            </div>
            <button
              style={{ height: 34, paddingLeft: 14, paddingRight: 14, borderRadius: 10, background: '#15803D', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#FFFFFF', fontFamily: 'inherit', flexShrink: 0 }}
              onClick={() => setShowBanner(false)}
            >
              Add Now
            </button>
            <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8', flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* Recent Activity */}
        {(data?.recentActivity?.length ?? 0) > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.3 }}>Recent Activity</h2>
              <button onClick={() => router.push('/portal/history')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#15803D', fontFamily: 'inherit', padding: 0 }}>
                View all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data!.recentActivity.map((event, i) => <ActivityCard key={i} event={event} />)}
            </div>
          </section>
        )}

        {/* Chelav */}
        {data?.chelav && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.3 }}>Chelav</h2>
              <ChevronRight size={18} color="#94A3B8" />
            </div>
            <ChelavCard chelav={data.chelav} />
          </section>
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      <div style={{ background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)', padding: '52px 24px 80px', position: 'relative' }}>
        <div style={{ height: 16, width: 100, background: 'rgba(255,255,255,0.1)', borderRadius: 6, marginBottom: 24 }} />
        <div style={{ height: 16, width: 140, background: 'rgba(255,255,255,0.1)', borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 40, width: 180, background: 'rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 36 }} />
        <div style={{ position: 'absolute', bottom: -1, left: 20, right: 20, height: 148, background: '#FFFFFF', borderRadius: 24, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ padding: '156px 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1,2,3].map((i) => <div key={i} style={{ height: 84, background: '#FFFFFF', borderRadius: 18, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    </div>
  );
}
