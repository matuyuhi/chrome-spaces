import {
  type Folder,
  type Space,
  type SpaceColor,
  type SpaceStore,
  CURRENT_SCHEMA_VERSION,
  emptyStore,
} from '../shared/types'

const STORAGE_KEY = 'spaceStore'

const uid = (): string => crypto.randomUUID()

// chrome.storage.local rather than .sync — Tab Groups themselves are not
// device-synced and .sync's per-minute write quota is easy to hit during
// rapid Space switching.
export async function loadStore(): Promise<SpaceStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY] as { schemaVersion?: number } | undefined
  if (!stored) return emptyStore()
  if (stored.schemaVersion === CURRENT_SCHEMA_VERSION) return stored as SpaceStore
  // Schema mismatch — migrateIfNeeded() in bootstrap will rewrite. Until
  // then, hand callers an empty store rather than a half-typed v1.
  return emptyStore()
}

export async function saveStore(store: SpaceStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store })
}

export async function updateStore(
  mutator: (store: SpaceStore) => SpaceStore | void,
): Promise<SpaceStore> {
  const current = await loadStore()
  const next = mutator(current) ?? current
  await saveStore(next)
  return next
}

// ---- v1 -> v2 migration --------------------------------------------------

interface V1Space {
  kind: 'static' | 'live'
  id: string
  name: string
  color: string
  emoji?: string
  groupId: number
  windowId: number
  order: number
  lastActiveTabId?: number
  createdAt: number
  lastAccessedAt: number
  pinnedTabs?: Record<number, string>
  // live-only
  source?: unknown
  refreshIntervalMin?: number
  managedTabs?: { externalId: string; url: string; tabId: number; addedAt: number }[]
  starterTabId?: number
  lastSyncAt?: number
  lastSyncError?: string
}

interface V1Store {
  spaces: Record<string, V1Space>
  activeSpaceByWindow: Record<number, string>
  schemaVersion?: number
}

export async function migrateIfNeeded(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY] as { schemaVersion?: number } | undefined
  if (!stored) return
  if (stored.schemaVersion === CURRENT_SCHEMA_VERSION) return
  if (stored.schemaVersion === undefined || stored.schemaVersion === 1) {
    console.log('[Spaces] migrating store v1 → v2')
    const next = await migrateV1ToV2(stored as unknown as V1Store)
    await saveStore(next)
  }
}

async function migrateV1ToV2(old: V1Store): Promise<SpaceStore> {
  const next = emptyStore()
  next.activeSpaceByWindow = { ...old.activeSpaceByWindow }

  for (const oldSpace of Object.values(old.spaces)) {
    let groupTabIds: number[] = []
    if (oldSpace.groupId !== -1) {
      try {
        const tabs = await chrome.tabs.query({ groupId: oldSpace.groupId })
        groupTabIds = tabs
          .map((t) => t.id)
          .filter((id): id is number => typeof id === 'number')
      } catch {
        /* group already gone */
      }
    }

    const rootId = uid()
    const space: Space = {
      id: oldSpace.id,
      name: oldSpace.name,
      color: oldSpace.color as SpaceColor,
      emoji: oldSpace.emoji,
      windowId: oldSpace.windowId,
      order: oldSpace.order,
      rootFolderId: rootId,
      lastActiveTabId: oldSpace.lastActiveTabId,
      createdAt: oldSpace.createdAt,
      lastAccessedAt: oldSpace.lastAccessedAt,
    }
    next.spaces[space.id] = space

    if (oldSpace.kind === 'static') {
      const root: Folder = {
        id: rootId,
        name: oldSpace.name,
        collapsed: false,
        items: groupTabIds.map((tabId) => ({ kind: 'tab' as const, tabId })),
      }
      next.folders[rootId] = root
      for (const tabId of groupTabIds) {
        next.tabs[tabId] = {
          tabId,
          windowId: oldSpace.windowId,
          baseUrl: oldSpace.pinnedTabs?.[tabId],
        }
      }
    } else {
      // Live: Space root contains one Live folder.
      const liveId = uid()
      const live: Folder = {
        id: liveId,
        name: oldSpace.name,
        collapsed: false,
        items: (oldSpace.managedTabs ?? []).map((m) => ({
          kind: 'tab' as const,
          tabId: m.tabId,
        })),
        live: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          source: oldSpace.source as any,
          refreshIntervalMin: oldSpace.refreshIntervalMin ?? 0,
          managedTabs: oldSpace.managedTabs ?? [],
          starterTabId: oldSpace.starterTabId,
          lastSyncAt: oldSpace.lastSyncAt,
          lastSyncError: oldSpace.lastSyncError,
        },
      }
      const root: Folder = {
        id: rootId,
        name: oldSpace.name,
        collapsed: false,
        items: [{ kind: 'folder', folderId: liveId }],
      }
      next.folders[rootId] = root
      next.folders[liveId] = live
      for (const m of oldSpace.managedTabs ?? []) {
        next.tabs[m.tabId] = { tabId: m.tabId, windowId: oldSpace.windowId }
      }
    }

    if (groupTabIds.length > 0) {
      try {
        await chrome.tabs.ungroup(groupTabIds)
      } catch {
        /* already ungrouped */
      }
    }
  }

  return next
}
