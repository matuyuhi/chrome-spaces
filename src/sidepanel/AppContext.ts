import { createContext, useContext } from 'react'
import { type FolderId, type SpaceStore } from '../shared/types'
import { type DragState, type DropPos, type TabInfo } from './dnd'

// All side-effecty handles and shared state that the tree of folder/tab
// components needs. Threaded as a single context so each component file
// stays prop-light.
export interface AppCtx {
  store: SpaceStore
  windowId: number
  tabs: Record<number, TabInfo>

  refresh: () => Promise<void>
  onError: (e: unknown) => void

  openMenu: string | undefined
  setOpenMenu: (id: string | undefined) => void

  drag: DragState | undefined
  setDrag: (d: DragState | undefined) => void
  dropPos: DropPos | undefined
  setDropPos: (d: DropPos | undefined) => void
  finalizeDrop: () => Promise<void>

  onCreateLive: (parentFolderId: FolderId) => void
  onEditLive: (folderId: FolderId) => void
}

const Context = createContext<AppCtx | undefined>(undefined)

export const AppCtxProvider = Context.Provider

export function useAppCtx(): AppCtx {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useAppCtx must be used inside <AppCtxProvider>')
  return ctx
}
