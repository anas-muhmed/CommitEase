'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMemberAuthStore } from '@/lib/store/member-auth.store';
import { silentMemberRefresh } from '@/lib/api/member-auth.api';
import PortalBottomNav from '@/components/portal/PortalBottomNav';

const PUBLIC_PATHS = ['/portal/login', '/portal/join'];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, isLoading, updateToken, setLoading, clear } = useMemberAuthStore();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isPublic) { setLoading(false); return; }
    if (accessToken) { setLoading(false); return; }
    silentMemberRefresh()
      .then(({ accessToken: t }) => { updateToken(t); setLoading(false); })
      .catch(() => { clear(); router.replace('/portal/login'); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading && !isPublic) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)',
        fontFamily: "var(--font-inter, 'Inter', sans-serif)",
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2.5px solid rgba(255,255,255,0.15)',
            borderTopColor: '#C9A54C',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, fontWeight: 500 }}>Loading your account…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#F8FAFB',
      paddingBottom: isPublic ? 0 : 80,
      fontFamily: "var(--font-inter, 'Inter', -apple-system, sans-serif)",
    }}>
      {children}
      {!isPublic && <PortalBottomNav />}
    </div>
  );
}
