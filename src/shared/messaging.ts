import {
  type Folder,
  type FolderId,
  type GitHubAuthMethod,
  type ItemRef,
  type LiveSource,
  type PinnedUrl,
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
  | { type: 'addTabsToFolder'; folderId: FolderId; tabIds: number[] }
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
  | { type: 'materializeLiveTab'; folderId: FolderId; externalId: string }
  | { type: 'moveItem'; item: ItemRef; toFolderId: FolderId; toIndex: number }
  | { type: 'pinTab'; tabId: number; baseUrl: string }
  | { type: 'unpinTab'; tabId: number }
  | { type: 'resetTab'; tabId: number }
  | { type: 'closeTab'; tabId: number }
  | { type: 'activateTab'; tabId: number }
  | { type: 'getGitHubAuthState' }
  | { type: 'setGitHubPat'; token?: string }
  | { type: 'clearGitHubOauthToken' }
  | { type: 'setPreferredAuth'; method?: GitHubAuthMethod }
  | { type: 'getGitHubApiBaseUrl' }
  | { type: 'setGitHubApiBaseUrl'; url?: string }
  | { type: 'getGitHubClientId' }
  | { type: 'setGitHubClientId'; clientId?: string }
  | { type: 'startGitHubOAuth' }
  | { type: 'pollGitHubOAuth'; deviceCode: string }
  | { type: 'getUIPrefs' }
  | { type: 'setUIPrefs'; prefs: Partial<UIPreferences> }
  | { type: 'importStore'; store: SpaceStore; currentWindowId: number }
  | { type: 'undo'; windowId: number }
  | { type: 'peekUndo'; windowId: number }
  | { type: 'reconcile' }
  | { type: 'pinUrl'; spaceId: SpaceId; url: string; title?: string; favIconUrl?: string }
  | { type: 'unpinUrl'; spaceId: SpaceId; pinnedId: string }
  | { type: 'reorderPinnedUrls'; spaceId: SpaceId; orderedIds: string[] }
  // Background → side panel broadcast, not a request.
  | { type: 'openCommandBar'; windowId: number }

export interface MessageResponseMap {
  getStore: SpaceStore
  createSpace: Space
  importChromeTabGroups: Space[]
  addTabsToFolder: void
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
  materializeLiveTab: number | undefined
  moveItem: void
  pinTab: void
  unpinTab: void
  resetTab: boolean
  closeTab: void
  activateTab: void
  getGitHubAuthState: {
    hasOauth: boolean
    hasPat: boolean
    preferred: GitHubAuthMethod | undefined
    // The slot getGitHubToken would actually return right now, useful for
    // the UI to show "✓ Live folders use OAuth".
    active: GitHubAuthMethod | undefined
  }
  setGitHubPat: void
  clearGitHubOauthToken: void
  setPreferredAuth: void
  getGitHubApiBaseUrl: { url: string; isCustom: boolean }
  setGitHubApiBaseUrl: void
  getGitHubClientId: { hasOverride: boolean; hasBuiltin: boolean }
  setGitHubClientId: void
  startGitHubOAuth: {
    deviceCode: string
    userCode: string
    verificationUri: string
    expiresIn: number
    interval: number
  }
  pollGitHubOAuth:
    | { status: 'pending' }
    | { status: 'slow_down'; interval: number }
    | { status: 'expired' }
    | { status: 'denied' }
    | { status: 'success' }
  getUIPrefs: UIPreferences
  setUIPrefs: void
  importStore: void
  undo: { ok: boolean; description?: string }
  peekUndo: { kind: string; description: string } | undefined
  reconcile: { dropped: number }
  pinUrl: PinnedUrl
  unpinUrl: void
  reorderPinnedUrls: void
  openCommandBar: void
}

export type UIFontSize = 1 | 2 | 3 | 4 | 5

export interface UIPreferences {
  // 1 = XS, 3 = M (default), 5 = XL.
  fontSize: UIFontSize
  // Move tabs untouched for this many days into the per-Space "Archive"
  // folder. 0 = disabled. Live folder tabs are never archived.
  autoArchiveDays: number
  // When false (default) the hover-revealed "+ Folder" / "+ Live folder"
  // affordance only appears on the Space root, not on nested folders —
  // those rely on the FolderMenu items instead. The hover juddering on
  // deeply-nested rows is the reason this defaults off.
  showAddRowsInNestedFolders: boolean
}

export const DEFAULT_UI_PREFS: UIPreferences = {
  fontSize: 3,
  autoArchiveDays: 0,
  showAddRowsInNestedFolders: false,
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
