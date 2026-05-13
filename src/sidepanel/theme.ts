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

// Arc-style ambient body fill for the active Space. The non-grey
// entries are saturated, opaque gradients (lighter top-left → darker
// bottom-right) so the whole panel reads as that color, the way Arc's
// sidebar does. White text on these passes contrast at all hues.
// grey stays translucent — the palette isn't swapped for it, so it
// rides on the user's prefers-color-scheme rather than forcing a
// colored fill.
export const COLOR_GRADIENT: Record<SpaceColor, string> = {
  grey: 'linear-gradient(155deg, rgba(154, 160, 166, 0.45) 0%, rgba(154, 160, 166, 0.22) 100%)',
  blue: 'linear-gradient(155deg, #6886c1 0%, #4f6aa3 100%)',
  red: 'linear-gradient(155deg, #c07676 0%, #9d5454 100%)',
  yellow: 'linear-gradient(155deg, #c09150 0%, #9b6f28 100%)',
  green: 'linear-gradient(155deg, #6ca072 0%, #4d7d54 100%)',
  pink: 'linear-gradient(155deg, #c789a8 0%, #a36684 100%)',
  purple: 'linear-gradient(155deg, #9078bf 0%, #6f57a0 100%)',
  cyan: 'linear-gradient(155deg, #5e8c95 0%, #406f78 100%)',
  orange: 'linear-gradient(155deg, #c08562 0%, #9a663a 100%)',
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
