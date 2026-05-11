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

// Arc-style ambient gradient applied to the side panel root for the
// active Space. The translucent stops let the underlying --bg show
// through, so the same gradient stays readable in both light and dark
// modes without re-keying per scheme.
export const COLOR_GRADIENT: Record<SpaceColor, string> = {
  grey: 'linear-gradient(155deg, rgba(154, 160, 166, 0.32) 0%, rgba(154, 160, 166, 0) 60%)',
  blue: 'linear-gradient(155deg, rgba(106, 183, 255, 0.40) 0%, rgba(26, 115, 232, 0.10) 70%)',
  red: 'linear-gradient(155deg, rgba(255, 138, 128, 0.40) 0%, rgba(217, 48, 37, 0.10) 70%)',
  yellow:
    'linear-gradient(155deg, rgba(255, 213, 79, 0.45) 0%, rgba(249, 171, 0, 0.10) 70%)',
  green:
    'linear-gradient(155deg, rgba(102, 187, 106, 0.40) 0%, rgba(24, 128, 56, 0.10) 70%)',
  pink: 'linear-gradient(155deg, rgba(255, 128, 171, 0.40) 0%, rgba(208, 24, 132, 0.10) 70%)',
  purple:
    'linear-gradient(155deg, rgba(179, 136, 255, 0.40) 0%, rgba(147, 52, 230, 0.10) 70%)',
  cyan: 'linear-gradient(155deg, rgba(77, 208, 225, 0.40) 0%, rgba(0, 123, 131, 0.10) 70%)',
  orange:
    'linear-gradient(155deg, rgba(255, 183, 77, 0.45) 0%, rgba(250, 123, 23, 0.10) 70%)',
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
