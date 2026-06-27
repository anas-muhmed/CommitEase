import * as React from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase Skeleton — premium shimmer loaders
   ───────────────────────────────────────────────────────────────────────── */

interface SkeletonProps {
  width?:     number | string;
  height?:    number | string;
  radius?:    number;
  className?: string;
  style?:     React.CSSProperties;
}

export function Skeleton({
  width,
  height  = 14,
  radius  = 8,
  className = '',
  style,
}: SkeletonProps) {
  return (
    <span
      className={`block ${className}`}
      style={{
        width:        width ?? '100%',
        height,
        borderRadius: radius,
        background:   '#E5E7EB',
        animation:    'ce-pulse 1.6s ease-in-out infinite',
        flexShrink:   0,
        ...style,
      }}
    />
  );
}

/* ── Skeleton list row: avatar + two text lines ──────────────────────────── */
export function SkeletonRow({
  lines  = 2,
  avatar = true,
}: {
  lines?:  number;
  avatar?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
      {avatar && (
        <Skeleton width={44} height={44} radius={22} />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width="52%" height={14} />
        {lines > 1 && <Skeleton width="32%" height={12} />}
      </div>
    </div>
  );
}

/* ── Skeleton card: white surface + N rows ──────────────────────────────── */
export function SkeletonCard({
  rows        = 4,
  withAvatar  = true,
}: {
  rows?:       number;
  withAvatar?: boolean;
}) {
  return (
    <div
      style={{
        background:   '#FFFFFF',
        borderRadius: 20,
        overflow:     'hidden',
        boxShadow:    '0 1px 3px rgb(17 24 39 / 0.04), 0 2px 8px rgb(17 24 39 / 0.05)',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{ borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}
        >
          <SkeletonRow avatar={withAvatar} />
        </div>
      ))}
    </div>
  );
}

/* ── Skeleton stat tile: label + large number ───────────────────────────── */
export function SkeletonStat() {
  return (
    <div
      style={{
        background:   '#FFFFFF',
        borderRadius: 20,
        padding:      '20px 24px',
        boxShadow:    '0 1px 3px rgb(17 24 39 / 0.04)',
        display:      'flex',
        flexDirection: 'column',
        gap:          12,
      }}
    >
      <Skeleton width="40%" height={12} />
      <Skeleton width="60%" height={32} radius={6} />
    </div>
  );
}

/* ── Skeleton hero card ─────────────────────────────────────────────────── */
export function SkeletonHero() {
  return (
    <div
      style={{
        background:   '#E5E7EB',
        borderRadius: 28,
        padding:      '28px 24px',
        animation:    'ce-pulse 1.6s ease-in-out infinite',
        display:      'flex',
        flexDirection: 'column',
        gap:          16,
      }}
    >
      <Skeleton width="40%" height={11} style={{ background: '#D1D5DB' }} />
      <Skeleton width="60%" height={44} radius={8} style={{ background: '#D1D5DB' }} />
      <Skeleton width="80%" height={12} style={{ background: '#D1D5DB' }} />
    </div>
  );
}
