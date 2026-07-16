'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useCreateMember } from '@/lib/hooks/useMembers';
import { useQuery } from '@tanstack/react-query';
import { listPlans } from '@/lib/api/plans.api';
import { cn } from '@/lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentYearRange() {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1];
}

export default function NewMemberPage() {
  const router = useRouter();
  const mutation = useCreateMember();
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: listPlans });

  const now = new Date();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [planId, setPlanId] = useState('');
  const [startMonth, setStartMonth] = useState(now.getMonth());
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [openingBalance, setOpeningBalance] = useState('');
  const [memberCode, setMemberCode] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contributionStartDate = new Date(startYear, startMonth, 1).toISOString().slice(0, 10);
    try {
      const member = await mutation.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        contributionStartDate,
        ...(planId ? { contributionPlanId: planId } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(memberCode.trim() ? { memberCode: memberCode.trim() } : {}),
        ...(parseFloat(openingBalance) > 0 ? { openingDueBalance: parseFloat(openingBalance) } : {}),
      });
      router.push(`/members/${member.id}`);
    } catch {
      // error shown via mutation.isError
    }
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 backdrop-blur border-b border-border px-4">
        <Link href="/members" className="text-muted-foreground -ml-1">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-base font-semibold flex-1">Add Member</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4 pb-8">
        {/* Required fields */}
        <div className="rounded-2xl bg-card shadow-sm p-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Member Details</p>

          <Field label="Full Name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmed Al-Rashid"
              required
              className={inputCls}
            />
          </Field>

          <Field label="Phone Number" required>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              required
              className={inputCls}
            />
          </Field>

          {/* Contribution Starts From — month picker */}
          <Field label="Contribution Starts From" required>
            <div className="flex gap-2">
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className={cn(inputCls, 'flex-1')}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className={cn(inputCls, 'w-24')}
              >
                {currentYearRange().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>

        {/* Contribution plan */}
        <div className="rounded-2xl bg-card shadow-sm p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contribution Plan</p>
          <div className="flex flex-col gap-2">
            {plans?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                className={cn(
                  'flex items-center justify-between rounded-xl px-4 py-3 border text-left transition-colors',
                  planId === p.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background',
                )}
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.feeHistory[0] && (
                    <p className="text-xs text-muted-foreground">
                      ₹{p.feeHistory[0].monthlyFee}/month
                    </p>
                  )}
                </div>
                <div className={cn(
                  'size-4 rounded-full border-2 transition-colors',
                  planId === p.id ? 'border-primary bg-primary' : 'border-muted-foreground',
                )} />
              </button>
            ))}
            {!plans?.length && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No plans yet.{' '}
                <Link href="/plans/new" className="text-primary">Create one first</Link>
              </p>
            )}
          </div>
        </div>

        {/* Optional fields */}
        <div className="rounded-2xl bg-card shadow-sm p-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Optional</p>

          <Field label="Address">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, locality"
              className={inputCls}
            />
          </Field>

          <Field label="Opening Due Balance (₹)">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Dues owed before joining CommitEase
            </p>
          </Field>

          <Field label="Member Code">
            <input
              type="text"
              value={memberCode}
              onChange={(e) => setMemberCode(e.target.value)}
              placeholder="Leave blank to auto-generate"
              className={inputCls}
            />
          </Field>
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive px-1">
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Failed to create member. Please try again.'}
          </p>
        )}

        <button
          type="submit"
          disabled={!name.trim() || !phone.trim() || mutation.isPending}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {mutation.isPending ? 'Adding…' : 'Add Member'}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
