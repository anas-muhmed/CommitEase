'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

const PORTAL_FONT = "var(--font-inter, 'Inter', -apple-system, sans-serif)";

const CARDS = [
  {
    href: '/portal/login',
    badge: 'FOR MEMBERS',
    title: 'Member',
    description: 'Check dues, receipts, chelav & payment history',
    iconBg: 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
    iconContent: (
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="7" r="4" stroke="#fff" strokeWidth="2"/>
      </svg>
    ),
    arrowBg: 'linear-gradient(135deg, #15803D, #0E6B43)',
    arrowShadow: '0 4px 12px rgba(21,128,61,0.40)',
    disabled: false,
    badgeColor: '#15803D',
  },
  {
    href: '/login',
    badge: 'FOR COMMITTEE',
    title: 'Committee Member',
    description: 'Manage members, payments, expenses & reports',
    iconBg: 'linear-gradient(135deg, #C9A54C 0%, #a8873a 100%)',
    iconContent: (
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
      </svg>
    ),
    arrowBg: 'linear-gradient(135deg, #C9A54C, #a8873a)',
    arrowShadow: '0 4px 12px rgba(201,165,76,0.40)',
    disabled: false,
    badgeColor: '#C9A54C',
  },
  {
    href: '#',
    badge: 'COMING SOON',
    title: 'Mosque Space',
    description: 'Announcements, donations & community updates',
    iconBg: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    iconContent: (
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
        <path d="M12 2L8 6v2H5v14h14V8h-3V6L12 2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        <rect x="9.5" y="14" width="5" height="8" rx="1" stroke="#fff" strokeWidth="1.8"/>
        <circle cx="12" cy="2.5" r="1.2" fill="#fff" fillOpacity="0.7"/>
      </svg>
    ),
    arrowBg: 'rgba(255,255,255,0.08)',
    arrowShadow: 'none',
    disabled: true,
    badgeColor: '#94A3B8',
  },
];

export default function GatewayPage() {
  return (
    <div style={{ minHeight: '100dvh', position: 'relative', fontFamily: PORTAL_FONT }}>

      {/*
        Mosque background — Next.js Image handles:
        · WebP/AVIF conversion (40-70% smaller than source JPG)
        · Responsive srcset (mobile gets ~640w, not full 1920w)
        · priority = adds <link rel="preload"> so it loads with the HTML, not after
        · quality 78 = sweet spot for photographic content
        Source file tip: compress to ≤400KB at squoosh.app before deploying.
      */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Image
          src="/mosque-bg.jpg"
          alt=""
          fill
          priority
          quality={78}
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center top' }}
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABQQG/8QAHhAAAAUFAQAAAAAAAAAAAAAAAQIDBAUSITH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqUFZSqpqxlDNMVoWZqR8bPAiMVYAAA=="
        />
      </div>

      {/* Dark gradient overlay — readable over photo, also the standalone fallback */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1,
        background: 'linear-gradient(180deg, rgba(3,17,12,0.68) 0%, rgba(6,37,28,0.78) 45%, rgba(3,11,8,0.93) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '64px 20px 52px',
      }}>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 48 }}>
          {/* Mosque icon */}
          <div style={{
            width: 68, height: 68, borderRadius: 22,
            background: 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
            backdropFilter: 'blur(12px)',
          }}>
            <svg viewBox="0 0 32 32" fill="none" style={{ width: 36, height: 36 }}>
              <path d="M16 3C16 3 11 7 11 11.5V14H8V28H24V14H21V11.5C21 7 16 3 16 3Z" fill="white" fillOpacity="0.9"/>
              <path d="M4.5 14V28H9.5V14Q7 12.5 4.5 14Z" fill="white" fillOpacity="0.45"/>
              <path d="M22.5 14V28H27.5V14Q25 12.5 22.5 14Z" fill="white" fillOpacity="0.45"/>
              <rect x="13.5" y="20" width="5" height="8" rx="1.5" fill="white" fillOpacity="0.4"/>
              <circle cx="16" cy="2.5" r="1.8" fill="white" fillOpacity="0.65"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px', letterSpacing: -0.8 }}>
            <span style={{ color: '#FFFFFF' }}>Commit</span><span style={{ color: '#C9A54C' }}>Ease</span>
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Serve Better. Together.
          </p>
        </div>

        {/* Cards */}
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CARDS.map((card) => (
            card.disabled ? (
              <DisabledCard key={card.title} card={card} />
            ) : (
              <PortalCard key={card.title} card={card} />
            )
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 44, display: 'flex', gap: 24, alignItems: 'center' }}>
          {['Secure', 'Private', 'Transparent'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {i > 0 && <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)', marginRight: 19 }} />}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                {i === 0 && <path d="M6 1L1.5 2.5v3.5C1.5 8.5 3.5 10.5 6 11c2.5-.5 4.5-2.5 4.5-5V2.5L6 1z" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinejoin="round"/>}
                {i === 1 && <><rect x="2" y="5" width="8" height="6" rx="1.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/><path d="M4 5V3.5a2 2 0 0 1 4 0V5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/></>}
                {i === 2 && <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2"/>}
              </svg>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 14 }}>
          Made with ♥ for better community
        </p>
      </div>
    </div>
  );
}

type CardData = typeof CARDS[number];

function PortalCard({ card }: { card: CardData }) {
  return (
    <Link href={card.href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 20,
        padding: '20px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
          background: card.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
        }}>
          {card.iconContent}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: card.badgeColor, display: 'block', marginBottom: 4 }}>
            I am a
          </span>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#0A1C12', margin: '0 0 3px', lineHeight: 1.2 }}>
            <span style={{ color: card.badgeColor }}>{card.title}</span>
          </p>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.4 }}>
            {card.description}
          </p>
        </div>

        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: card.arrowBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: card.arrowShadow,
        }}>
          <ArrowRight size={16} color="#fff" />
        </div>
      </div>
    </Link>
  );
}

function DisabledCard({ card }: { card: CardData }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 20, padding: '20px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
        background: card.iconBg, opacity: 0.55,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {card.iconContent}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 4 }}>
          I want to explore
        </span>
        <p style={{ fontSize: 17, fontWeight: 800, color: 'rgba(255,255,255,0.45)', margin: '0 0 3px' }}>{card.title}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>{card.description}</p>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 100,
        whiteSpace: 'nowrap',
      }}>
        Coming Soon
      </span>
    </div>
  );
}
