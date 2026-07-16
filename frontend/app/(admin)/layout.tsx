'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (role && role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [role, router]);

  if (!role || role !== 'SUPER_ADMIN') {
    return null;
  }

  return <>{children}</>;
}
