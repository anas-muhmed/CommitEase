'use client';

import Link from 'next/link';
import { Users, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';
import { useDashboard } from '@/lib/hooks/useDashboard';
import { cn } from '@/lib/utils';

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-background/95 backdrop-blur border-b border-border px-4">
        <span className="text-sm font-semibold text-primary">CommitEase</span>
        <Link
          href="/plans"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Member Types
        </Link>
      </header>

      <main className="flex flex-col gap-4 p-4">
        {/* Hero — Total Outstanding */}
        <div className="rounded-2xl bg-card border-l-4 border-primary shadow-sm p-5">
          <p className="text-sm text-muted-foreground">Total Outstanding Dues</p>
          {isLoading ? (
            <div className="mt-2 h-9 w-40 rounded-lg bg-muted animate-pulse" />
          ) : isError ? (
            <p className="mt-2 text-lg font-semibold text-destructive">Failed to load</p>
          ) : data ? (
            <>
              <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                {fmt(data.totalOutstandingAllMembers)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                across {data.members.active} active members
              </p>
            </>
          ) : null}
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Collected this month',
              value: isLoading ? null : fmt(data?.collection.thisMonth.totalAmount ?? '0'),
              icon: TrendingUp,
              color: 'text-primary',
            },
            {
              label: 'Overdue members',
              value: isLoading ? null : String(data?.members.active ?? '—'),
              icon: AlertCircle,
              color: 'text-[var(--warning)]',
              href: '/reports/overdue',
            },
            {
              label: 'Active members',
              value: isLoading ? null : String(data?.members.active ?? '—'),
              icon: Users,
              color: 'text-foreground',
              href: '/members',
            },
          ].map(({ label, value, icon: Icon, color, href }) => {
            const card = (
              <div className="rounded-2xl bg-card shadow-sm p-4 flex flex-col gap-2">
                <Icon className={cn('size-4', color)} />
                {value === null ? (
                  <div className="h-5 w-12 rounded bg-muted animate-pulse" />
                ) : (
                  <p className="text-lg font-bold tabular-nums">{value}</p>
                )}
                <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
              </div>
            );
            return href ? (
              <Link key={label} href={href} className="block">
                {card}
              </Link>
            ) : (
              <div key={label}>{card}</div>
            );
          })}
        </div>

        {/* Recent Payments */}
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold">Recent Payments</h2>
            <Link href="/payments" className="text-xs text-primary">
              View all
            </Link>
          </div>
          <div className="rounded-2xl bg-card shadow-sm divide-y divide-border overflow-hidden">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="h-4 w-14 rounded bg-muted animate-pulse" />
                </div>
              ))
            ) : !data?.recentPayments.length ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No payments yet</p>
            ) : (
              data.recentPayments.map((p) => (
                <Link
                  key={p.id}
                  href={`/members/${p.member.memberCode}`}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.receipt?.receiptNumber ?? '—'} · {formatDate(p.paymentDate)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-primary shrink-0">
                    {fmt(p.amount)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Recent Reversals — only shown if any exist */}
        {!isLoading && data && data.recentReversals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2 px-1">Recent Cancellations</h2>
            <div className="rounded-2xl bg-card shadow-sm divide-y divide-border overflow-hidden">
              {data.recentReversals.map((r) => (
                <div key={r.id} className="p-4 flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{r.payment.member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(r.payment.amount)} · &quot;{r.reason}&quot; · {formatDate(r.reversedAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
