import * as React from 'react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase Card System

   CE surfaces (use these for screens):
     <Surface>        — default white card, soft shadow, radius 20
     <Surface elevated> — stronger shadow
     <Surface hero>     — gradient hero card, radius 28
     <Surface inset>    — tinted surface for nested content

   Shadcn primitives preserved below for library compatibility.
   ───────────────────────────────────────────────────────────────────────── */

/* ── CE Surface ───────────────────────────────────────────────────────────── */
export type SurfaceVariant = 'default' | 'elevated' | 'hero' | 'inset' | 'danger' | 'success';

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  radius?:  12 | 20 | 28;
  padding?: number | string;
}

const SURFACE_STYLE: Record<SurfaceVariant, React.CSSProperties> = {
  default:  {
    background: '#FFFFFF',
    boxShadow:  '0 1px 3px rgb(17 24 39 / 0.04), 0 2px 8px rgb(17 24 39 / 0.05)',
  },
  elevated: {
    background: '#FFFFFF',
    boxShadow:  '0 2px 8px rgb(17 24 39 / 0.06), 0 8px 24px rgb(17 24 39 / 0.08)',
  },
  hero: {
    background: 'var(--gradient-hero)',
    boxShadow:  '0 4px 24px rgb(14 122 82 / 0.20)',
  },
  inset: {
    background: '#F7F7F2',
    boxShadow:  'none',
  },
  danger: {
    background: '#FEF2F2',
    border:     '1px solid rgb(217 83 79 / 0.15)',
    boxShadow:  'none',
  },
  success: {
    background: '#F0FDF4',
    border:     '1px solid rgb(22 163 74 / 0.15)',
    boxShadow:  'none',
  },
};

export function Surface({
  variant = 'default',
  radius  = 20,
  padding,
  children,
  className,
  style,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn('overflow-hidden', className)}
      style={{
        borderRadius: radius,
        ...SURFACE_STYLE[variant],
        ...(padding !== undefined ? { padding } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── CE List surface: Surface with auto-dividers ──────────────────────────── */
interface ListSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Extract<SurfaceVariant, 'default' | 'elevated'>;
  radius?:  12 | 20 | 28;
}

export function ListSurface({ variant = 'default', radius = 20, children, className, style, ...props }: ListSurfaceProps) {
  const childArray = React.Children.toArray(children);
  return (
    <Surface variant={variant} radius={radius} className={className} style={style} {...props}>
      {childArray.map((child, i) => (
        <div
          key={i}
          style={{ borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}
        >
          {child}
        </div>
      ))}
    </Surface>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shadcn-compatible primitives (kept for library compatibility)
   ══════════════════════════════════════════════════════════════════════════ */

function Card({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm' }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-(--card-spacing)', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)', className)}
      {...props}
    />
  );
}

export {
  Card, CardHeader, CardFooter, CardTitle,
  CardAction, CardDescription, CardContent,
};
