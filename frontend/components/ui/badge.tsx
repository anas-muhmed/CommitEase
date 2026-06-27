import * as React from 'react';

/* ─────────────────────────────────────────────────────────────────────────
   CommitEase Badge
   Variants: default | primary | success | warning | danger | gold
   ───────────────────────────────────────────────────────────────────────── */

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'gold';

interface BadgeProps {
  variant?:   BadgeVariant;
  children:   React.ReactNode;
  className?: string;
  style?:     React.CSSProperties;
  dot?:       boolean;
}

const STYLE: Record<BadgeVariant, React.CSSProperties> = {
  default:  { background: '#F3F4F6', color: '#6B7280' },
  primary:  { background: '#E8F5EF', color: '#0E7A52' },
  success:  { background: '#F0FDF4', color: '#16A34A' },
  warning:  { background: '#FFFBEB', color: '#D97706' },
  danger:   { background: '#FEF2F2', color: '#D9534F' },
  gold:     { background: '#FBF5E0', color: '#B8960C' },
};

const DOT_COLOR: Record<BadgeVariant, string> = {
  default:  '#9CA3AF',
  primary:  '#0E7A52',
  success:  '#16A34A',
  warning:  '#F59E0B',
  danger:   '#D9534F',
  gold:     '#D4AF37',
};

export function Badge({ variant = 'default', children, className = '', style, dot }: BadgeProps) {
  return (
    <span
      className={`type-micro inline-flex items-center gap-1 ${className}`}
      style={{
        padding:      '3px 8px',
        borderRadius: 8,
        ...STYLE[variant],
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   DOT_COLOR[variant],
            flexShrink:   0,
          }}
        />
      )}
      {children}
    </span>
  );
}

/* ── Status badge — convenience wrapper for member/payment states ─────────── */
export function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const variant: BadgeVariant =
    lower === 'active'   ? 'primary'  :
    lower === 'inactive' ? 'default'  :
    lower === 'paid'     ? 'success'  :
    lower === 'partial'  ? 'warning'  :
    lower === 'overdue'  ? 'danger'   :
    lower === 'reversed' ? 'default'  :
    'default';

  const label =
    lower === 'active'   ? 'Active'   :
    lower === 'inactive' ? 'Inactive' :
    lower === 'paid'     ? 'Paid'     :
    lower === 'partial'  ? 'Partial'  :
    lower === 'overdue'  ? 'Overdue'  :
    lower === 'reversed' ? 'Reversed' :
    status;

  return <Badge variant={variant} dot>{label}</Badge>;
}
