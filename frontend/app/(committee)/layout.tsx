'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { silentRefresh } from '@/lib/api/auth.api';
import BottomNav from '@/components/layout/BottomNav';

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, user, isLoading, setAuth, setLoading, clear } = useAuthStore();

  useEffect(() => {
    if (accessToken) {
      setLoading(false);
      // mustChangePassword hard wall — enforced in login flow, but guard here too.
      if (user?.mustChangePassword) {
        router.replace('/change-password');
      }
      return;
    }

    // No token in memory — attempt silent refresh using the 'crt' httpOnly cookie.
    silentRefresh()
      .then(({ accessToken: newToken }) => {
        const payload = parseJwtPayload(newToken);
        setAuth(newToken, {
          id: payload['sub'] ?? '',
          name: 'Committee',
          role: (payload['role'] as 'SUPER_ADMIN' | 'COMMITTEE_ADMIN') ?? 'COMMITTEE_ADMIN',
          masjidId: payload['masjidId'] ?? null,
          mustChangePassword: false,
        });
      })
      .catch(() => {
        clear();
        router.replace('/login');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {children}
      <BottomNav />
    </div>
  );
}

function parseJwtPayload(token: string): Record<string, string> {
  try {
    const b64 = token.split('.')[1] ?? '';
    return JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, string>;
  } catch {
    return {};
  }
}
