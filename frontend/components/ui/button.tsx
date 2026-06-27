'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase Button — premium, tactile, intentional
   Variants:  primary | secondary | ghost | danger | gold
   Sizes:     sm (36px) | md (44px) | lg (52px)
   ───────────────────────────────────────────────────────────────────────── */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  fullWidth?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background:  'var(--gradient-primary)',
    color:       '#FFFFFF',
    border:      'none',
    boxShadow:   '0 4px 14px rgb(14 122 82 / 0.28)',
  },
  secondary: {
    background:  '#FFFFFF',
    color:       '#111827',
    border:      '1.5px solid #E5E7EB',
    boxShadow:   '0 1px 3px rgb(17 24 39 / 0.06)',
  },
  ghost: {
    background:  'transparent',
    color:       '#0E7A52',
    border:      'none',
    boxShadow:   'none',
  },
  danger: {
    background:  '#FEF2F2',
    color:       '#D9534F',
    border:      '1.5px solid rgb(217 83 79 / 0.20)',
    boxShadow:   'none',
  },
  gold: {
    background:  'var(--gradient-gold)',
    color:       '#FFFFFF',
    border:      'none',
    boxShadow:   '0 4px 14px rgb(212 175 55 / 0.28)',
  },
};

const SIZE_STYLE: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 36, paddingLeft: 16, paddingRight: 16, fontSize: 13, fontWeight: 600, borderRadius: 12 },
  md: { height: 44, paddingLeft: 20, paddingRight: 20, fontSize: 14, fontWeight: 600, borderRadius: 20 },
  lg: { height: 52, paddingLeft: 24, paddingRight: 24, fontSize: 15, fontWeight: 700, borderRadius: 20 },
};

const HOVER_CLASS: Record<ButtonVariant, string> = {
  primary:   'hover:brightness-105 hover:shadow-[0_6px_20px_rgb(14_122_82_/_0.35)]',
  secondary: 'hover:border-[#D1D5DB] hover:shadow-[0_2px_8px_rgb(17_24_39_/_0.08)]',
  ghost:     'hover:bg-[#E8F5EF]',
  danger:    'hover:bg-[#D9534F] hover:text-white hover:border-transparent hover:shadow-[0_4px_12px_rgb(217_83_79_/_0.25)]',
  gold:      'hover:brightness-105 hover:shadow-[0_6px_20px_rgb(212_175_55_/_0.35)]',
};

export function Button({
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
        'transition-all duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7A52]/40 focus-visible:ring-offset-2',
        'active:scale-[0.97]',
        'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none',
        HOVER_CLASS[variant],
        className,
      )}
      style={{
        ...VARIANT_STYLE[variant],
        ...SIZE_STYLE[size],
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'inherit',
        cursor: isDisabled ? 'default' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: size === 'sm' ? 12 : 14,
            height: size === 'sm' ? 12 : 14,
            borderRadius: '50%',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            animation: 'ce-spin 0.65s linear infinite',
            flexShrink: 0,
          }}
        />
      ) : leftIcon ? (
        <span style={{ flexShrink: 0, display: 'flex' }}>{leftIcon}</span>
      ) : null}
      {children}
      {!loading && rightIcon && (
        <span style={{ flexShrink: 0, display: 'flex' }}>{rightIcon}</span>
      )}
    </button>
  );
}

/* Icon-only button */
export function IconButton({
  size    = 'md',
  variant = 'secondary',
  className,
  style,
  ...props
}: Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'fullWidth'>) {
  const dim = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;
  const radius = size === 'sm' ? 12 : 20;
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      style={{ width: dim, height: dim, padding: 0, borderRadius: radius, ...style }}
      {...props}
    />
  );
}
