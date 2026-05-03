export type SpaceId = string

export type SpaceColor = chrome.tabGroups.ColorEnum

export interface BaseSpace {
  id: SpaceId
  name: string
  color: SpaceColor
  emoji?: string
  groupId: number
  windowId: number
  order: number
  lastActiveTabId?: number
  createdAt: number
  lastAccessedAt: number
  // Map of tabId → base URL. Pressing the reset trigger snaps the tab back
  // to its base URL (Arc's pinned-tab "snap-back"). For LiveSpace tabs the
  // managedTab.url takes precedence — see space-manager.resolveBaseUrl.
  pinnedTabs?: Record<number, string>
}

export interface StaticSpace extends BaseSpace {
  kind: 'static'
}

export type GitHubPreset = 'review-requested' | 'assigned' | 'authored' | 'custom'

// `repoFilter` narrows a preset query to a GitHub org / user / single repo.
// Empty or "*" means no narrowing (everything the token can see). A bare
// identifier ("acme") is interpreted as `org:acme`. A value already shaped
// like a search qualifier (`org:acme`, `user:octocat`, `repo:foo/bar`) is
// used verbatim, so power users can mix qualifiers.
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

export interface ManagedTab {
  externalId: string
  url: string
  tabId: number
  addedAt: number
}

export interface LiveSpace extends BaseSpace {
  kind: 'live'
  source: LiveSource
  refreshIntervalMin: number
  lastSyncAt?: number
  lastSyncError?: string
  managedTabs: ManagedTab[]
  // Seed tab created by createLiveSpace to anchor the Tab Group.
  // Cleaned up once managedTabs becomes non-empty.
  starterTabId?: number
}

export type Space = StaticSpace | LiveSpace

export const CURRENT_SCHEMA_VERSION = 1

export const TAB_GROUP_ID_NONE = -1

export interface SpaceStore {
  spaces: Record<SpaceId, Space>
  activeSpaceByWindow: Record<number, SpaceId>
  schemaVersion: number
}

export interface SecretStore {
  githubToken?: string
}

export function emptyStore(): SpaceStore {
  return {
    spaces: {},
    activeSpaceByWindow: {},
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
}

export function isLive(space: Space): space is LiveSpace {
  return space.kind === 'live'
}

export function isStatic(space: Space): space is StaticSpace {
  return space.kind === 'static'
}
