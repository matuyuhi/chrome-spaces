import {
  type Folder,
  type FolderId,
  type ItemRef,
  type LiveSource,
  type Space,
  type SpaceColor,
  type SpaceId,
  type SpaceStore,
} from './types'

// ---- Message types -------------------------------------------------------

export interface CreateSpacePayload {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
  initialTabIds?: number[]
}

export interface CreateFolderPayload {
  parentFolderId: FolderId
  name: string
  emoji?: string
  color?: SpaceColor
  live?: { source: LiveSource; refreshIntervalMin?: number }
}

export type Message =
  | { type: 'getStore' }
  | { type: 'createSpace'; payload: CreateSpacePayload }
  | { type: 'importChromeTabGroups'; windowId: number }
  | { type: 'renameSpace'; spaceId: SpaceId; name: string }
  | { type: 'setSpaceColor'; spaceId: SpaceId; color: SpaceColor }
  | { type: 'setSpaceEmoji'; spaceId: SpaceId; emoji?: string }
  | { type: 'deleteSpace'; spaceId: SpaceId; closeTabs: boolean }
  | { type: 'reorderSpaces'; windowId: number; orderedIds: SpaceId[] }
  | { type: 'switchTo'; spaceId: SpaceId; windowId?: number }
  | { type: 'createFolder'; payload: CreateFolderPayload }
  | { type: 'renameFolder'; folderId: FolderId; name: string }
  | { type: 'setFolderEmoji'; folderId: FolderId; emoji?: string }
  | { type: 'setFolderCollapsed'; folderId: FolderId; collapsed: boolean }
  | { type: 'deleteFolder'; folderId: FolderId; closeTabs: boolean }
  | {
      type: 'updateLiveFolder'
      folderId: FolderId
      source?: LiveSource
      refreshIntervalMin?: number
    }
  | { type: 'syncLiveFolder'; folderId: FolderId }
  | { type: 'moveItem'; item: ItemRef; toFolderId: FolderId; toIndex: number }
  | { type: 'pinTab'; tabId: number; baseUrl: string }
  | { type: 'unpinTab'; tabId: number }
  | { type: 'resetTab'; tabId: number }
  | { type: 'closeTab'; tabId: number }
  | { type: 'activateTab'; tabId: number }
  | { type: 'getGitHubToken' }
  | { type: 'setGitHubToken'; token?: string }

export interface MessageResponseMap {
  getStore: SpaceStore
  createSpace: Space
  importChromeTabGroups: Space[]
  renameSpace: void
  setSpaceColor: void
  setSpaceEmoji: void
  deleteSpace: void
  reorderSpaces: void
  switchTo: void
  createFolder: Folder
  renameFolder: void
  setFolderEmoji: void
  setFolderCollapsed: void
  deleteFolder: void
  updateLiveFolder: Folder | undefined
  syncLiveFolder: void
  moveItem: void
  pinTab: void
  unpinTab: void
  resetTab: boolean
  closeTab: void
  activateTab: void
  getGitHubToken: { hasToken: boolean }
  setGitHubToken: void
}

export type MessageResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string }

export async function sendMessage<M extends Message>(
  msg: M,
): Promise<MessageResponseMap[M['type']]> {
  const response = (await chrome.runtime.sendMessage(msg)) as MessageResponse | undefined
  if (!response) throw new Error('No response from background')
  if (!response.ok) throw new Error(response.error)
  return response.data as MessageResponseMap[M['type']]
}
