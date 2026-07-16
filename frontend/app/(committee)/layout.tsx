'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import type { CommitteeRole } from '@/lib/store/auth.store';
import { silentRefresh } from '@/lib/api/auth.api';
import BottomNav from '@/components/layout/BottomNav';

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, user, isLoading, setAuth, setLoading, clear } = useAuthStore();

  useEffect(() => {
    if (accessToken) {
      setLoading(false);
      if (user?.mustChangePassword) router.replace('/change-password');
      return;
    }
    silentRefresh()
      .then(({ accessToken: t }) => {
        const p = jwtDecode(t);
        setAuth(t, {
          id: p['sub'] ?? '',
          name: 'Committee',
          role: (p['role'] as 'SUPER_ADMIN' | 'COMMITTEE_ADMIN') ?? 'COMMITTEE_ADMIN',
          masjidId: p['masjidId'] ?? null,
          mustChangePassword: p['mustChangePassword'] === 'true',
          committeeRole: (p['committeeRole'] as CommitteeRole) ?? undefined,
        });
      })
      .catch(() => { clear(); router.replace('/login'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F4F5F1',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2.5px solid #E2E8E3',
          borderTopColor: '#0C6640',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F1', paddingBottom: 64 }}>
      {children}
      <BottomNav />
    </div>
  );
}

function jwtDecode(t: string): Record<string, string> {
  try {
    const b = t.split('.')[1] ?? '';
    return JSON.parse(atob(b.replace(/-/g,'+').replace(/_/g,'/'))) as Record<string, string>;
  } catch { return {}; }
}
