// Lucide-style line icons. 16×16 viewBox, currentColor stroke. Each icon
// inherits font-size for sizing (we set it via the .icon class so tab
// rows / menus pick up the right scale).

import { type SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  )
}

export function ChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  )
}

export function ChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  )
}

export function MoreHorizontal(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function RefreshCw(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  )
}

export function X(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  )
}

// "Jump back to saved URL" — Arc-style minus glyph.
export function Minus(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  )
}

export function Settings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

export function Plus(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  )
}

export function Download(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  )
}

// Runcat-style mascot: a tiny black cat sprinting across the header.
// 5 hand-drawn frames cycle to animate the legs / tail; the whole cat
// translates left→right and resets, like RunCat in the macOS menubar.
//
// Each <g class="frame fN"> is a pose. CSS shows one at a time via a
// staggered visibility flicker, while the parent .runcat group slides
// horizontally for the "running across the panel" effect.
export function LiveGraph({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 12) / 28}
      viewBox="0 0 28 12"
      aria-hidden
      className="live-graph"
    >
      <g className="runcat">
        {/* Frame 0: standing, all four legs grounded */}
        <g className="frame f0">
          {/* tail */}
          <path d="M1 7 Q -1 4 0 3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          {/* body */}
          <path d="M2 7 L2 5 Q2 4 3 4 L8 4 Q9 4 9 3 L10 3 L10 4 L11 4 Q12 4 12 5 L12 7 Z" fill="currentColor" />
          {/* ears */}
          <path d="M9.5 3 L9.7 2 L9.9 3 Z" fill="currentColor" />
          {/* legs */}
          <rect x="3" y="7" width="0.8" height="2" fill="currentColor" />
          <rect x="5" y="7" width="0.8" height="2" fill="currentColor" />
          <rect x="9" y="7" width="0.8" height="2" fill="currentColor" />
          <rect x="11" y="7" width="0.8" height="2" fill="currentColor" />
        </g>
        {/* Frame 1: mid-stride, front+back diagonal pair lifted */}
        <g className="frame f1">
          <path d="M1 6 Q -1 4 0 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M2 6 L2 4 Q2 3 3 3 L8 3 Q9 3 9 2 L10 2 L10 3 L11 3 Q12 3 12 4 L12 6 Z" fill="currentColor" />
          <path d="M9.5 2 L9.7 1 L9.9 2 Z" fill="currentColor" />
          <rect x="3" y="6" width="0.8" height="2.5" fill="currentColor" />
          <rect x="5.5" y="6" width="0.8" height="1.2" fill="currentColor" />
          <rect x="8.5" y="6" width="0.8" height="1.2" fill="currentColor" />
          <rect x="11" y="6" width="0.8" height="2.5" fill="currentColor" />
        </g>
        {/* Frame 2: airborne, legs tucked */}
        <g className="frame f2">
          <path d="M1 5 Q -1 2 1 1" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M2 5 L2 3 Q2 2 3 2 L8 2 Q9 2 9 1 L10 1 L10 2 L11 2 Q12 2 12 3 L12 5 Z" fill="currentColor" />
          <path d="M9.5 1 L9.7 0 L9.9 1 Z" fill="currentColor" />
          <rect x="4" y="5" width="0.8" height="1" fill="currentColor" />
          <rect x="6" y="5" width="0.8" height="1" fill="currentColor" />
          <rect x="8" y="5" width="0.8" height="1" fill="currentColor" />
          <rect x="10" y="5" width="0.8" height="1" fill="currentColor" />
        </g>
        {/* Frame 3: opposite mid-stride */}
        <g className="frame f3">
          <path d="M1 6 Q -1 5 0 3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M2 6 L2 4 Q2 3 3 3 L8 3 Q9 3 9 2 L10 2 L10 3 L11 3 Q12 3 12 4 L12 6 Z" fill="currentColor" />
          <path d="M9.5 2 L9.7 1 L9.9 2 Z" fill="currentColor" />
          <rect x="3.5" y="6" width="0.8" height="1.2" fill="currentColor" />
          <rect x="5" y="6" width="0.8" height="2.5" fill="currentColor" />
          <rect x="9" y="6" width="0.8" height="2.5" fill="currentColor" />
          <rect x="10.5" y="6" width="0.8" height="1.2" fill="currentColor" />
        </g>
        {/* Frame 4: landing, back to ground */}
        <g className="frame f4">
          <path d="M1 7 Q -1 5 0 3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M2 7 L2 5 Q2 4 3 4 L8 4 Q9 4 9 3 L10 3 L10 4 L11 4 Q12 4 12 5 L12 7 Z" fill="currentColor" />
          <path d="M9.5 3 L9.7 2 L9.9 3 Z" fill="currentColor" />
          <rect x="3" y="7" width="0.8" height="2" fill="currentColor" />
          <rect x="5.5" y="7" width="0.8" height="2" fill="currentColor" />
          <rect x="8.5" y="7" width="0.8" height="2" fill="currentColor" />
          <rect x="11" y="7" width="0.8" height="2" fill="currentColor" />
        </g>
      </g>
    </svg>
  )
}

export function AlertTriangle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  )
}
