import { type UIFontSize } from '../shared/messaging'
import { type SpaceColor } from '../shared/types'

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

// 5-step UI scale. 3 = default. Values multiply the base font-size.
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
  // `zoom` is non-standard but Chromium-supported, scales text *and*
  // padding/icons together with reflow (unlike `transform: scale`,
  // which leaves the layout box at its original size).
  ;(document.documentElement.style as { zoom?: string }).zoom = String(
    FONT_SCALE[size],
  )
}
