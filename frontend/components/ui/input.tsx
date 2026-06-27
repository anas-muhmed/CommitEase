'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase Input — large, elegant, premium
   ───────────────────────────────────────────────────────────────────────── */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:        string;
  error?:        string;
  hint?:         string;
  leftElement?:  React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftElement,
  rightElement,
  className,
  id,
  style,
  ...props
}: InputProps) {
  const inputId = id ?? (label ? `ce-input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#111827',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 52,
          background: '#FFFFFF',
          border: `1.5px solid ${error ? '#D9534F' : '#E5E7EB'}`,
          borderRadius: 12,
          padding: '0 16px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        className={cn(
          'focus-within:border-[#0E7A52]',
          error
            ? 'focus-within:shadow-[0_0_0_3px_rgb(217_83_79_/_0.12)]'
            : 'focus-within:shadow-[0_0_0_3px_rgb(14_122_82_/_0.10)]',
        )}
      >
        {leftElement && (
          <span style={{ color: '#9CA3AF', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {leftElement}
          </span>
        )}

        <input
          id={inputId}
          className={cn(
            'flex-1 bg-transparent border-none outline-none min-w-0',
            'placeholder:text-[#9CA3AF]',
            className,
          )}
          style={{
            fontSize: 15,
            fontFamily: 'inherit',
            color: '#111827',
            ...style,
          }}
          {...props}
        />

        {rightElement && (
          <span style={{ color: '#9CA3AF', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {rightElement}
          </span>
        )}
      </div>

      {(error || hint) && (
        <p style={{
          fontSize: 12,
          fontWeight: 500,
          color: error ? '#D9534F' : '#6B7280',
          lineHeight: 1.4,
        }}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/* ── Textarea variant ─────────────────────────────────────────────────────── */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?:  string;
}

export function Textarea({ label, error, hint, className, id, style, ...props }: TextareaProps) {
  const inputId = id ?? (label ? `ce-ta-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'w-full placeholder:text-[#9CA3AF] outline-none resize-none',
          'focus:border-[#0E7A52] focus:shadow-[0_0_0_3px_rgb(14_122_82_/_0.10)]',
          className,
        )}
        style={{
          background: '#FFFFFF',
          border: `1.5px solid ${error ? '#D9534F' : '#E5E7EB'}`,
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 15,
          fontFamily: 'inherit',
          color: '#111827',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        {...props}
      />
      {(error || hint) && (
        <p style={{ fontSize: 12, fontWeight: 500, color: error ? '#D9534F' : '#6B7280' }}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
