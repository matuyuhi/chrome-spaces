// Schema v2: Arc-style. A Space owns a tree of Folders; each Folder owns
// an ordered list of items (tabs or sub-folders). Tabs are tracked by
// their Chrome tabId; we no longer use chrome.tabGroups for grouping at
// all. Switching a Space hides every other window-tab and shows this
// Space's tabs (chrome.tabs.hide / show).

export type SpaceId = string
export type FolderId = string

// Reused from chrome.tabGroups for the value enum, but no Tab Group is
// actually created — this is just our color palette.
export type SpaceColor = chrome.tabGroups.ColorEnum

export interface ManagedTab {
  externalId: string
  url: string
  tabId: number
  addedAt: number
}

export type GitHubPreset = 'review-requested' | 'assigned' | 'authored' | 'custom'

export type LiveSource =
  | {
      type: 'github-prs'
      preset: 'review-requested' | 'assigned' | 'authored'
      user?: string
      repoFilter?: string
    }
  | { type: 'github-prs'; preset: 'custom'; query: string }
  | {
      type: 'github-issues'
      preset: 'assigned' | 'authored' | 'mentioned'
      user?: string
      repoFilter?: string
    }
  | { type: 'github-issues'; preset: 'custom'; query: string }

export interface LiveConfig {
  source: LiveSource
  refreshIntervalMin: number // 0 = manual only
  managedTabs: ManagedTab[]
  // Anchor tab created when the Live folder is empty so the folder is
  // discoverable in the strip; cleared once managedTabs becomes non-empty.
  starterTabId?: number
  lastSyncAt?: number
  lastSyncError?: string
  // Saved across syncs so we can send `If-None-Match` and skip work on 304.
  etag?: string
}

// An item inside a Folder: either a tracked tab (by tabId) or a nested
// Folder reference. The tab/folder records themselves live in
// SpaceStore.folders / SpaceStore.tabs so refs can move between parents
// without rewriting the heavy fields.
export type ItemRef =
  | { kind: 'tab'; tabId: number }
  | { kind: 'folder'; folderId: FolderId }

export interface TabRecord {
  // tabId doubles as the record id — Chrome guarantees uniqueness for
  // the lifetime of the tab, which matches our retention.
  tabId: number
  windowId: number
  // Optional snap-back URL (Arc's pinned tab base URL).
  baseUrl?: string
}

export interface Folder {
  id: FolderId
  name: string
  emoji?: string
  color?: SpaceColor
  collapsed: boolean
  items: ItemRef[]
  // Set on Live folders. Folders without `live` are plain user folders.
  live?: LiveConfig
}

export interface Space {
  id: SpaceId
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
  order: number
  rootFolderId: FolderId
  lastActiveTabId?: number
  createdAt: number
  lastAccessedAt: number
}

export const CURRENT_SCHEMA_VERSION = 2

export interface SpaceStore {
  spaces: Record<SpaceId, Space>
  folders: Record<FolderId, Folder>
  tabs: Record<number, TabRecord>
  activeSpaceByWindow: Record<number, SpaceId>
  schemaVersion: number
}

export interface SecretStore {
  githubToken?: string
}

export function emptyStore(): SpaceStore {
  return {
    spaces: {},
    folders: {},
    tabs: {},
    activeSpaceByWindow: {},
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
}

// ---- Helpers ---------------------------------------------------------

export function isLiveFolder(folder: Folder): folder is Folder & { live: LiveConfig } {
  return folder.live !== undefined
}

// Walk every Folder reachable from `rootFolderId`, including the root.
export function* walkFolders(
  store: SpaceStore,
  rootFolderId: FolderId,
): Generator<Folder> {
  const root = store.folders[rootFolderId]
  if (!root) return
  yield root
  for (const item of root.items) {
    if (item.kind === 'folder') yield* walkFolders(store, item.folderId)
  }
}

// Collect every tabId reachable from a Space's root, depth-first.
export function collectSpaceTabIds(store: SpaceStore, spaceId: SpaceId): number[] {
  const space = store.spaces[spaceId]
  if (!space) return []
  const ids: number[] = []
  for (const folder of walkFolders(store, space.rootFolderId)) {
    for (const item of folder.items) {
      if (item.kind === 'tab') ids.push(item.tabId)
    }
  }
  return ids
}

export function findContainingFolder(
  store: SpaceStore,
  rootFolderId: FolderId,
  tabId: number,
): Folder | undefined {
  for (const folder of walkFolders(store, rootFolderId)) {
    if (folder.items.some((i) => i.kind === 'tab' && i.tabId === tabId)) return folder
  }
  return undefined
}
