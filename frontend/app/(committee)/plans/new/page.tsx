'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPlan, setFee } from '@/lib/api/plans.api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const inputCls =
  'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground';

export default function NewPlanPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const now = new Date();
  const [feeMonth, setFeeMonth] = useState(now.getMonth());
  const [feeYear, setFeeYear] = useState(now.getFullYear());
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsPending(true);
    try {
      const plan = await createPlan({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });

      if (monthlyFee && parseFloat(monthlyFee) > 0) {
        const effectiveFrom = new Date(feeYear, feeMonth, 1).toISOString().slice(0, 10);
        await setFee(plan.id, { monthlyFee: parseFloat(monthlyFee), effectiveFrom });
      }

      void qc.invalidateQueries({ queryKey: ['plans'] });
      router.push('/plans');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create plan';
      setError(message);
    } finally {
      setIsPending(false);
    }
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 backdrop-blur border-b border-border px-4">
        <Link href="/plans" className="text-muted-foreground -ml-1">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold flex-1">New Contribution Plan</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 pb-8">
        <div className="rounded-2xl bg-card shadow-sm p-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan Details</p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              Plan Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. General Member, Patron, Life Member"
              required
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this plan"
              rows={2}
              className={inputCls}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-card shadow-sm p-4 flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Fee</p>
            <p className="text-xs text-muted-foreground mt-0.5">You can set this later if needed</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Amount (₹)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </div>

          {parseFloat(monthlyFee) > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Effective From</label>
              <div className="flex gap-2">
                <select
                  value={feeMonth}
                  onChange={(e) => setFeeMonth(Number(e.target.value))}
                  className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
                <select
                  value={feeYear}
                  onChange={(e) => setFeeYear(Number(e.target.value))}
                  className="w-24 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive px-1">{error}</p>}

        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create Plan'}
        </button>
      </form>
    </div>
  );
}
