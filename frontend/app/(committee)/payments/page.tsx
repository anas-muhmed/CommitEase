'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight } from 'lucide-react';
import { useMemberList } from '@/lib/hooks/useMembers';
import type { MemberSummary } from '@/lib/api/members.api';
import { cn } from '@/lib/utils';

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useMemberList({
    search: debouncedSearch || undefined,
    active: true,
    limit: 20,
  });

  function handleSearchChange(val: string) {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(val), 250);
  }

  function selectMember(m: MemberSummary) {
    router.push(`/members/${m.id}/payment`);
  }

  const showDropdown = debouncedSearch.length > 0 && !!data?.members.length;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4">
        <div className="flex h-14 items-center">
          <h1 className="text-base font-semibold">Record Payment</h1>
        </div>
        <p className="text-xs text-muted-foreground pb-3">Search for a member to record their payment</p>
      </header>

      <main className="p-4 flex flex-col gap-4">
        {/* Member search */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Member name, phone, or code…"
              autoFocus
              className="w-full rounded-xl bg-muted pl-9 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
          </div>

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-card border border-border shadow-lg overflow-hidden divide-y divide-border">
              {data?.members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMember(m)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.memberCode} · {m.contributionPlan.name}</p>
                  </div>
                  {parseFloat(m.openingDueBalance) > 0 && (
                    <span className="text-xs text-destructive font-medium tabular-nums shrink-0">
                      {fmt(m.openingDueBalance)} due
                    </span>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </button>
              ))}
              {!isLoading && data?.total && data.total > (data.members.length) && (
                <p className="px-4 py-2 text-xs text-muted-foreground text-center">
                  Showing top {data.members.length} — refine search to find more
                </p>
              )}
            </div>
          )}

          {debouncedSearch && !isLoading && !data?.members.length && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl bg-card border border-border shadow-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">No active members found</p>
            </div>
          )}
        </div>

        {/* Empty state / hint */}
        {!search && (
          <div className="flex flex-col items-center gap-3 pt-8 text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <Search className="size-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-medium">Quick payment entry</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Search by name, phone number, or member code.<br />
                Select a member to record their payment instantly.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
