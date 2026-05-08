import { useEffect } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type SpaceStore } from '../../shared/types'

interface Args {
  enabled: boolean
  store: SpaceStore | undefined
  windowId: number | undefined
  refresh: () => Promise<void>
}

// Horizontal swipe (2-finger trackpad or horizontal wheel) to switch
// between spaces. Throttled to one switch per 400 ms to absorb
// trackpad inertia. No wrap-around at the edges.
export function useHorizontalSwipeSwitcher({
  enabled,
  store,
  windowId,
  refresh,
}: Args): void {
  useEffect(() => {
    if (!enabled) return
    if (!store || windowId === undefined) return

    let lastFiredAt = 0

    const onWheel = (e: WheelEvent) => {
      // Ignore vertical scrolls — only act when horizontal movement dominates.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      // Minimum threshold to avoid tiny accidental drifts.
      if (Math.abs(e.deltaX) <= 40) return
      // Ignore when the user is typing in an input.
      if ((e.target as Element | null)?.closest('input, textarea')) return
      const now = Date.now()
      if (now - lastFiredAt < 400) return
      lastFiredAt = now

      const orderedSpaces = Object.values(store.spaces)
        .filter((s) => s.windowId === windowId)
        .sort((a, b) => a.order - b.order)
      if (orderedSpaces.length <= 1) return

      const activeSpaceId = store.activeSpaceByWindow[windowId]
      const currentIdx = orderedSpaces.findIndex((s) => s.id === activeSpaceId)
      if (currentIdx === -1) return

      // deltaX > 0 → swipe left → next space; deltaX < 0 → swipe right → prev.
      const nextIdx = e.deltaX > 0 ? currentIdx + 1 : currentIdx - 1
      if (nextIdx < 0 || nextIdx >= orderedSpaces.length) return

      const targetSpace = orderedSpaces[nextIdx]
      if (!targetSpace) return

      void sendMessage({
        type: 'switchTo',
        spaceId: targetSpace.id,
        windowId,
      }).then(() => refresh())
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [enabled, store, windowId, refresh])
}
