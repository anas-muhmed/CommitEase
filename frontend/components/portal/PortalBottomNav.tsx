'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Clock } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/portal/home',    label: 'Home',    icon: Home  },
  { href: '/portal/history', label: 'History', icon: Clock },
];

export default function PortalBottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      padding: '0 0 env(safe-area-inset-bottom, 0)',
    }}>
      <div style={{
        height: 68,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'stretch',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
      }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => { if (!active) router.replace(href); }}
              style={{
                flex: 1, background: 'none', border: 'none',
                cursor: active ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: 'inherit', position: 'relative',
              }}
            >
              {/* Active top line */}
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 32, height: 2.5, borderRadius: '0 0 2px 2px',
                  background: '#15803D',
                }} />
              )}

              {/* Icon */}
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: active ? '#ECFDF5' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}>
                <Icon size={20} color={active ? '#15803D' : '#94A3B8'} strokeWidth={active ? 2.2 : 1.8} />
              </div>

              {/* Label */}
              <span style={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? '#15803D' : '#94A3B8',
                letterSpacing: active ? 0 : 0.1,
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
