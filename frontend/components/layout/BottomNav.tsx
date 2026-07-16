'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, CreditCard, Wallet, TrendingUp } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase — Floating Dock
   76px height, backdrop-blur-xl, bg-white/88, premium shadow, green pill.
   Mobile: icons only  ·  md+: icons + labels
   ───────────────────────────────────────────────────────────────────────── */

const NAV = [
  { href: '/dashboard', label: 'Home',     Icon: LayoutDashboard },
  { href: '/members',   label: 'Members',  Icon: Users },
  { href: '/payments',  label: 'Payments', Icon: CreditCard },
  { href: '/finance',   label: 'Finance',  Icon: Wallet },
  { href: '/insights',  label: 'Insights', Icon: TrendingUp },
] as const;

export default function BottomNav() {
  const path = usePathname();

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 pb-1">
      <nav className="flex items-center gap-1.5 rounded-full bg-white/[0.88] backdrop-blur-xl border border-white/50 shadow-[0_24px_80px_rgba(15,23,42,0.14),0_4px_16px_rgba(15,23,42,0.07)] px-4 py-3">
        {NAV.map(({ href, label, Icon }) => {
          const active = path.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2 rounded-full transition-all duration-200 select-none',
                /* mobile: compact square tap target; md: wider with label */
                'px-4 py-2.5 md:px-5',
                active
                  ? 'bg-[#0E7A52] text-white shadow-[0_4px_18px_rgba(14,122,82,0.38)]'
                  : 'text-[#9CA3AF] hover:text-[#6B7280] hover:bg-gray-100/70',
              ].join(' ')}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 1.8}
              />
              <span className={`hidden md:inline text-[12.5px] whitespace-nowrap ${active ? 'font-bold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
