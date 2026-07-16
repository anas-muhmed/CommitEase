/* ─────────────────────────────────────────────────────────────────────────
   CommitEase MemberAvatar
   Hash-based color palette — 8 distinct, accessible pairs
   ───────────────────────────────────────────────────────────────────────── */

const PALETTES = [
  { bg: '#D1FAE5', fg: '#065F46' }, // emerald
  { bg: '#DBEAFE', fg: '#1E40AF' }, // blue
  { bg: '#EDE9FE', fg: '#5B21B6' }, // violet
  { bg: '#FEF3C7', fg: '#92400E' }, // amber
  { bg: '#CCFBF1', fg: '#0F766E' }, // teal
  { bg: '#FCE7F3', fg: '#9D174D' }, // pink
  { bg: '#FFE4E6', fg: '#9F1239' }, // rose
  { bg: '#E0E7FF', fg: '#3730A3' }, // indigo
];

function hashPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTES[Math.abs(h) % PALETTES.length]!;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const SIZE_MAP = {
  xs: { wh: 28, font: 10 },
  sm: { wh: 32, font: 11 },
  md: { wh: 40, font: 13 },
  lg: { wh: 48, font: 16 },
  xl: { wh: 64, font: 20 },
} as const;

interface MemberAvatarProps {
  name:       string;
  size?:      keyof typeof SIZE_MAP;
  className?: string;
}

export function MemberAvatar({ name, size = 'md', className = '' }: MemberAvatarProps) {
  const { bg, fg } = hashPalette(name);
  const { wh, font } = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center select-none rounded-full ${className}`}
      style={{
        width:           wh,
        height:          wh,
        minWidth:        wh,
        backgroundColor: bg,
        color:           fg,
        fontSize:        font,
        fontWeight:      700,
        letterSpacing:   '0.01em',
        lineHeight:      1,
      }}
    >
      {getInitials(name)}
    </span>
  );
}
