import { type Space } from '../shared/types'
import { COLOR_HEX } from './theme'

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
  const className = [
    'space-tab',
    active && 'is-active',
    isDragging && 'is-dragging',
    isItemDropTarget && 'is-drop-target',
    reorderEdge === 'before' && 'reorder-before',
    reorderEdge === 'after' && 'reorder-after',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      className={className}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={space.name}
    >
      <span
        className="space-tab-dot"
        style={{ background: COLOR_HEX[space.color] }}
        aria-hidden
      />
      {space.emoji ? (
        <span className="space-tab-emoji" aria-hidden>
          {space.emoji}
        </span>
      ) : null}
      <span className="space-tab-name">{space.name}</span>
    </button>
  )
}
