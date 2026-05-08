import { useEffect } from 'react'

interface Args {
  windowId: number | undefined
  onOpenCommandBar: () => void
}

// Listens to chrome.runtime.onMessage so the SW can poke the panel
// (currently used by the `openCommandBar` keyboard command). Every
// listener match is gated on windowId — many panels can be open at
// once and each owns its own window.
export function useBackgroundMessages({
  windowId,
  onOpenCommandBar,
}: Args): void {
  useEffect(() => {
    if (windowId === undefined) return
    const listener = (msg: unknown): boolean => {
      const m = msg as { type?: string; windowId?: number }
      if (m?.type === 'openCommandBar' && m.windowId === windowId) {
        onOpenCommandBar()
      }
      return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [windowId, onOpenCommandBar])
}
