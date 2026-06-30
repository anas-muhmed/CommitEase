'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, AlertTriangle, Clock, ChevronRight,
  ReceiptText, UtensilsCrossed, Phone, LogOut, X, ArrowRight,
} from 'lucide-react';
import { getMemberHome } from '@/lib/api/member.api';
import { memberLogout } from '@/lib/api/member-auth.api';
import { useMemberAuthStore } from '@/lib/store/member-auth.store';
import type { ActivityEntry } from '@/lib/api/member.api';

// ─── Utils ────────────────────────────────────────────────────────────────────

function fmtAmount(s: string): string {
  const n = parseFloat(s);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtChelavDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

const MODE_EMOJI: Record<string, string> = {
  'Cash': '💵', 'Online': '🌐', 'Bank Transfer': '🏦', 'UPI': '📱',
};

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
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #15803D, #0E6B43)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>
                {(member?.name ?? 'M')[0]?.toUpperCase()}
              </span>
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

        {/* Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid #F1F5F9' }}>
          {rows.map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontSize: 14, color: '#64748B' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => void handleLogout()}
          style={{
            width: '100%', height: 52, borderRadius: 18, marginTop: 24,
            background: '#FEF2F2', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: '#EF4444', fontWeight: 700, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <LogOut size={17} />
          Log Out
        </button>
      </div>
    </>
  );
}

// ─── Status Card ──────────────────────────────────────────────────────────────

function StatusCard({ financial }: { financial: NonNullable<ReturnType<typeof getMemberHome> extends Promise<infer T> ? T : never>['financial'] | undefined }) {
  const isAllClear = financial?.isAllClear ?? true;
  const overdueMonths = financial?.overdueMonths ?? 0;
  const outstanding = financial?.totalOutstanding ?? '0';
  const lastPaymentAt = financial?.lastPaymentAt;
  const isCritical = overdueMonths > 3;

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 28,
      padding: '28px 24px 20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.08)',
    }}>
      {isAllClear ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="#16A34A" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A', letterSpacing: 0.3 }}>ALL CLEAR</span>
          </div>
          <p style={{ fontSize: 38, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: -1 }}>₹0</p>
          <p style={{ fontSize: 15, color: '#64748B', margin: 0 }}>No outstanding dues</p>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: isCritical ? '#FEF2F2' : '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isCritical ? <AlertTriangle size={17} color="#EF4444" /> : <Clock size={17} color="#F59E0B" />}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: isCritical ? '#EF4444' : '#F59E0B', letterSpacing: 0.3 }}>
              {overdueMonths > 0 ? `${overdueMonths} MONTH${overdueMonths > 1 ? 'S' : ''} OVERDUE` : 'DUES PENDING'}
            </span>
          </div>
          <p style={{ fontSize: 48, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', lineHeight: 1, letterSpacing: -2 }}>
            {fmtAmount(outstanding)}
          </p>
          <p style={{ fontSize: 15, color: '#64748B', margin: '0 0 20px' }}>outstanding balance</p>
          <a
            href="tel:"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 44, paddingLeft: 18, paddingRight: 18,
              borderRadius: 14, background: '#FEF2F2',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 14, fontWeight: 700, color: '#EF4444',
              textDecoration: 'none',
            }}
          >
            <Phone size={14} />
            Contact Committee
          </a>
        </>
      )}

      {lastPaymentAt && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
            Last payment — <strong style={{ color: '#64748B' }}>{fmtDate(lastPaymentAt)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Activity Card ────────────────────────────────────────────────────────────

function ActivityCard({ event }: { event: ActivityEntry }) {
  const isReversed = event.type === 'REVERSED';
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 20,
      padding: '18px 18px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: isReversed ? '#FEF2F2' : '#ECFDF5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20,
      }}>
        {isReversed ? '↩️' : (MODE_EMOJI[event.paymentMode] ?? '💳')}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 3px', lineHeight: 1.3 }}>
              {isReversed ? 'Payment Reversed' : event.description}
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 6px' }}>{fmtDate(event.date)}</p>
            {!isReversed && event.description !== event.paymentMode && (
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 4px', lineHeight: 1.4 }}>
                {event.paymentMode}
              </p>
            )}
            {event.receiptNumber && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F8FAFB', borderRadius: 8, padding: '3px 8px' }}>
                <ReceiptText size={11} color="#94A3B8" />
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>{event.receiptNumber}</span>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: isReversed ? '#EF4444' : '#0F172A', margin: 0, letterSpacing: -0.5 }}>
              {isReversed ? `−${fmtAmount(event.amount)}` : fmtAmount(event.amount)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chelav Preview ───────────────────────────────────────────────────────────

function ChelavCard({ chelav }: { chelav: NonNullable<Awaited<ReturnType<typeof getMemberHome>>['chelav']> }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/portal/chelav')}
      style={{
        width: '100%', background: '#FFFFFF', borderRadius: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '18px 18px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <UtensilsCrossed size={20} color="#15803D" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 3px', fontWeight: 500 }}>Chelav Schedule</p>
          {chelav.today ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Today: {chelav.today.displayLabel}
                {chelav.today.isMe && <span style={{ fontSize: 12, color: '#15803D', marginLeft: 8 }}>← You</span>}
              </p>
            </>
          ) : (
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>No assignment today</p>
          )}
          {chelav.nextTurn && (
            <p style={{ fontSize: 13, color: '#15803D', margin: '4px 0 0', fontWeight: 600 }}>
              Your turn: {fmtChelavDate(chelav.nextTurn.date)}
            </p>
          )}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronRight size={16} color="#94A3B8" />
        </div>
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

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} />}

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)',
        padding: '56px 24px 72px',
        position: 'relative',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px', fontWeight: 500, letterSpacing: 0.3 }}>
              {data?.member.masjidName ?? ''}
            </p>
          </div>
          {/* Avatar */}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.10)',
              border: '1.5px solid rgba(255,255,255,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
              {firstName[0]?.toUpperCase() ?? 'M'}
            </span>
          </button>
        </div>

        {/* Greeting */}
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px', fontWeight: 400 }}>
          Assalamu Alaikum,
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: '#FFFFFF', margin: '0 0 32px', letterSpacing: -1, lineHeight: 1.1 }}>
          {firstName || 'Welcome'}
        </h1>

        {/* Status card — overlaps into content below */}
        <div style={{ position: 'absolute', bottom: -1, left: 24, right: 24 }}>
          <StatusCard financial={data?.financial} />
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Spacer for the overlapping card */}
        <div style={{ height: 132 }} />

        {/* Add-to-home banner */}
        {showBanner && (
          <div style={{
            background: '#ECFDF5', borderRadius: 18,
            border: '1px solid rgba(21,128,61,0.15)',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Phone size={16} color="#15803D" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#15803D', margin: '0 0 2px' }}>Open faster next time</p>
              <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Add CommitEase to your home screen</p>
            </div>
            <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94A3B8' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* Recent Activity */}
        {(data?.recentActivity?.length ?? 0) > 0 && (
          <section>
            <SectionHeader title="Recent Activity" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data!.recentActivity.map((event, i) => (
                <ActivityCard key={i} event={event} />
              ))}
            </div>
          </section>
        )}

        {/* Chelav */}
        {data?.chelav && (
          <section>
            <SectionHeader title="Chelav" />
            <ChelavCard chelav={data.chelav} />
          </section>
        )}

        {/* Full history CTA */}
        <button
          onClick={() => router.push('/portal/history')}
          style={{
            width: '100%', background: '#FFFFFF', borderRadius: 18,
            border: '1px solid #E2E8F0', padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', margin: '0 0 2px' }}>Payment History</p>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>View all dues and receipts</p>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={15} color="#94A3B8" />
          </div>
        </button>

      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0F172A', margin: '0 0 14px', letterSpacing: -0.3 }}>
      {title}
    </h2>
  );
}

function HomeSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      <div style={{ background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)', padding: '56px 24px 72px', position: 'relative' }}>
        <div style={{ height: 20, width: 120, background: 'rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 28 }} />
        <div style={{ height: 20, width: 160, background: 'rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ height: 44, width: 200, background: 'rgba(255,255,255,0.1)', borderRadius: 8, marginBottom: 32 }} />
        <div style={{ position: 'absolute', bottom: -1, left: 24, right: 24, height: 140, background: '#FFFFFF', borderRadius: 28, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div style={{ padding: '148px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3].map((i) => (
          <div key={i} style={{ height: 88, background: '#FFFFFF', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} />
        ))}
      </div>
    </div>
  );
}
