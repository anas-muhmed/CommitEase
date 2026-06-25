'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, ChevronRight, UserX } from 'lucide-react';
import { useMemberList } from '@/lib/hooks/useMembers';
import { cn } from '@/lib/utils';

const FILTER_CHIPS = [
  { label: 'All', value: undefined as boolean | undefined },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
] as const;

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<boolean | undefined>(true);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading, isError } = useMemberList({
    search: debouncedSearch || undefined,
    active,
    limit: 50,
  });

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((handleSearchChange as unknown as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearchChange as unknown as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(
      () => setDebouncedSearch(val),
      300,
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex h-14 items-center gap-3 px-4">
          <h1 className="text-base font-semibold flex-1">Members</h1>
          <Link
            href="/members/new"
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Plus className="size-3.5" />
            Add
          </Link>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search name, phone, or code…"
              className="w-full rounded-xl bg-muted pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {FILTER_CHIPS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setActive(value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
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
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-36 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-3 w-12 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm text-destructive">Failed to load members</p>
          </div>
        ) : !data?.members.length ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <UserX className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {debouncedSearch ? 'No members match your search' : 'No members yet'}
            </p>
            {!debouncedSearch && (
              <Link
                href="/members/new"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Add first member
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {data.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      {!m.active && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.memberCode} · {m.contributionPlan.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {parseFloat(m.openingDueBalance) > 0 && (
                      <span className="text-xs text-[var(--warning)] font-medium tabular-nums">
                        {fmt(m.openingDueBalance)}
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
            {data.total > data.members.length && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Showing {data.members.length} of {data.total} members
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
