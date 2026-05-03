import styled from '@emotion/styled'
import { tokens } from '../theme'

const Wrap = styled.span<{ hasError?: boolean }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-right: 4px;
  color: ${(p) => (p.hasError ? tokens.danger : tokens.fg)};
  overflow: hidden;

  /* Slide the whole sprite group across the panel + cycle frames. */
  .runcat {
    animation: ${(p) => (p.hasError ? 'none' : 'runcat-slide 1.8s linear infinite')};
  }

  .frame {
    opacity: 0;
    animation: runcat-flicker 0.4s steps(1, end) infinite;
  }
  .frame.f0 { animation-delay: 0s; }
  .frame.f1 { animation-delay: 0.08s; }
  .frame.f2 { animation-delay: 0.16s; }
  .frame.f3 { animation-delay: 0.24s; }
  .frame.f4 { animation-delay: 0.32s; }

  @keyframes runcat-slide {
    0% { transform: translateX(-13px); }
    100% { transform: translateX(15px); }
  }
  @keyframes runcat-flicker {
    0%, 19% { opacity: 1; }
    20%, 100% { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .runcat { animation: none; }
    .frame.f0 { opacity: 1; }
    .frame:not(.f0) { display: none; }
  }
`

// Tiny black cat sprinting in 5 leg poses — RunCat menubar widget feel.
export function RunCat({
  size = 24,
  hasError,
  title,
}: {
  size?: number
  hasError?: boolean
  title?: string
}) {
  return (
    <Wrap hasError={hasError} title={title}>
      <svg
        width={size}
        height={(size * 12) / 28}
        viewBox="0 0 28 12"
        aria-hidden
      >
        <g className="runcat">
          {/* Each <g class="frame"> below is a different running pose. CSS
              flickers them in sequence so only one is visible at a time. */}
          <g className="frame f0">
            <path d="M1 7 Q -1 4 0 3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M2 7 L2 5 Q2 4 3 4 L8 4 Q9 4 9 3 L10 3 L10 4 L11 4 Q12 4 12 5 L12 7 Z" fill="currentColor" />
            <path d="M9.5 3 L9.7 2 L9.9 3 Z" fill="currentColor" />
            <rect x="3" y="7" width="0.8" height="2" fill="currentColor" />
            <rect x="5" y="7" width="0.8" height="2" fill="currentColor" />
            <rect x="9" y="7" width="0.8" height="2" fill="currentColor" />
            <rect x="11" y="7" width="0.8" height="2" fill="currentColor" />
          </g>
          <g className="frame f1">
            <path d="M1 6 Q -1 4 0 2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M2 6 L2 4 Q2 3 3 3 L8 3 Q9 3 9 2 L10 2 L10 3 L11 3 Q12 3 12 4 L12 6 Z" fill="currentColor" />
            <path d="M9.5 2 L9.7 1 L9.9 2 Z" fill="currentColor" />
            <rect x="3" y="6" width="0.8" height="2.5" fill="currentColor" />
            <rect x="5.5" y="6" width="0.8" height="1.2" fill="currentColor" />
            <rect x="8.5" y="6" width="0.8" height="1.2" fill="currentColor" />
            <rect x="11" y="6" width="0.8" height="2.5" fill="currentColor" />
          </g>
          <g className="frame f2">
            <path d="M1 5 Q -1 2 1 1" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M2 5 L2 3 Q2 2 3 2 L8 2 Q9 2 9 1 L10 1 L10 2 L11 2 Q12 2 12 3 L12 5 Z" fill="currentColor" />
            <path d="M9.5 1 L9.7 0 L9.9 1 Z" fill="currentColor" />
            <rect x="4" y="5" width="0.8" height="1" fill="currentColor" />
            <rect x="6" y="5" width="0.8" height="1" fill="currentColor" />
            <rect x="8" y="5" width="0.8" height="1" fill="currentColor" />
            <rect x="10" y="5" width="0.8" height="1" fill="currentColor" />
          </g>
          <g className="frame f3">
            <path d="M1 6 Q -1 5 0 3" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d="M2 6 L2 4 Q2 3 3 3 L8 3 Q9 3 9 2 L10 2 L10 3 L11 3 Q12 3 12 4 L12 6 Z" fill="currentColor" />
            <path d="M9.5 2 L9.7 1 L9.9 2 Z" fill="currentColor" />
            <rect x="3.5" y="6" width="0.8" height="1.2" fill="currentColor" />
            <rect x="5" y="6" width="0.8" height="2.5" fill="currentColor" />
            <rect x="9" y="6" width="0.8" height="2.5" fill="currentColor" />
            <rect x="10.5" y="6" width="0.8" height="1.2" fill="currentColor" />
          </g>
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
    </Wrap>
  )
}
