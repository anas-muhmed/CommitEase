'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { cn } from '@/lib/utils';

const schema = z.object({
  masjidCode: z.string().min(1, 'Masjid code is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      const { accessToken, mustChangePassword } = await login(values);

      // Decode the JWT payload (client-side only, for display — NOT for security).
      // The JWT contains: sub (userId), masjidId, role, type. Name is not in JWT.
      const payload = parseJwtPayload(accessToken);
      setAuth(accessToken, {
        id: payload['sub'] ?? '',
        name: 'Committee',
        role: (payload['role'] as 'SUPER_ADMIN' | 'COMMITTEE_ADMIN') ?? 'COMMITTEE_ADMIN',
        masjidId: payload['masjidId'] ?? null,
        mustChangePassword,
      });

      router.push(mustChangePassword ? '/change-password' : '/dashboard');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err);
      setServerError(msg);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Wordmark */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">CommitEase</h1>
        <p className="text-sm text-muted-foreground">Committee Management</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="masjidCode">Masjid Code</Label>
          <Input
            id="masjidCode"
            placeholder="e.g. AL-AMIN"
            autoCapitalize="characters"
            autoCorrect="off"
            className="uppercase placeholder:normal-case"
            {...register('masjidCode', {
              setValueAs: (v: string) => v.toUpperCase().trim(),
            })}
          />
          {errors.masjidCode && (
            <p className="text-xs text-destructive">{errors.masjidCode.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoCorrect="off"
            autoCapitalize="none"
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-destructive">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pr-10"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm text-destructive">{serverError}</p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Need help? Contact your masjid administrator.
      </p>
    </div>
  );
}

// Decode JWT payload for display-only user info (not for security verification).
function parseJwtPayload(token: string): Record<string, string> {
  try {
    const b64 = token.split('.')[1] ?? '';
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, string>;
  } catch {
    return {};
  }
}

function extractErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = err.response.data as { message?: string };
    return data.message ?? 'Sign in failed. Please try again.';
  }
  return 'Sign in failed. Please try again.';
}
