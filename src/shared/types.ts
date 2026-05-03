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
  title?: string
  // Optional: live items render as plain links until the user clicks
  // them. tabId is only set once a Chrome tab has been created for the
  // item (and gets cleared again when that tab is closed).
  tabId?: number
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
  | { type: 'rss'; url: string }

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

// An item inside a Folder: a tracked tab (by tabId), a nested Folder
// reference, or a Live entry pointing at one of the parent folder's
// managedTabs by externalId. Live entries can be materialized
// (managedTab.tabId set, real Chrome tab) or not (link only).
export type ItemRef =
  | { kind: 'tab'; tabId: number }
  | { kind: 'folder'; folderId: FolderId }
  | { kind: 'live'; externalId: string }

export interface TabRecord {
  // tabId doubles as the record id — Chrome guarantees uniqueness for
  // the lifetime of the tab, which matches our retention.
  tabId: number
  windowId: number
  // Optional snap-back URL (Arc's pinned tab base URL).
  baseUrl?: string
  // Last time this tab was activated. Drives the auto-archive job.
  lastActiveAt?: number
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

export const CURRENT_SCHEMA_VERSION = 3

export interface SpaceStore {
  spaces: Record<SpaceId, Space>
  folders: Record<FolderId, Folder>
  tabs: Record<number, TabRecord>
  activeSpaceByWindow: Record<number, SpaceId>
  schemaVersion: number
}

export type GitHubAuthMethod = 'oauth' | 'pat'

export interface SecretStore {
  // Pre-split single token. Read by getActiveGitHubToken as a PAT
  // fallback so old installs keep working until the user touches
  // Settings (which will route writes to the split slots).
  githubToken?: string
  // Token acquired via Device Flow (OAuth App). Set by pollDeviceFlow.
  githubOauthToken?: string
  // Personal Access Token pasted manually by the user.
  githubPat?: string
  // Which credential to hand out when both are present. Undefined means
  // "fall back to whichever exists".
  preferredAuth?: GitHubAuthMethod
  // Override for GitHub Enterprise Server (e.g., https://ghe.example.com/api/v3).
  // Undefined means use the public github.com API.
  githubApiBaseUrl?: string
  // Override for the bundled OAuth App client_id (Settings → Advanced).
  // Undefined means use the build-time VITE_GITHUB_CLIENT_ID.
  githubClientId?: string
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

// Collect every tabId reachable from a Space's root, depth-first. This
// covers both plain tabs and the *materialized* tabId on a live folder's
// managedTabs (live entries that haven't been clicked yet have no tabId
// and contribute nothing).
export function collectSpaceTabIds(store: SpaceStore, spaceId: SpaceId): number[] {
  const space = store.spaces[spaceId]
  if (!space) return []
  const ids: number[] = []
  for (const folder of walkFolders(store, space.rootFolderId)) {
    for (const item of folder.items) {
      if (item.kind === 'tab') ids.push(item.tabId)
    }
    if (folder.live) {
      for (const m of folder.live.managedTabs) {
        if (typeof m.tabId === 'number') ids.push(m.tabId)
      }
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
    if (folder.live?.managedTabs.some((m) => m.tabId === tabId)) return folder
  }
  return undefined
}
