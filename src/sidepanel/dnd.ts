import { type FolderId, type ItemRef, type SpaceId } from '../shared/types'

export interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl?: string
  hidden: boolean
  // Whether this tab is the currently-active tab in its window. Used to
  // highlight the row in the side panel.
  active: boolean
}

export type DropPos =
  | { kind: 'before-item'; folderId: FolderId; index: number }
  | { kind: 'after-item'; folderId: FolderId; index: number }
  | { kind: 'into-folder'; folderId: FolderId }
  | { kind: 'into-space'; spaceId: SpaceId; folderId: FolderId }
  | { kind: 'reorder-space'; targetSpaceId: SpaceId; position: 'before' | 'after' }

export type DragState =
  | { kind: 'item'; item: ItemRef }
  | { kind: 'space'; spaceId: SpaceId }

export function dropPosKey(p: DropPos): string {
  switch (p.kind) {
    case 'before-item':
    case 'after-item':
      return `${p.kind}:${p.folderId}:${p.index}`
    case 'into-folder':
      return `into-folder:${p.folderId}`
    case 'into-space':
      return `into-space:${p.spaceId}`
    case 'reorder-space':
      return `reorder-space:${p.targetSpaceId}:${p.position}`
  }
}

export function itemKey(it: ItemRef, idx: number): string {
  return it.kind === 'tab' ? `t:${it.tabId}` : `f:${it.folderId}:${idx}`
}
