'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Invite link handler: /portal/join/:masjidCode
// Looks up the masjid name from the code, then redirects to login with it pre-filled.

export default function JoinPage() {
  const router = useRouter();
  const { masjidCode } = useParams<{ masjidCode: string }>();

  useEffect(() => {
    if (!masjidCode) { router.replace('/portal/login'); return; }

    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

    fetch(`${BASE_URL}/public/masjid-name?code=${encodeURIComponent(masjidCode)}`)
      .then((r) => r.json())
      .then((json) => {
        const name = (json?.data?.name as string | undefined) ?? masjidCode;
        router.replace(`/portal/login?masjidCode=${encodeURIComponent(masjidCode)}&masjidName=${encodeURIComponent(name)}`);
      })
      .catch(() => {
        // Fallback: pass code without name — login page will handle it
        router.replace(`/portal/login?masjidCode=${encodeURIComponent(masjidCode)}&masjidName=${encodeURIComponent(masjidCode)}`);
      });
  }, [masjidCode, router]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F2' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Loader2 size={32} color="#0E7A52" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Opening your portal…</p>
      </div>
    </div>
  );
}
