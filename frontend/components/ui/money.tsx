import * as React from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase Money component
   Renders: ₹ 1,23,456.00  (en-IN locale, space after ₹, tabular nums)

   Usage:
     <Money amount={700} />                → ₹ 700.00
     <Money amount="12500.5" size="hero" /> → hero-scale ₹ 12,500.50
     <Money amount={0} decimals={false} />  → ₹ 0
     fmtMoney(700)                          → "₹ 700.00" (string)
   ───────────────────────────────────────────────────────────────────────── */

export type MoneySize = 'hero' | 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

interface MoneyProps {
  amount:    string | number;
  size?:     MoneySize;
  decimals?: boolean;
  color?:    string;
  className?: string;
  style?:    React.CSSProperties;
}

const SIZE_CLASS: Record<MoneySize, string> = {
  hero:    'type-hero',
  display: 'type-display',
  title:   'type-title',
  heading: 'type-heading',
  body:    'type-body-strong',
  label:   'type-label',
  caption: 'type-caption',
};

export function Money({
  amount,
  size     = 'body',
  decimals = true,
  color,
  className = '',
  style,
}: MoneyProps) {
  const v = typeof amount === 'string' ? parseFloat(amount) : amount;
  const invalid = isNaN(v);

  const formatted = invalid
    ? '—'
    : v.toLocaleString('en-IN', {
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 0,
      });

  return (
    <span
      className={`${SIZE_CLASS[size]} ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums', color, ...style }}
    >
      {/* Non-breaking space between ₹ and number — premium spacing */}
      ₹{' '}{formatted}
    </span>
  );
}

/** Format money to plain string: ₹ 1,23,456.00 */
export function fmtMoney(amount: string | number, decimals = true): string {
  const v = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(v)) return '₹ —';
  const formatted = v.toLocaleString('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `₹ ${formatted}`;
}
