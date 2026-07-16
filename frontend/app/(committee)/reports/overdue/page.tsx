'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Phone, ChevronRight } from 'lucide-react';
import { useOverdueReport } from '@/lib/hooks/useDashboard';
import { MemberAvatar } from '@/components/ui/member-avatar';
import type { OverdueMember } from '@/lib/api/dashboard.api';

type Sev = 'all' | 'critical' | 'serious' | 'mild';

const CHIPS: { label: string; value: Sev; color: string; bg: string }[] = [
  { label: 'All',      value: 'all',      color: '#0A1C12', bg: '#EEF0EB' },
  { label: 'Critical', value: 'critical', color: '#C0392B', bg: '#FDF2F1' },
  { label: 'Serious',  value: 'serious',  color: '#A16207', bg: '#FEF9EE' },
  { label: 'Mild',     value: 'mild',     color: '#0C6640', bg: '#E6F4EC' },
];

const SEV_STYLE: Record<string, { color: string; bg: string }> = {
  critical: { color: '#C0392B', bg: '#FDF2F1' },
  serious:  { color: '#A16207', bg: '#FEF9EE' },
  mild:     { color: '#0C6640', bg: '#E6F4EC' },
};

function inr(n: string) {
  return `₹${parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function OverdueReportPage() {
  const { data, isLoading, isError } = useOverdueReport();
  const [filter, setFilter] = useState<Sev>('all');

  const members = data?.members.filter(m => filter === 'all' || m.severity === filter) ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F1' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: '#F4F5F1', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <Link href="/dashboard"><ChevronLeft size={22} color="#7A9185" /></Link>
          <p className="type-title" style={{ flex: 1, color: '#0A1C12' }}>Overdue</p>
        </div>

        {/* Summary strip */}
        {!isLoading && data && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: '14px 20px',
            boxShadow: '0 1px 2px rgb(10 28 18 / 0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {data.summary.critical > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <p className="type-heading" style={{ color: '#C0392B' }}>{data.summary.critical}</p>
                  <p className="type-micro" style={{ color: '#C0392B', opacity: 0.7 }}>Critical</p>
                </div>
              )}
              {data.summary.serious > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <p className="type-heading" style={{ color: '#A16207' }}>{data.summary.serious}</p>
                  <p className="type-micro" style={{ color: '#A16207', opacity: 0.7 }}>Serious</p>
                </div>
              )}
              {data.summary.mild > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <p className="type-heading" style={{ color: '#0C6640' }}>{data.summary.mild}</p>
                  <p className="type-micro" style={{ color: '#0C6640', opacity: 0.7 }}>Mild</p>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="type-heading" style={{ color: '#C0392B' }}>{inr(data.summary.totalOutstanding)}</p>
              <p className="type-micro" style={{ color: '#7A9185' }}>Total outstanding</p>
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 16, overflowX: 'auto' }} className="no-scrollbar">
          {CHIPS.map(c => {
            const active = filter === c.value;
            return (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                style={{
                  flexShrink: 0, borderRadius: 12, padding: '7px 16px',
                  background: active ? c.color : c.bg,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <span className="type-label" style={{ color: active ? '#fff' : c.color }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 24px 32px' }}>
        {isLoading ? (
          <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 2px rgb(10 28 18 / 0.04)' }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderTop: i===1?'none':'1px solid #F0F2EF' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: 120, height: 14, borderRadius: 6, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ width: 80, height: 12, borderRadius: 6, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite', marginTop: 6 }} />
                </div>
                <div style={{ width: 60, height: 14, borderRadius: 6, background: '#EEF0EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <p className="type-label" style={{ color: '#C0392B' }}>Failed to load report</p>
          </div>
        ) : !members.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 64, textAlign: 'center' }}>
            <span style={{ fontSize: 40 }}>🎉</span>
            <p className="type-subheading" style={{ color: '#0A1C12' }}>
              {filter === 'all' ? 'No overdue members' : `No ${filter} members`}
            </p>
            <p className="type-label" style={{ color: '#7A9185', fontWeight: 500 }}>All dues are up to date</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 2px rgb(10 28 18 / 0.04), 0 2px 8px rgb(10 28 18 / 0.04)' }}>
            {members.map((m: OverdueMember, i) => {
              const sev = SEV_STYLE[m.severity] ?? SEV_STYLE.mild!;
              return (
                <Link key={m.memberId} href={`/members/${m.memberId}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '14px 20px',
                      borderTop: i === 0 ? 'none' : '1px solid #F0F2EF',
                    }}
                    className="list-row-hover"
                  >
                    <MemberAvatar name={m.name} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p className="type-body-strong" style={{ color: '#0A1C12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </p>
                        <span style={{ borderRadius: 8, background: sev.bg, padding: '2px 8px', flexShrink: 0 }}>
                          <span className="type-micro" style={{ color: sev.color }}>{m.severity}</span>
                        </span>
                      </div>
                      <p className="type-caption" style={{ color: '#7A9185', marginTop: 2 }}>
                        {m.overdueMonths} month{m.overdueMonths !== 1 ? 's' : ''} overdue · {m.memberCode}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <p className="type-body-strong" style={{ color: '#C0392B', fontVariantNumeric: 'tabular-nums' }}>
                        {inr(m.totalOutstanding)}
                      </p>
                      {m.phone && (
                        <button
                          onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${m.phone}`; }}
                          style={{
                            width: 32, height: 32, borderRadius: 10,
                            background: '#EEF0EB', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, border: 'none', cursor: 'pointer', padding: 0,
                          }}
                        >
                          <Phone size={14} color="#7A9185" />
                        </button>
                      )}
                      <ChevronRight size={16} color="#C9D4CB" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .list-row-hover:active { background: #F4F5F1 !important; }
      `}</style>
    </div>
  );
}
