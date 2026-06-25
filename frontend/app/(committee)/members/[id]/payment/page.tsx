'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { useMember, useLedger, useRecordPayment } from '@/lib/hooks/useMembers';
import type { LedgerRow } from '@/lib/api/members.api';

function fmt(amount: string | number) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function fmtMonth(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function computeFifoPreview(rows: LedgerRow[], amount: number) {
  const preview: { month: string; applied: number; remaining: number }[] = [];
  let remaining = amount;
  for (const row of rows) {
    if (remaining <= 0) break;
    const due = parseFloat(row.outstanding);
    if (due <= 0) continue;
    const applied = Math.min(due, remaining);
    remaining -= applied;
    preview.push({ month: row.month, applied, remaining });
  }
  return { preview, unallocated: remaining };
}

type Stage = 'form' | 'receipt';

export default function RecordPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: member } = useMember(id);
  const { data: ledger } = useLedger(id);
  const mutation = useRecordPayment(id);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string;
    memberName: string;
    amount: number;
    unallocated: string;
  } | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const fifo = ledger ? computeFifoPreview(ledger.rows, numAmount) : { preview: [], unallocated: 0 };
  const totalOutstanding = ledger ? parseFloat(ledger.totalOutstanding) : 0;

  useEffect(() => {
    if (ledger && !amount) {
      setAmount(String(totalOutstanding > 0 ? totalOutstanding.toFixed(2) : ''));
    }
  }, [ledger]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const result = await mutation.mutateAsync({
        amount: numAmount,
        paymentDate: today,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setReceiptData({
        receiptNumber: result.receipt.receiptNumber,
        memberName: member?.name ?? '',
        amount: numAmount,
        unallocated: result.unallocatedAmount,
      });
      setStage('receipt');
    } catch {
      // error handled via mutation.isError
    }
  }

  if (stage === 'receipt' && receiptData) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="flex h-14 items-center gap-3 px-4 border-b border-border">
          <span className="text-base font-semibold flex-1 text-center">Payment Recorded</span>
        </header>
        <div className="flex flex-col items-center gap-6 p-8 pt-12">
          <CheckCircle className="size-16 text-primary" />
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{fmt(receiptData.amount)}</p>
            <p className="mt-1 text-sm text-muted-foreground">received from {receiptData.memberName}</p>
          </div>

          <div className="w-full rounded-2xl border-2 border-dashed border-border bg-card p-5 space-y-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Receipt No.</p>
              <p className="mt-0.5 text-lg font-bold font-mono">{receiptData.receiptNumber}</p>
            </div>

            {fifo.preview.length > 0 && (
              <div className="border-t border-border pt-3 space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Applied to</p>
                {fifo.preview.map((item) => (
                  <div key={item.month} className="flex justify-between">
                    <span className="text-sm">{fmtMonth(item.month)}</span>
                    <span className="text-sm font-medium tabular-nums">{fmt(item.applied)}</span>
                  </div>
                ))}
                {parseFloat(receiptData.unallocated) > 0 && (
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                    <span className="text-sm text-muted-foreground">Advance credit</span>
                    <span className="text-sm font-medium tabular-nums text-primary">
                      {fmt(receiptData.unallocated)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Link
              href={`/members/${id}`}
              className="w-full rounded-xl bg-primary py-3 text-center text-sm font-medium text-primary-foreground"
            >
              Back to member
            </Link>
            <button
              onClick={() => {
                setAmount('');
                setNote('');
                setStage('form');
                setReceiptData(null);
              }}
              className="w-full rounded-xl bg-muted py-3 text-sm font-medium text-foreground"
            >
              Record another payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 bg-background/95 backdrop-blur border-b border-border px-4">
        <Link href={`/members/${id}`} className="text-muted-foreground -ml-1">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold">Record Payment</h1>
          {member && <p className="text-xs text-muted-foreground truncate">{member.name}</p>}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
        {/* Outstanding summary */}
        {totalOutstanding > 0 && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 flex justify-between items-center">
            <p className="text-sm text-destructive">Outstanding dues</p>
            <p className="text-base font-bold tabular-nums text-destructive">{fmt(totalOutstanding)}</p>
          </div>
        )}
        {totalOutstanding === 0 && ledger && (
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-sm text-primary font-medium">All dues cleared</p>
            <p className="text-xs text-muted-foreground mt-0.5">Payment will be recorded as advance</p>
          </div>
        )}

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Amount (₹)</label>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-lg font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>

        {/* FIFO Preview */}
        {numAmount > 0 && fifo.preview.length > 0 && (
          <div className="rounded-xl bg-card border border-border p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Will be applied to</p>
            {fifo.preview.map((item) => (
              <div key={item.month} className="flex justify-between items-center">
                <span className="text-sm">{fmtMonth(item.month)}</span>
                <span className="text-sm font-medium tabular-nums text-primary">{fmt(item.applied)}</span>
              </div>
            ))}
            {fifo.unallocated > 0.005 && (
              <div className="flex justify-between items-center border-t border-border pt-2 mt-1">
                <span className="text-sm text-muted-foreground">Advance / extra</span>
                <span className="text-sm font-medium tabular-nums">{fmt(fifo.unallocated)}</span>
              </div>
            )}
          </div>
        )}
        {numAmount > 0 && fifo.preview.length === 0 && (
          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-sm text-muted-foreground text-center">Full amount recorded as advance</p>
          </div>
        )}

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Cash handed to treasurer"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Payment failed. Try again.'}
          </p>
        )}

        <button
          type="submit"
          disabled={!numAmount || numAmount <= 0 || mutation.isPending}
          className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {mutation.isPending ? 'Recording…' : `Record ${numAmount > 0 ? fmt(numAmount) : ''} Payment`}
        </button>
      </form>
    </div>
  );
}
