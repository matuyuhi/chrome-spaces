import styled from '@emotion/styled'
import { type Space } from '../../shared/types'
import { COLOR_HEX, tokens } from '../theme'

const Pill = styled.button<{
  active?: boolean
  isDragging?: boolean
  isItemDropTarget?: boolean
  reorderEdge?: 'before' | 'after'
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: ${tokens.radius.pill};
  border: none;
  background: ${(p) => {
    if (p.isItemDropTarget) return tokens.accent
    if (p.active) return tokens.accentSoft
    return tokens.bgSoft
  }};
  cursor: pointer;
  font-size: 12px;
  color: ${(p) => {
    if (p.isItemDropTarget) return 'white'
    if (p.active) return tokens.accent
    return tokens.muted
  }};
  max-width: 160px;
  font-weight: 500;
  transition:
    background ${tokens.duration.fast} ease,
    color ${tokens.duration.fast} ease;
  opacity: ${(p) => (p.isDragging ? 0.4 : 1)};

  &:hover {
    ${(p) =>
      !p.active &&
      !p.isItemDropTarget &&
      `background: ${tokens.bgHover}; color: ${tokens.fg};`}
  }

  /* reorder indicators (vertical bars on either side) */
  &::before {
    content: ${(p) => (p.reorderEdge === 'before' ? "''" : 'unset')};
    position: absolute;
    left: -3px;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: ${tokens.accent};
    border-radius: 1px;
    pointer-events: none;
  }

  &::after {
    content: ${(p) => (p.reorderEdge === 'after' ? "''" : 'unset')};
    position: absolute;
    right: -3px;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: ${tokens.accent};
    border-radius: 1px;
    pointer-events: none;
  }
`

const Dot = styled.span<{ color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => p.color};
`

const Emoji = styled.span`
  font-size: 12px;
`

const Name = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export function SpaceTab({
  space,
  active,
  isDragging,
  isItemDropTarget,
  reorderEdge,
  onClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  space: Space
  active: boolean
  isDragging?: boolean
  isItemDropTarget?: boolean
  reorderEdge?: 'before' | 'after'
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}) {
  return (
    <Pill
      active={active}
      isDragging={isDragging}
      isItemDropTarget={isItemDropTarget}
      reorderEdge={reorderEdge}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={space.name}
    >
      <Dot
        color={isItemDropTarget ? 'white' : COLOR_HEX[space.color]}
        aria-hidden
      />
      {space.emoji && <Emoji aria-hidden>{space.emoji}</Emoji>}
      <Name>{space.name}</Name>
    </Pill>
  )
}
