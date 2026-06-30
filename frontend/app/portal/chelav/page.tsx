'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, UtensilsCrossed } from 'lucide-react';
import { getMemberChelav } from '@/lib/api/member.api';

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string; text: string }> = {
  Scheduled: { dot: '#C9A54C', label: 'Scheduled', badge: '#FEF3C7', text: '#B45309' },
  Completed:  { dot: '#15803D', label: 'Completed',  badge: '#DCFCE7', text: '#15803D' },
  Missed:     { dot: '#EF4444', label: 'Missed',     badge: '#FEF2F2', text: '#EF4444' },
  Changed:    { dot: '#8B5CF6', label: 'Changed',    badge: '#EDE9FE', text: '#7C3AED' },
};

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'UTC' });
}

function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
}

function fmtMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function PortalChelavPage() {
  const router = useRouter();
  const now = new Date();

  const { data, isLoading } = useQuery({
    queryKey: ['member-chelav', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getMemberChelav(now.getFullYear(), now.getMonth() + 1),
    staleTime: 5 * 60_000,
  });

  const todayStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(248,250,251,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        padding: '52px 20px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6, color: '#64748B', display: 'flex', alignItems: 'center', borderRadius: 10,
          }}>
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.5 }}>
              Chelav Schedule
            </h1>
            {data && (
              <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>
                {fmtMonthYear(data.year, data.month)}
              </p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot }} />
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {isLoading && (
          <>
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} style={{
                height: 72, background: '#FFFFFF', borderRadius: 20,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </>
        )}

        {data && data.entries.length === 0 && (
          <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UtensilsCrossed size={24} color="#CBD5E1" />
            </div>
            <p style={{ fontSize: 15, color: '#94A3B8', margin: 0 }}>No schedule for this month</p>
          </div>
        )}

        {data?.entries.map((entry) => {
          const isToday = entry.date.slice(0, 10) === todayStr;
          const cfg = STATUS_CONFIG[entry.status] ?? { dot: '#94A3B8', label: entry.status, badge: '#F1F5F9', text: '#64748B' };

          return (
            <div
              key={entry.id}
              style={{
                background: isToday ? '#FFFFFF' : '#FFFFFF',
                borderRadius: 20,
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: isToday
                  ? '0 4px 24px rgba(21,128,61,0.12), 0 0 0 2px #15803D'
                  : '0 2px 12px rgba(0,0,0,0.05)',
                border: isToday ? '1.5px solid #15803D' : '1.5px solid transparent',
              }}
            >
              {/* Date column */}
              <div style={{ width: 36, flexShrink: 0, textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: isToday ? '#15803D' : '#0F172A', margin: 0, lineHeight: 1, letterSpacing: -0.5 }}>
                  {fmtDay(entry.date)}
                </p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {fmtWeekday(entry.date)}
                </p>
              </div>

              {/* Divider dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 15, fontWeight: entry.isMe ? 700 : 500,
                  color: '#0F172A', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {entry.displayLabel}
                </p>
                {entry.notes && (
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.notes}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                {isToday && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#15803D', background: '#DCFCE7',
                    padding: '3px 9px', borderRadius: 100,
                  }}>Today</span>
                )}
                {entry.isMe && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#15803D', background: '#ECFDF5',
                    padding: '3px 9px', borderRadius: 100,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <UtensilsCrossed size={10} />
                    You
                  </span>
                )}
                {entry.status !== 'Scheduled' && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: cfg.text, background: cfg.badge,
                    padding: '3px 9px', borderRadius: 100,
                  }}>
                    {cfg.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
