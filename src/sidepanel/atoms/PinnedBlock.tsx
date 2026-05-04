import styled from '@emotion/styled'
import { useState } from 'react'
import { tokens } from '../theme'

// Globe fallback icon — used when favIconUrl is absent or fails to load.
function GlobeIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

const Block = styled.button<{ isActive?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: ${tokens.radius.md};
  border: 1px solid
    ${(p) => (p.isActive ? tokens.accent : tokens.border)};
  background: ${(p) => (p.isActive ? tokens.accentSoft : tokens.bgSoft)};
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${(p) => (p.isActive ? tokens.accent : tokens.muted)};
  transition: background ${tokens.duration.fast} ease,
              border-color ${tokens.duration.fast} ease,
              transform ${tokens.duration.fast} ease;
  position: relative;

  &:hover {
    background: ${(p) => (p.isActive ? tokens.accentSoft : tokens.bgHover)};
    border-color: ${(p) => (p.isActive ? tokens.accent : tokens.muted)};
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.96);
  }

  img {
    width: 14px;
    height: 14px;
    display: block;
    border-radius: 2px;
  }
`

export interface PinnedBlockProps {
  url: string
  title?: string
  favIconUrl?: string
  isActive?: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  'aria-label'?: string
}

export function PinnedBlock({
  url,
  title,
  favIconUrl,
  isActive,
  onClick,
  onContextMenu,
  'aria-label': ariaLabel,
}: PinnedBlockProps) {
  const [imgError, setImgError] = useState(false)
  const showImg = !!favIconUrl && !imgError
  const tooltipText = title ? `${title}\n${url}` : url
  const label = ariaLabel ?? (title ?? url)

  return (
    <Block
      type="button"
      isActive={isActive}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={tooltipText}
      aria-label={label}
      aria-current={isActive ? 'true' : undefined}
    >
      {showImg ? (
        <img
          src={favIconUrl}
          alt=""
          onError={() => setImgError(true)}
        />
      ) : (
        <GlobeIcon />
      )}
    </Block>
  )
}
