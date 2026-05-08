import { useCallback, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type FolderId } from '../../shared/types'
import { type DragState, type DropPos } from '../dnd'

export interface DragDropController {
  drag: DragState | undefined
  setDrag: (d: DragState | undefined) => void
  dropPos: DropPos | undefined
  setDropPos: (d: DropPos | undefined) => void
  finalizeDrop: () => Promise<void>
}

interface Args {
  windowId: number | undefined
  refresh: () => Promise<void>
  onError: (e: unknown) => void
}

export function useDragDropController({
  windowId,
  refresh,
  onError,
}: Args): DragDropController {
  const [drag, setDrag] = useState<DragState | undefined>()
  const [dropPos, setDropPos] = useState<DropPos | undefined>()

  const finalizeDrop = useCallback(async () => {
    if (!drag || !dropPos || windowId === undefined) {
      setDrag(undefined)
      setDropPos(undefined)
      return
    }
    const dragSnap = drag
    const target = dropPos
    setDrag(undefined)
    setDropPos(undefined)

    try {
      if (dragSnap.kind === 'space' && target.kind === 'reorder-space') {
        const ordered = (await sendMessage({ type: 'getStore' })).spaces
        const inWindow = Object.values(ordered)
          .filter((sp) => sp.windowId === windowId)
          .sort((a, b) => a.order - b.order)
        const sourceIdx = inWindow.findIndex((sp) => sp.id === dragSnap.spaceId)
        const targetIdx = inWindow.findIndex(
          (sp) => sp.id === target.targetSpaceId,
        )
        if (sourceIdx === -1 || targetIdx === -1) return
        let insertAt = targetIdx + (target.position === 'after' ? 1 : 0)
        if (sourceIdx < insertAt) insertAt -= 1
        if (insertAt === sourceIdx) return
        const next = [...inWindow]
        const [moved] = next.splice(sourceIdx, 1)
        if (!moved) return
        next.splice(insertAt, 0, moved)
        await sendMessage({
          type: 'reorderSpaces',
          windowId,
          orderedIds: next.map((sp) => sp.id),
        })
        await refresh()
        return
      }
      if (dragSnap.kind === 'item') {
        let toFolderId: FolderId
        let toIndex: number
        switch (target.kind) {
          case 'before-item':
            toFolderId = target.folderId
            toIndex = target.index
            break
          case 'after-item':
            toFolderId = target.folderId
            toIndex = target.index + 1
            break
          case 'into-folder':
          case 'into-space':
            toFolderId = target.folderId
            toIndex = Number.MAX_SAFE_INTEGER
            break
          case 'reorder-space':
            return
        }
        await sendMessage({
          type: 'moveItem',
          item: dragSnap.item,
          toFolderId,
          toIndex,
        })
        await refresh()
      }
    } catch (e) {
      onError(e)
    }
  }, [drag, dropPos, windowId, refresh, onError])

  return { drag, setDrag, dropPos, setDropPos, finalizeDrop }
}
