'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, PhoneCall } from 'lucide-react';
import { useOverdueReport } from '@/lib/hooks/useDashboard';
import { cn } from '@/lib/utils';
import type { OverdueMember } from '@/lib/api/dashboard.api';

type Severity = 'all' | 'critical' | 'serious' | 'mild';

const SEVERITY_CHIPS: { label: string; value: Severity; color: string }[] = [
  { label: 'All', value: 'all', color: '' },
  { label: 'Critical', value: 'critical', color: 'text-destructive' },
  { label: 'Serious', value: 'serious', color: 'text-[var(--warning)]' },
  { label: 'Mild', value: 'mild', color: 'text-primary' },
];

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function SeverityBadge({ severity }: { severity: OverdueMember['severity'] }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        severity === 'critical' && 'bg-destructive/10 text-destructive',
        severity === 'serious' && 'bg-[var(--warning)]/15 text-[var(--warning)]',
        severity === 'mild' && 'bg-primary/10 text-primary',
      )}
    >
      {severity}
    </span>
  );
}

export default function OverdueReportPage() {
  const { data, isLoading, isError } = useOverdueReport();
  const [filter, setFilter] = useState<Severity>('all');

  const members =
    data?.members.filter((m) => filter === 'all' || m.severity === filter) ?? [];

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/dashboard" className="text-muted-foreground -ml-1">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1">Overdue Report</h1>
        </div>

        {/* Summary pills */}
        {data && (
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
            {[
              { label: `${data.summary.critical} Critical`, color: 'text-destructive bg-destructive/10' },
              { label: `${data.summary.serious} Serious`, color: 'text-[var(--warning)] bg-[var(--warning)]/10' },
              { label: `${data.summary.mild} Mild`, color: 'text-primary bg-primary/10' },
            ].map(({ label, color }) => (
              <span key={label} className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', color)}>
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Total outstanding */}
        {data && (
          <div className="mx-4 mb-3 rounded-xl bg-card border border-border px-4 py-2.5 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{data.summary.total} members overdue</p>
            <p className="text-sm font-bold tabular-nums text-destructive">{fmt(data.summary.totalOutstanding)}</p>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {SEVERITY_CHIPS.map(({ label, value, color }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filter === value
                  ? value === 'all'
                    ? 'bg-foreground text-background'
                    : 'bg-foreground text-background'
                  : cn('bg-muted', color || 'text-muted-foreground'),
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main>
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-destructive">Failed to load report</p>
          </div>
        ) : !members.length ? (
          <div className="p-12 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-2 text-sm font-medium">
              {filter === 'all' ? 'No overdue members!' : `No ${filter} members`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">All dues are up to date</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <Link
                key={m.memberId}
                href={`/members/${m.memberId}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <SeverityBadge severity={m.severity} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {m.memberCode} · {m.overdueMonths} month{m.overdueMonths !== 1 ? 's' : ''} overdue
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums text-destructive">{fmt(m.totalOutstanding)}</p>
                  </div>
                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <PhoneCall className="size-3.5" />
                    </a>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
