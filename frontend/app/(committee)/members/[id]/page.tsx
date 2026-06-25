'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Phone, Receipt, RotateCcw } from 'lucide-react';
import { useMember, useLedger, usePaymentHistory } from '@/lib/hooks/useMembers';
import type { LedgerRow, PaymentRecord } from '@/lib/api/members.api';
import { cn } from '@/lib/utils';

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function fmtMonth(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LedgerSection({ memberId }: { memberId: string }) {
  const { data, isLoading } = useLedger(memberId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between p-3">
            <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
            <div className="h-3.5 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  if (!data) return null;

  const overdueRows = data.rows.filter((r) => parseFloat(r.outstanding) > 0);
  const paidRows = data.rows.filter((r) => parseFloat(r.outstanding) === 0 && parseFloat(r.paid) > 0);
  const visiblePaid = showAll ? paidRows : paidRows.slice(-3);

  function RowItem({ row, className }: { row: LedgerRow; className?: string }) {
    const isOverdue = parseFloat(row.outstanding) > 0;
    return (
      <div className={cn('flex items-center justify-between px-4 py-2.5', className)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{fmtMonth(row.month)}</p>
          <p className="text-xs text-muted-foreground">{row.planName} · Due {fmt(row.monthlyDue)}</p>
        </div>
        <div className="text-right shrink-0">
          {isOverdue ? (
            <p className="text-sm font-medium text-destructive">{fmt(row.outstanding)} unpaid</p>
          ) : (
            <p className="text-sm text-primary">{fmt(row.paid)} paid</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Outstanding summary */}
      {parseFloat(data.totalOutstanding) > 0 && (
        <div className="mx-4 mb-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex justify-between items-center">
          <p className="text-sm font-medium text-destructive">Total Outstanding</p>
          <p className="text-lg font-bold tabular-nums text-destructive">{fmt(data.totalOutstanding)}</p>
        </div>
      )}

      <div className="rounded-2xl bg-card shadow-sm mx-4 overflow-hidden divide-y divide-border">
        {overdueRows.length === 0 && paidRows.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">No ledger rows yet</p>
        )}
        {overdueRows.map((r) => (
          <RowItem key={r.month} row={r} className="bg-destructive/5" />
        ))}
        {visiblePaid.map((r) => (
          <RowItem key={r.month} row={r} />
        ))}
        {paidRows.length > 3 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="w-full py-2.5 text-xs text-primary font-medium hover:bg-muted/50 transition-colors"
          >
            {showAll ? 'Show less' : `Show ${paidRows.length - 3} more paid months`}
          </button>
        )}
      </div>
    </div>
  );
}

function PaymentHistorySection({ memberId }: { memberId: string }) {
  const { data, isLoading } = usePaymentHistory(memberId);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-card shadow-sm mx-4 divide-y divide-border overflow-hidden">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-4 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <div className="mx-4 rounded-2xl bg-card shadow-sm p-4 text-center">
        <p className="text-sm text-muted-foreground">No payments recorded</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card shadow-sm mx-4 divide-y divide-border overflow-hidden">
      {data.map((p: PaymentRecord) => {
        const isReversed = !!p.reversal;
        return (
          <div key={p.id} className={cn('p-4', isReversed && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium tabular-nums">{fmt(p.amount)}</p>
                  {isReversed ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <RotateCcw className="size-2.5" />
                      Reversed
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                      {p.paymentMode}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(p.paymentDate)}</p>
                {p.allocations.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Applied to: {p.allocations.map((a) => fmtMonth(a.contributionMonth)).join(', ')}
                  </p>
                )}
                {isReversed && p.reversal && (
                  <p className="mt-1 text-xs text-destructive">
                    Reversed: &ldquo;{p.reversal.reason}&rdquo; · {fmtDate(p.reversal.reversedAt)}
                  </p>
                )}
              </div>
              {p.receipt && !isReversed && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Receipt className="size-3" />
                  {p.receipt.receiptNumber}
                </div>
              )}
            </div>
            {p.note && <p className="mt-1.5 text-xs text-muted-foreground italic">&ldquo;{p.note}&rdquo;</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: member, isLoading, isError } = useMember(id);
  const [tab, setTab] = useState<'ledger' | 'history'>('ledger');

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 backdrop-blur border-b border-border px-4">
          <Link href="/members" className="text-muted-foreground">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </header>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-sm text-muted-foreground">Member not found</p>
        <Link href="/members" className="text-sm text-primary">Back to members</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-4">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/members" className="text-muted-foreground -ml-1">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">{member.name}</h1>
            <p className="text-xs text-muted-foreground">{member.memberCode}</p>
          </div>
          <Link
            href={`/members/${id}/payment`}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Record Payment
          </Link>
        </div>
      </header>

      {/* Member info card */}
      <div className="mx-4 mt-4 rounded-2xl bg-card shadow-sm p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Plan</span>
          <span className="text-sm font-medium">{member.contributionPlan.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Phone</span>
          <a href={`tel:${member.phone}`} className="flex items-center gap-1 text-sm font-medium text-primary">
            <Phone className="size-3.5" />
            {member.phone}
          </a>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Contributions from</span>
          <span className="text-sm font-medium">
            {new Date(member.contributionStartDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </span>
        </div>
        {parseFloat(member.openingDueBalance) > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Opening balance</span>
            <span className="text-sm font-medium tabular-nums text-[var(--warning)]">
              {fmt(member.openingDueBalance)}
            </span>
          </div>
        )}
        {!member.active && (
          <div className="mt-1 rounded-lg bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
            This member is inactive
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mt-4 rounded-xl bg-muted p-1 gap-1">
        {(['ledger', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors',
              tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
            )}
          >
            {t === 'ledger' ? 'Dues Ledger' : 'Payment History'}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === 'ledger' ? (
          <LedgerSection memberId={id} />
        ) : (
          <PaymentHistorySection memberId={id} />
        )}
      </div>
    </div>
  );
}
