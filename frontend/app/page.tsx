'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const PORTAL_FONT = "var(--font-inter, 'Inter', -apple-system, sans-serif)";

const CARDS = [
  {
    href: '/portal/login',
    badge: 'FOR MEMBERS',
    title: 'Member Portal',
    description: 'View dues, receipts and chelav schedule',
    iconBg: 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
    iconContent: (
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="7" r="4" stroke="#fff" strokeWidth="2"/>
      </svg>
    ),
    disabled: false,
    primary: true,
  },
  {
    href: '/login',
    badge: 'FOR COMMITTEE',
    title: 'Committee Portal',
    description: 'Manage members, payments and finances',
    iconBg: 'linear-gradient(135deg, #C9A54C 0%, #a8873a 100%)',
    iconContent: (
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#fff" strokeWidth="2"/>
      </svg>
    ),
    disabled: false,
    primary: false,
  },
  {
    href: '#',
    badge: 'COMING SOON',
    title: 'Mosque Space',
    description: 'Public info, announcements and events',
    iconBg: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    iconContent: (
      <svg viewBox="0 0 24 24" fill="none" style={{ width: 22, height: 22 }}>
        <path d="M12 2L8 6v2H5v14h14V8h-3V6L12 2z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"/>
        <rect x="9.5" y="14" width="5" height="8" rx="1" stroke="#fff" strokeWidth="1.8"/>
        <circle cx="12" cy="2.5" r="1.2" fill="#fff" fillOpacity="0.7"/>
      </svg>
    ),
    disabled: true,
    primary: false,
  },
];

export default function GatewayPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(circle at top, #0f5d3b 0%, #06251c 45%, #03110c 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '60px 20px 48px',
      fontFamily: PORTAL_FONT,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 52 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
          backdropFilter: 'blur(8px)',
        }}>
          <svg viewBox="0 0 32 32" fill="none" style={{ width: 34, height: 34 }}>
            <path d="M16 3C16 3 11 7 11 11.5V14H8V28H24V14H21V11.5C21 7 16 3 16 3Z" fill="white" fillOpacity="0.9"/>
            <path d="M4.5 14V28H9.5V14Q7 12.5 4.5 14Z" fill="white" fillOpacity="0.45"/>
            <path d="M22.5 14V28H27.5V14Q25 12.5 22.5 14Z" fill="white" fillOpacity="0.45"/>
            <rect x="13.5" y="20" width="5" height="8" rx="1.5" fill="white" fillOpacity="0.4"/>
            <circle cx="16" cy="2.5" r="1.8" fill="white" fillOpacity="0.65"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px', letterSpacing: -0.5 }}>
          CommitEase
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, fontWeight: 400 }}>
          Mosque Committee Management
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

      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 44, fontWeight: 400, letterSpacing: 0.5 }}>
        SECURE · SIMPLE · TRANSPARENT
      </p>
    </div>
  );
}

type CardData = typeof CARDS[number];

function PortalCard({ card }: { card: CardData }) {
  return (
    <Link href={card.href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: 24,
        padding: '22px 20px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
      }}>
        {/* Circular icon */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: card.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
        }}>
          {card.iconContent}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            color: card.primary ? '#15803D' : '#C9A54C',
            display: 'block', marginBottom: 5,
          }}>
            {card.badge}
          </span>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#0A1C12', margin: '0 0 3px', lineHeight: 1.2 }}>
            {card.title}
          </p>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, fontWeight: 400, lineHeight: 1.4 }}>
            {card.description}
          </p>
        </div>

        {/* Floating arrow */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: card.primary
            ? 'linear-gradient(135deg, #15803D, #0E6B43)'
            : 'linear-gradient(135deg, #C9A54C, #a8873a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: card.primary ? '0 4px 12px rgba(21,128,61,0.35)' : '0 4px 12px rgba(201,165,76,0.35)',
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
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 24,
      padding: '22px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      opacity: 0.55,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        background: card.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.6,
      }}>
        {card.iconContent}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5 }}>
          {card.badge}
        </span>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '0 0 3px' }}>{card.title}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>{card.description}</p>
      </div>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ArrowRight size={16} color="rgba(255,255,255,0.3)" />
      </div>
    </div>
  );
}
