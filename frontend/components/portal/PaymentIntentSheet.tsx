'use client';

import { useState } from 'react';
import { X, Info } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  totalDue: string;
}

function fmtAmount(s: string): string {
  return `₹${parseFloat(s).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function PaymentIntentSheet({ open, onClose, totalDue }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  function handlePayFull() {
    setSubmitted(true);
  }

  function handleCustomPay() {
    if (!customAmount || parseFloat(customAmount) <= 0) return;
    setSubmitted(true);
  }

  function handleClose() {
    setCustomMode(false);
    setCustomAmount('');
    setSubmitted(false);
    onClose();
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 300, backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
        background: '#FFFFFF', borderRadius: '24px 24px 0 0',
        padding: '0 24px 48px',
        boxShadow: '0 -16px 48px rgba(0,0,0,0.14)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E2E8F0' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 24px' }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: '#0F172A', margin: 0 }}>Pay Contribution</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#94A3B8', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {!submitted ? (
          <>
            {/* Amount display */}
            <div style={{ textAlign: 'center', padding: '8px 0 28px' }}>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 6px', fontWeight: 500 }}>Total Due</p>
              <p style={{ fontSize: 48, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: -2, lineHeight: 1 }}>
                {fmtAmount(totalDue)}
              </p>
            </div>

            {/* Pay full button */}
            {!customMode && (
              <button
                onClick={handlePayFull}
                style={{
                  width: '100%', height: 56, borderRadius: 16,
                  background: 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 16, fontWeight: 700, color: '#FFFFFF',
                  boxShadow: '0 8px 24px rgba(21,128,61,0.30)',
                  marginBottom: 12,
                }}
              >
                Pay {fmtAmount(totalDue)}
              </button>
            )}

            {/* Custom amount */}
            {customMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  border: '1.5px solid #E2E8F0', borderRadius: 16,
                  padding: '0 18px', height: 56, background: '#F8FAFB',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#64748B', marginRight: 8 }}>₹</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 20, fontWeight: 700, color: '#0F172A', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <button
                  onClick={handleCustomPay}
                  disabled={!customAmount || parseFloat(customAmount) <= 0}
                  style={{
                    width: '100%', height: 52, borderRadius: 16,
                    background: (!customAmount || parseFloat(customAmount) <= 0) ? '#D1FAE5' : 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 15, fontWeight: 700,
                    color: (!customAmount || parseFloat(customAmount) <= 0) ? '#86EFAC' : '#FFFFFF',
                  }}
                >
                  Pay ₹{customAmount || '0'}
                </button>
                <button
                  onClick={() => { setCustomMode(false); setCustomAmount(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#64748B', padding: '4px 0' }}
                >
                  ← Back
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCustomMode(true)}
                style={{ width: '100%', height: 48, borderRadius: 16, background: '#F8FAFB', border: '1.5px solid #E2E8F0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#64748B', marginBottom: 12 }}
              >
                Pay a different amount
              </button>
            )}

            {/* Coming soon info */}
            <div style={{
              background: '#F8FAFB', borderRadius: 14, padding: '14px 16px',
              display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 4,
            }}>
              <Info size={15} color="#64748B" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Online payment integration coming soon. Your committee will enable UPI shortly. Contact them to arrange payment in the meantime.
              </p>
            </div>
          </>
        ) : (
          /* Post-submit state */
          <div style={{ textAlign: 'center', padding: '16px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={28} color="#15803D" />
            </div>
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>Payment Not Yet Available</p>
              <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
                Online payments are coming soon. Contact your committee to make a payment and they will record it on your behalf.
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{ width: '100%', height: 52, borderRadius: 16, background: '#F1F5F9', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: '#0F172A' }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}
