'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, CheckCircle2, RotateCcw, ReceiptText, CreditCard } from 'lucide-react';
import { getReceiptDetail } from '@/lib/api/member.api';

function fmtAmount(s: string): string {
  return `₹${parseFloat(s).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #F8FAFB' }}>
      <span style={{ fontSize: 14, color: '#64748B' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: valueColor ?? '#0F172A', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

export default function ReceiptDetailPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = use(params);
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: () => getReceiptDetail(receiptId),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return (
    <div style={{ minHeight: '100dvh', background: '#F8FAFB' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(248,250,251,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '52px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#64748B', display: 'flex', borderRadius: 8 }}>
            <ChevronLeft size={22} />
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: -0.4 }}>Receipt</h1>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ padding: '20px 20px' }}>
          <div style={{ height: 220, background: '#FFFFFF', borderRadius: 20, animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 12 }} />
          <div style={{ height: 180, background: '#FFFFFF', borderRadius: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#64748B', margin: 0 }}>Receipt not found or access denied.</p>
        </div>
      )}

      {/* Content */}
      {data && (
        <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Hero receipt card */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            {/* Status icon */}
            <div style={{ width: 64, height: 64, borderRadius: 20, background: data.isReversed ? '#FEF2F2' : '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              {data.isReversed
                ? <RotateCcw size={28} color="#EF4444" />
                : <CheckCircle2 size={28} color="#16A34A" />
              }
            </div>

            {/* Amount */}
            <p style={{ fontSize: 44, fontWeight: 800, color: data.isReversed ? '#EF4444' : '#0F172A', margin: '0 0 6px', letterSpacing: -2, lineHeight: 1 }}>
              {data.isReversed ? `−${fmtAmount(data.amount)}` : fmtAmount(data.amount)}
            </p>

            {/* Status badge */}
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
              color: data.isReversed ? '#EF4444' : '#16A34A',
              background: data.isReversed ? '#FEF2F2' : '#DCFCE7',
              padding: '4px 14px', borderRadius: 100, display: 'inline-block', marginBottom: 16,
            }}>
              {data.isReversed ? 'Reversed' : 'Payment Successful'}
            </span>

            {/* Date */}
            <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, fontWeight: 500 }}>{fmtDate(data.date)}</p>

            {/* Receipt number */}
            {data.receiptNumber && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, background: '#F8FAFB', borderRadius: 8, padding: '5px 12px' }}>
                <ReceiptText size={13} color="#94A3B8" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>{data.receiptNumber}</span>
              </div>
            )}
          </div>

          {/* Details card */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '0 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <DetailRow label="Payment Mode" value={data.paymentMode} />
            <DetailRow label="Date" value={fmtDate(data.date)} />
            {data.note && <DetailRow label="Note" value={data.note} />}
            {data.isReversed && data.reversalReason && (
              <DetailRow label="Reversal Reason" value={data.reversalReason} valueColor="#EF4444" />
            )}
          </div>

          {/* Allocation breakdown */}
          {data.allocations.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '0 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '14px 0 8px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', margin: 0, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Applied To
                </p>
              </div>
              {data.allocations.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderTop: '1px solid #F8FAFB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: '#0F172A', fontWeight: 500 }}>{a.month}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{fmtAmount(a.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Info footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F8FAFB', borderRadius: 12 }}>
            <CreditCard size={14} color="#94A3B8" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              This receipt is a record of payment processed by your mosque committee. Contact them for disputes.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
