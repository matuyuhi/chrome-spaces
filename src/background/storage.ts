import {
  type Folder,
  type Space,
  type SpaceColor,
  type SpaceStore,
  type LiveSource,
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

// Serialize updates so concurrent callers don't trample each other.
// chrome.storage.local.get + set is two async hops with no built-in
// transaction; without this lock, two updateStore() calls that overlap
// can both load the same snapshot and then save sequentially, with the
// later save silently discarding the earlier mutation. This bit
// chrome.tabs.onCreated → registerTab racing materializeLiveTab.
let updateChain: Promise<unknown> = Promise.resolve()

export async function updateStore(
  mutator: (store: SpaceStore) => SpaceStore | void,
): Promise<SpaceStore> {
  const next = updateChain.then(async () => {
    const current = await loadStore()
    const result = mutator(current) ?? current
    await saveStore(result)
    return result
  })
  // Don't let one mutator's rejection break the chain for everyone else.
  updateChain = next.catch(() => undefined)
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

  let current: SpaceStore
  let version = stored.schemaVersion
  if (version === undefined || version === 1) {
    current = await migrateV1ToV2(stored as unknown as V1Store)
    version = 2
  } else {
    current = stored as unknown as SpaceStore
  }
  if (version === 2) {
    current = migrateV2ToV3(current)
    version = 3
  }
  if (version === CURRENT_SCHEMA_VERSION) {
    await saveStore(current)
  }
}

// v3 introduces ItemRef.kind = 'live' and makes ManagedTab.tabId
// optional. For each live folder, replace its items list (which used to
// be { kind:'tab', tabId } pointing at managedTabs) with kind:'live'
// refs keyed by externalId. Existing materialized tabIds are preserved
// on the managedTabs themselves so users don't lose their open tabs.
function migrateV2ToV3(store: SpaceStore): SpaceStore {
  for (const folder of Object.values(store.folders)) {
    if (!folder.live) continue
    const byTab = new Map<number, string>()
    for (const m of folder.live.managedTabs) {
      if (typeof m.tabId === 'number') byTab.set(m.tabId, m.externalId)
    }
    const seen = new Set<string>()
    const items: typeof folder.items = []
    for (const it of folder.items) {
      if (it.kind !== 'tab') {
        items.push(it)
        continue
      }
      const ext = byTab.get(it.tabId)
      if (ext && !seen.has(ext)) {
        items.push({ kind: 'live', externalId: ext })
        seen.add(ext)
      }
      // Tab in a live folder but not in managedTabs: drop (defensive).
    }
    // Append any managedTabs not yet referenced (e.g. tabId-less entries
    // that wouldn't match the byTab map).
    for (const m of folder.live.managedTabs) {
      if (!seen.has(m.externalId)) {
        items.push({ kind: 'live', externalId: m.externalId })
        seen.add(m.externalId)
      }
    }
    folder.items = items
  }
  store.schemaVersion = CURRENT_SCHEMA_VERSION
  return store
}

async function migrateV1ToV2(old: V1Store): Promise<SpaceStore> {
  const next = emptyStore()
  // emptyStore() stamps the latest schema version, but this function
  // intentionally produces v2-shape data (kind:'tab' items inside live
  // folders); the caller chains through migrateV2ToV3 to finish.
  next.schemaVersion = 2
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
          source: oldSpace.source as LiveSource,
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
