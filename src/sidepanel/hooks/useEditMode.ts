import { useCallback, useState, type KeyboardEvent } from 'react'

export interface EditMode {
  isEditing: boolean
  draft: string
  setDraft: (next: string) => void
  start: () => void
  stop: () => void
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}

// Inline-rename pattern shared by Space header and Folder header.
// `initial` is read at render time so the draft snaps back to whatever
// the source-of-truth currently is (after a refresh, after the parent
// renames it, etc.). `stop()` only exits edit mode — submission is the
// caller's responsibility (different sendMessage types per call site).
export function useEditMode(initial: string): EditMode {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(initial)

  const start = useCallback(() => {
    setDraft(initial)
    setIsEditing(true)
  }, [initial])

  const stop = useCallback(() => setIsEditing(false), [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      if (e.key === 'Escape') {
        setDraft(initial)
        setIsEditing(false)
      }
    },
    [initial],
  )

  return { isEditing, draft, setDraft, start, stop, handleKeyDown }
}
