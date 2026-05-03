import { type UIFontSize } from '../shared/messaging'
import { type SpaceColor } from '../shared/types'

// Tokens are CSS variables defined globally in globalStyles. Components
// reference them via `var(--token)`; this lets prefers-color-scheme
// swap the whole palette without re-rendering React.
export const tokens = {
  fg: 'var(--fg)',
  muted: 'var(--muted)',
  subtle: 'var(--subtle)',
  border: 'var(--border)',
  bg: 'var(--bg)',
  bgSoft: 'var(--bg-soft)',
  bgHover: 'var(--bg-hover)',
  bgActive: 'var(--bg-active)',
  accent: 'var(--accent)',
  accentSoft: 'var(--accent-soft)',
  danger: 'var(--danger)',
  shadow: 'var(--shadow)',
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    pill: '999px',
  },
  duration: {
    fast: '80ms',
    medium: '200ms',
  },
} as const

export const COLORS: SpaceColor[] = [
  'blue',
  'red',
  'green',
  'yellow',
  'cyan',
  'purple',
  'pink',
  'orange',
  'grey',
]

export const COLOR_HEX: Record<SpaceColor, string> = {
  grey: '#9aa0a6',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#fa7b17',
}

export const FONT_SCALE: Record<UIFontSize, number> = {
  1: 0.85,
  2: 0.92,
  3: 1.0,
  4: 1.12,
  5: 1.25,
}

export const FONT_LABELS: Record<UIFontSize, string> = {
  1: 'XS',
  2: 'S',
  3: 'M',
  4: 'L',
  5: 'XL',
}

export function applyFontSize(size: UIFontSize): void {
  ;(document.documentElement.style as { zoom?: string }).zoom = String(
    FONT_SCALE[size],
  )
}
