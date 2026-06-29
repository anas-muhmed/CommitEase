'use client';

import Link from 'next/link';
import { ChevronLeft, Plus, UtensilsCrossed } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPlans, updatePlan } from '@/lib/api/plans.api';
import { useAuthStore, hasMinRole } from '@/lib/store/auth.store';
import { cn } from '@/lib/utils';

function fmt(amount: string) {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function PlansPage() {
  const { data: plans, isLoading, isError } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const qc = useQueryClient();
  const toggleExempt = useMutation({
    mutationFn: ({ planId, chelavExempt }: { planId: string; chelavExempt: boolean }) =>
      updatePlan(planId, { chelavExempt }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['plans'] }); },
  });

  const committeeRole = useAuthStore(s => s.user?.committeeRole);
  const isAdmin = hasMinRole(committeeRole, 'ADMIN');

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 backdrop-blur border-b border-border px-4">
        <Link href="/dashboard" className="text-muted-foreground -ml-1">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold flex-1">Contribution Plans</h1>
        <Link
          href="/plans/new"
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Plus className="size-3.5" />
          New Plan
        </Link>
      </header>

      {/* Warning banner — shown when any plan has no current fee */}
      {plans?.some((p) => p.feeHistory.length === 0) && (
        <div className="mx-4 mt-4 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 p-3">
          <p className="text-sm font-medium text-[var(--warning)]">Fee not set</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            One or more plans have no monthly fee configured. Set a fee to start accruing dues.
          </p>
        </div>
      )}

      <main className="p-4 flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card shadow-sm h-24 animate-pulse" />
          ))
        ) : isError ? (
          <p className="text-sm text-destructive text-center p-8">Failed to load plans</p>
        ) : !plans?.length ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm text-muted-foreground">No contribution plans yet</p>
            <Link
              href="/plans/new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Create first plan
            </Link>
          </div>
        ) : (
          plans.map((plan) => {
            const currentFee = plan.feeHistory[0];
            return (
              <div
                key={plan.id}
                className={cn(
                  'rounded-2xl bg-card shadow-sm p-4',
                  !plan.active && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold truncate">{plan.name}</h2>
                      {!plan.active && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Inactive
                        </span>
                      )}
                      {plan.chelavExempt && (
                        <span className="flex items-center gap-1 rounded-full bg-[#FFFBEB] border border-[#FDE68A] px-1.5 py-0.5 text-[10px] font-semibold text-[#D97706]">
                          <UtensilsCrossed size={9} strokeWidth={2.2} />
                          Chelav Exempt
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {currentFee ? (
                      <>
                        <p className="text-base font-bold tabular-nums text-primary">
                          {fmt(currentFee.monthlyFee)}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">from {fmtMonth(currentFee.effectiveFrom)}</p>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--warning)] font-medium">No fee set</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {plan._count.members} member{plan._count.members !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    {plan.feeHistory.length > 1 && (
                      <p className="text-[10px] text-muted-foreground">
                        {plan.feeHistory.length} fee versions
                      </p>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => toggleExempt.mutate({ planId: plan.id, chelavExempt: !plan.chelavExempt })}
                        disabled={toggleExempt.isPending}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                          plan.chelavExempt
                            ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7]'
                            : 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        <UtensilsCrossed size={9} strokeWidth={2.2} />
                        {plan.chelavExempt ? 'Chelav Exempt' : 'Set Exempt'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
