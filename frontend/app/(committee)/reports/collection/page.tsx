'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getCollectionReport } from '@/lib/api/dashboard.api';
import { cn } from '@/lib/utils';

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

export default function CollectionReportPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'collection', year],
    queryFn: () => getCollectionReport(year),
    staleTime: 60_000,
  });

  const years = [currentYear - 1, currentYear, currentYear + 1];

  const totalCollected = data?.reduce((s, m) => s + parseFloat(m.totalCollected), 0) ?? 0;
  const totalReversed = data?.reduce((s, m) => s + parseFloat(m.reversedAmount), 0) ?? 0;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/dashboard" className="text-muted-foreground -ml-1">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1">Collection Report</h1>

          {/* Year selector */}
          <div className="flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  y === year ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Annual summary */}
        {!isLoading && data && (
          <div className="flex gap-3 px-4 pb-3">
            <div className="flex-1 rounded-xl bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-primary">{fmt(String(totalCollected))}</p>
            </div>
            {totalReversed > 0 && (
              <div className="flex-1 rounded-xl bg-destructive/10 p-3">
                <p className="text-xs text-muted-foreground">Reversed</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-destructive">
                  {fmt(String(totalReversed))}
                </p>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="p-4 flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-card shadow-sm p-4 h-16 animate-pulse" />
          ))
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-destructive">Failed to load report</p>
          </div>
        ) : (
          data?.map((m) => {
            const hasActivity = parseFloat(m.totalCollected) > 0 || parseFloat(m.reversedAmount) > 0;
            return (
              <div
                key={m.month}
                className={cn(
                  'rounded-xl bg-card shadow-sm p-4',
                  !hasActivity && 'opacity-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{monthLabel(m.month)}</p>
                  <p
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      parseFloat(m.totalCollected) > 0 ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {parseFloat(m.totalCollected) > 0 ? fmt(m.totalCollected) : '—'}
                  </p>
                </div>
                {hasActivity && (
                  <div className="mt-1.5 flex gap-4">
                    <p className="text-xs text-muted-foreground">
                      {m.paymentCount} payment{m.paymentCount !== 1 ? 's' : ''}
                    </p>
                    {parseFloat(m.reversedAmount) > 0 && (
                      <p className="text-xs text-destructive">
                        -{fmt(m.reversedAmount)} reversed
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
