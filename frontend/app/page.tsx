'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Receipt, CalendarDays, BarChart2, ShieldCheck } from 'lucide-react';

const FONT = "var(--font-inter, 'Inter', -apple-system, sans-serif)";

const TRUST = [
  { icon: Receipt,      label: 'Instant Receipts'    },
  { icon: CalendarDays, label: 'Chelav Schedule'      },
  { icon: BarChart2,    label: 'Live Dues Tracking'   },
  { icon: ShieldCheck,  label: 'Secure Access'        },
];

const BLUR_PLACEHOLDER =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAEAAQDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABQQG/8QAHhAAAAUFAQAAAAAAAAAAAAAAAQIDBAUSITH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqUFZSqpqxlDNMVoWZqR8bPAiMVYAAA==';

export default function GatewayPage() {
  return (
    <div style={{ minHeight: '100dvh', position: 'relative', fontFamily: FONT }}>

      {/* ── Background image ────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Image
          src="/mosque-bg.jpg"
          alt=""
          fill
          priority
          quality={78}
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center top', filter: 'brightness(0.78) saturate(0.9)' }}
          placeholder="blur"
          blurDataURL={BLUR_PLACEHOLDER}
        />
      </div>

      {/* Gradient overlay — darkens bottom, preserves sky mood at top */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'linear-gradient(170deg, rgba(2,10,6,0.62) 0%, rgba(3,14,8,0.75) 35%, rgba(1,6,3,0.94) 100%)',
      }} />

      {/* ── Page content ────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100dvh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '64px 24px 52px',
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 52 }}>
          {/* Logo mark */}
          <div style={{
            width: 58, height: 58, borderRadius: 18,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}>
            <MosqueIcon />
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: '0 0 9px', letterSpacing: -0.7, lineHeight: 1 }}>
            CommitEase
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', margin: 0, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase' }}>
            Transparent Mosque Management
          </p>
        </header>

        {/* ── HERO CARD ───────────────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            borderRadius: 28,
            padding: '32px 28px 28px',
            boxShadow: '0 40px 100px rgba(0,0,0,0.42), 0 8px 28px rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.65)',
          }}>
            {/* Badge */}
            <span style={{
              display: 'inline-block', marginBottom: 22,
              fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
              color: '#15803D', background: '#DCFCE7', borderRadius: 100,
              padding: '4px 12px',
            }}>
              For Members
            </span>

            {/* Title */}
            <h2 style={{ fontSize: 32, fontWeight: 800, color: '#0A1C12', margin: '0 0 12px', letterSpacing: -1.2, lineHeight: 1.05 }}>
              Member Portal
            </h2>

            {/* Description */}
            <p style={{ fontSize: 15, color: '#64748B', margin: '0 0 28px', lineHeight: 1.65, fontWeight: 400 }}>
              Check dues, receipts, chelav schedule, and payment history.
            </p>

            {/* Primary CTA */}
            <Link href="/portal/login" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                height: 56, borderRadius: 18,
                background: 'linear-gradient(135deg, #15803D 0%, #0E6B43 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 10px 28px rgba(21,128,61,0.38)',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', letterSpacing: -0.2 }}>Enter Portal</span>
                <ArrowRight size={17} color="#FFFFFF" />
              </div>
            </Link>
          </div>
        </div>

        {/* ── TRUST PILLS ─────────────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: 400, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 16, padding: '13px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
              <Icon size={15} color="rgba(255,255,255,0.55)" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.62)', letterSpacing: -0.1 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Flexible spacer — pushes committee footer to bottom */}
        <div style={{ flex: 1 }} />

        {/* ── COMMITTEE FOOTER ────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: '0 0 10px', fontWeight: 400, letterSpacing: 0.2 }}>
            Committee access?
          </p>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '9px 22px', borderRadius: 100, display: 'inline-block',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              letterSpacing: 0.1,
            }}>
              Committee Sign In
            </span>
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── Mosque icon SVG ──────────────────────────────────────────────────────────

function MosqueIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" style={{ width: 30, height: 30 }}>
      <path d="M16 3C16 3 11 7 11 11.5V14H8V28H24V14H21V11.5C21 7 16 3 16 3Z" fill="white" fillOpacity="0.92"/>
      <path d="M4.5 14V28H9.5V14Q7 12.5 4.5 14Z" fill="white" fillOpacity="0.42"/>
      <path d="M22.5 14V28H27.5V14Q25 12.5 22.5 14Z" fill="white" fillOpacity="0.42"/>
      <rect x="13.5" y="20" width="5" height="8" rx="1.5" fill="white" fillOpacity="0.38"/>
      <circle cx="16" cy="2.5" r="1.8" fill="white" fillOpacity="0.62"/>
    </svg>
  );
}
