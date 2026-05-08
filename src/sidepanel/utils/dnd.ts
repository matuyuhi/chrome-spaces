// Shared DnD geometry helpers. Most of the side panel's drop targets
// follow a "before/after the midpoint" rule on either the vertical
// (tab rows) or horizontal (space pills) axis. Centralizing the
// calculation keeps the threshold consistent across surfaces.

export type InsertPosition = 'before' | 'after'

interface PointerLike {
  clientX: number
  clientY: number
  currentTarget: Element
}

// Returns 'before' if the pointer sits on the leading half of the
// element (top half on the vertical axis, left half on horizontal),
// 'after' otherwise. The midpoint is exclusive of `before` so a
// pointer exactly on the boundary lands in `after` — matches the
// previous inline `< rect.height / 2` test.
export function detectInsertPosition(
  e: PointerLike,
  axis: 'horizontal' | 'vertical',
): InsertPosition {
  const rect = e.currentTarget.getBoundingClientRect()
  if (axis === 'vertical') {
    return e.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
  }
  return e.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
}
