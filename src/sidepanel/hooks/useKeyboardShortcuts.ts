import { useEffect } from 'react'
import { sendMessage } from '../../shared/messaging'

interface Args {
  windowId: number | undefined
  refresh: () => Promise<void>
  onOpenCommandBar: () => void
}

// ⌘K opens the command bar. ⌘Z undoes the last destructive op
// (close-tab, delete-folder, delete-space, move-item) for this window.
// Both skip when typing — native input undo wins for ⌘Z.
export function useKeyboardShortcuts({
  windowId,
  refresh,
  onOpenCommandBar,
}: Args): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inEditor = tag === 'INPUT' || tag === 'TEXTAREA'
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        if (inEditor) return
        e.preventDefault()
        onOpenCommandBar()
        return
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (inEditor) return
        if (windowId === undefined) return
        e.preventDefault()
        void sendMessage({ type: 'undo', windowId }).then((res) => {
          if (res.ok) void refresh()
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [windowId, refresh, onOpenCommandBar])
}
