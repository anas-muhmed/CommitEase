'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { login } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/store/auth.store';
import type { CommitteeRole } from '@/lib/store/auth.store';

const schema = z.object({
  masjidCode: z.string().min(1),
  username:   z.string().min(1),
  password:   z.string().min(1),
});
type F = z.infer<typeof schema>;

export default function LoginPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [show, setShow]   = useState(false);
  const [err,  setErr]    = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(v: F) {
    setErr('');
    try {
      const { accessToken, mustChangePassword } = await login(v);
      const p = jwtDecode(accessToken);
      setAuth(accessToken, {
        id: p['sub'] ?? '',
        name: 'Committee',
        role: (p['role'] as 'SUPER_ADMIN' | 'COMMITTEE_ADMIN') ?? 'COMMITTEE_ADMIN',
        masjidId: p['masjidId'] ?? null,
        mustChangePassword,
        committeeRole: (p['committeeRole'] as CommitteeRole) ?? undefined,
      });
      router.push(mustChangePassword ? '/change-password' : '/dashboard');
    } catch (e) {
      setErr(extractMsg(e));
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>

      {/* ── Brand ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        {/* Logo mark */}
        <div style={{
          width: 60, height: 60,
          borderRadius: 20,
          background: 'var(--gradient-hero)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 8px 24px rgb(12 102 64 / 0.30)',
        }}>
          <svg viewBox="0 0 32 32" fill="none" style={{ width: 34, height: 34 }}>
            <path d="M16 3 C16 3 11 7 11 11.5 V14 H8 V28 H24 V14 H21 V11.5 C21 7 16 3 16 3Z"
              fill="white" fillOpacity="0.92"/>
            <path d="M4.5 14 V28 H9.5 V14 Q7 12.5 4.5 14Z" fill="white" fillOpacity="0.55"/>
            <path d="M22.5 14 V28 H27.5 V14 Q25 12.5 22.5 14Z" fill="white" fillOpacity="0.55"/>
            <rect x="13.5" y="20" width="5" height="8" rx="1.5" fill="white" fillOpacity="0.5"/>
            <circle cx="16" cy="2.5" r="1.8" fill="white" fillOpacity="0.75"/>
          </svg>
        </div>

        <h1 className="type-title" style={{ color: '#0A1C12' }}>CommitEase</h1>
        <p className="type-label" style={{ color: '#7A9185', marginTop: 6, fontWeight: 500 }}>
          Committee Management Portal
        </p>
      </div>

      {/* ── Form card ──────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        boxShadow: '0 4px 24px rgb(10 28 18 / 0.07), 0 1px 4px rgb(10 28 18 / 0.05)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        <FormField label="Masjid Code" error={errors.masjidCode?.message}>
          <input
            placeholder="e.g. DEMO"
            autoCapitalize="characters"
            autoCorrect="off"
            style={inputStyle(!!errors.masjidCode)}
            {...register('masjidCode', { setValueAs: (v: string) => v.toUpperCase().trim() })}
          />
        </FormField>

        <FormField label="Username" error={errors.username?.message}>
          <input
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            style={inputStyle(!!errors.username)}
            {...register('username')}
          />
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          <div style={{ position: 'relative' }}>
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              style={{ ...inputStyle(!!errors.password), paddingRight: 44 }}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                color: '#7A9185', background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </FormField>

        {err && (
          <div style={{
            background: '#FDF2F1', borderRadius: 12,
            border: '1px solid rgb(192 57 43 / 0.2)',
            padding: '12px 16px',
          }}>
            <p className="type-label" style={{ color: '#C0392B' }}>{err}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          style={{
            width: '100%', height: 52,
            borderRadius: 16,
            background: isSubmitting ? '#7fbfa0' : 'var(--gradient-hero)',
            color: '#fff',
            border: 'none',
            cursor: isSubmitting ? 'default' : 'pointer',
            fontFamily: 'inherit',
            fontSize: 15, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 4,
            boxShadow: isSubmitting ? 'none' : '0 4px 16px rgb(12 102 64 / 0.28)',
            transition: 'opacity 0.15s',
          }}
        >
          {isSubmitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
          Sign In
        </button>
      </div>

      <p className="type-caption" style={{ textAlign: 'center', color: '#7A9185', marginTop: 24 }}>
        Secure · Simple · Transparent
      </p>
    </div>
  );
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label className="type-label" style={{ color: '#0A1C12' }}>{label}</label>
      {children}
      {error && <p className="type-caption" style={{ color: '#C0392B' }}>{error}</p>}
    </div>
  );
}

function inputStyle(hasErr: boolean): React.CSSProperties {
  return {
    width: '100%', height: 48,
    borderRadius: 12,
    border: `1.5px solid ${hasErr ? 'rgb(192 57 43 / 0.4)' : '#E2E8E3'}`,
    background: hasErr ? '#FDF2F1' : '#F4F5F1',
    padding: '0 16px',
    fontSize: 15, fontWeight: 500,
    color: '#0A1C12',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
}

function jwtDecode(t: string): Record<string, string> {
  try {
    const b = t.split('.')[1] ?? '';
    return JSON.parse(atob(b.replace(/-/g,'+').replace(/_/g,'/'))) as Record<string, string>;
  } catch { return {}; }
}

function extractMsg(e: unknown) {
  if (e && typeof e === 'object' && 'response' in e) {
    const r = (e as { response?: { data?: { message?: string } } }).response;
    return r?.data?.message ?? 'Sign in failed.';
  }
  return 'Sign in failed.';
}
