'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { lookupPhone, requestMemberOtp, verifyMemberOtp } from '@/lib/api/member-auth.api';
import { getMemberHome } from '@/lib/api/member.api';
import { useMemberAuthStore } from '@/lib/store/member-auth.store';
import type { MasjidOption } from '@/lib/api/member-auth.api';

function jwtDecode(t: string): Record<string, string> {
  try {
    const b = t.split('.')[1] ?? '';
    return JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, string>;
  } catch { return {}; }
}

function extractMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { message?: string } } }).response;
    return r?.data?.message ?? 'Something went wrong.';
  }
  return 'Something went wrong.';
}

type Step = 'phone' | 'mosque' | 'otp' | 'success';

const STEP_META: Record<Exclude<Step, 'success'>, { title: string; subtitle: string }> = {
  phone:  { title: 'Enter your number', subtitle: 'We\'ll find your account and send a code' },
  mosque: { title: 'Choose your mosque', subtitle: 'Your number is linked to multiple mosques' },
  otp:    { title: 'Verify your identity', subtitle: 'Enter the 6-digit code we sent you' },
};

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillCode = params.get('masjidCode');
  const prefillName = params.get('masjidName');

  const { setAuth, accessToken, updateToken } = useMemberAuthStore();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [masjids, setMasjids] = useState<MasjidOption[]>([]);
  const [selectedMasjid, setSelectedMasjid] = useState<MasjidOption | null>(
    prefillCode && prefillName ? { masjidCode: prefillCode, masjidName: prefillName } : null,
  );
  const [otpDigits, setOtpDigits] = useState<string[]>(['','','','','','']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otp = otpDigits.join('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (accessToken) router.replace('/portal/home');
  }, [accessToken, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handlePhoneSubmit() {
    if (!phone.trim()) return;
    setError(''); setLoading(true);
    try {
      const found = await lookupPhone(phone.trim());
      if (found.length === 0) {
        setError('This number is not registered. Contact your committee to be added.');
        return;
      }
      if (selectedMasjid) {
        const match = found.find((m) => m.masjidCode === selectedMasjid.masjidCode);
        if (!match) { setError(`Number not registered at ${selectedMasjid.masjidName}.`); return; }
        await sendOtp(selectedMasjid.masjidCode);
      } else if (found.length === 1) {
        setSelectedMasjid(found[0]!);
        await sendOtp(found[0]!.masjidCode);
      } else {
        setMasjids(found);
        setStep('mosque');
      }
    } catch (e) { setError(extractMsg(e)); }
    finally { setLoading(false); }
  }

  async function handleMosqueSelect(m: MasjidOption) {
    setSelectedMasjid(m); setError(''); setLoading(true);
    try { await sendOtp(m.masjidCode); }
    catch (e) { setError(extractMsg(e)); }
    finally { setLoading(false); }
  }

  async function sendOtp(code: string) {
    await requestMemberOtp(code, phone.trim());
    setResendCooldown(60); setStep('otp');
  }

  function handleOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKey(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otpDigits];
    pasted.split('').forEach((d, i) => { next[i] = d; });
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    setTimeout(() => otpRefs.current[focusIdx]?.focus(), 0);
  }

  async function handleOtpSubmit() {
    if (otp.length !== 6 || !selectedMasjid) return;
    setError(''); setLoading(true);
    try {
      const { accessToken: token } = await verifyMemberOtp(selectedMasjid.masjidCode, phone.trim(), otp.trim());
      const p = jwtDecode(token);
      updateToken(token);
      const home = await getMemberHome();
      setAuth(token, {
        id: p['sub'] ?? '',
        name: home.member.name,
        memberCode: home.member.memberCode,
        masjidId: p['masjidId'] ?? '',
        masjidName: home.member.masjidName,
        phone: home.member.phone,
        planName: home.member.planName,
        chelavExempt: home.member.chelavExempt,
      });
      setStep('success');
      setTimeout(() => router.replace('/portal/home'), 900);
    } catch (e) { setError(extractMsg(e)); }
    finally { setLoading(false); }
  }

  async function handleResend() {
    if (!selectedMasjid || resendCooldown > 0) return;
    setError(''); setLoading(true);
    try { await requestMemberOtp(selectedMasjid.masjidCode, phone.trim()); setResendCooldown(60); }
    catch (e) { setError(extractMsg(e)); }
    finally { setLoading(false); }
  }

  function goBack() {
    setError('');
    if (step === 'otp') setStep(masjids.length > 1 ? 'mosque' : 'phone');
    else if (step === 'mosque') setStep('phone');
  }

  // ─── Success ───────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div style={{
        minHeight: '100dvh', background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(21,128,61,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle2 size={44} color="#4ADE80" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px' }}>Welcome!</p>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Opening your account…</p>
        </div>
      </div>
    );
  }

  const meta = STEP_META[step as Exclude<Step, 'success'>];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero section */}
      <div style={{
        background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)',
        padding: '56px 24px 52px', position: 'relative',
      }}>
        {/* Back / home */}
        <div style={{ marginBottom: 32 }}>
          {step !== 'phone' ? (
            <button onClick={goBack} style={backBtn}>
              <ArrowLeft size={18} color="rgba(255,255,255,0.7)" />
            </button>
          ) : (
            <a href="/" style={{ ...backBtn, textDecoration: 'none', display: 'inline-flex' }}>
              <ArrowLeft size={18} color="rgba(255,255,255,0.7)" />
            </a>
          )}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {(['phone', 'mosque', 'otp'] as const).filter((s) => !(s === 'mosque' && masjids.length <= 1)).map((s, i) => (
            <div key={s} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: isStepDone(step, s) ? '#C9A54C' : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px', lineHeight: 1.2 }}>
          {meta.title}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
          {step === 'otp' ? `Code sent to ${phone}${selectedMasjid ? ` · ${selectedMasjid.masjidName}` : ''}` : meta.subtitle}
          {selectedMasjid && step === 'phone' && (
            <><br /><span style={{ color: 'rgba(201,165,76,0.9)', fontWeight: 600 }}>{selectedMasjid.masjidName}</span></>
          )}
        </p>
      </div>

      {/* Form card */}
      <div style={{
        flex: 1, background: '#FFFFFF',
        borderRadius: '28px 28px 0 0', marginTop: -20,
        padding: '32px 24px 40px',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* Phone step */}
        {step === 'phone' && (
          <>
            <div>
              <label style={labelStyle}>Phone number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handlePhoneSubmit()}
                autoFocus
                style={inputStyle}
              />
            </div>
            {error && <ErrorBox msg={error} />}
            <PrimaryButton onClick={() => void handlePhoneSubmit()} loading={loading} disabled={!phone.trim()}>
              Continue
            </PrimaryButton>
          </>
        )}

        {/* Mosque selection */}
        {step === 'mosque' && (
          <>
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {masjids.map((m) => (
                <button
                  key={m.masjidCode}
                  onClick={() => void handleMosqueSelect(m)}
                  disabled={loading}
                  style={{
                    background: '#F8FAFB', border: '1.5px solid #E2E8F0',
                    borderRadius: 20, padding: '18px 20px',
                    textAlign: 'left', cursor: loading ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: '#0F172A', margin: '0 0 3px' }}>{m.masjidName}</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{m.masjidCode}</p>
                  </div>
                  {loading
                    ? <Loader2 size={16} color="#94A3B8" style={{ animation: 'spin 1s linear infinite' }} />
                    : <ArrowRight size={16} color="#94A3B8" />
                  }
                </button>
              ))}
            </div>
          </>
        )}

        {/* OTP step */}
        {step === 'otp' && (
          <>
            <div>
              <label style={labelStyle}>Enter 6-digit code</label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {[0,1,2,3,4,5].map((i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={otpDigits[i] ?? ''}
                    autoFocus={i === 0}
                    onChange={(e) => handleOtpDigit(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKey(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    style={{
                      width: 46, height: 58, borderRadius: 16, textAlign: 'center',
                      fontSize: 24, fontWeight: 800, color: '#0F172A', fontFamily: 'inherit',
                      border: `2px solid ${otpDigits[i] ? '#15803D' : '#E2E8F0'}`,
                      background: otpDigits[i] ? '#ECFDF5' : '#F8FAFB',
                      outline: 'none', transition: 'border-color 0.15s, background 0.15s',
                      boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
            </div>
            {error && <ErrorBox msg={error} />}
            <PrimaryButton onClick={() => void handleOtpSubmit()} loading={loading} disabled={otp.replace(/\s/g,'').length !== 6}>
              Verify & Continue
            </PrimaryButton>
            <button
              onClick={() => void handleResend()}
              disabled={resendCooldown > 0 || loading}
              style={{
                background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer',
                fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: '8px 0', textAlign: 'center',
                color: resendCooldown > 0 ? '#94A3B8' : '#15803D',
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </>
        )}

      </div>
    </div>
  );
}

function isStepDone(current: Step, check: Exclude<Step, 'success'>): boolean {
  const order = ['phone', 'mosque', 'otp'];
  return order.indexOf(current) >= order.indexOf(check);
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}

// ─── Shared components ────────────────────────────────────────────────────────

function PrimaryButton({ onClick, loading, disabled, children }: {
  onClick: () => void; loading: boolean; disabled: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        width: '100%', height: 56, borderRadius: 18,
        background: loading || disabled ? '#D1FAE5' : 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
        color: loading || disabled ? '#86EFAC' : '#FFFFFF',
        border: 'none', cursor: loading || disabled ? 'default' : 'pointer',
        fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: loading || disabled ? 'none' : '0 8px 24px rgba(21,128,61,0.30)',
        transition: 'all 0.15s',
      }}
    >
      {loading && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 14, padding: '14px 16px',
    }}>
      <p style={{ fontSize: 14, color: '#EF4444', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{msg}</p>
    </div>
  );
}

const backBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 14,
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.12)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#374151',
  display: 'block', marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: 58, borderRadius: 20,
  border: '1.5px solid #E2E8F0', background: '#F8FAFB',
  padding: '0 20px', fontSize: 16, fontWeight: 500, color: '#0F172A',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
