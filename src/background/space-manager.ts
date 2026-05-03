import {
  type Folder,
  type FolderId,
  type ItemRef,
  type LiveSource,
  type Space,
  type SpaceColor,
  type SpaceId,
  type SpaceStore,
  type TabRecord,
  CURRENT_SCHEMA_VERSION,
  collectSpaceTabIds,
  findContainingFolder,
  isLiveFolder,
  walkFolders,
} from '../shared/types'
import { loadStore, updateStore } from './storage'
import { scheduleSync, unscheduleSync } from './live/alarms'

const now = (): number => Date.now()
const uid = (): string => crypto.randomUUID()

// ---- Space CRUD ----------------------------------------------------------

export interface CreateSpaceInput {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
  // Existing tab ids to bulk-import into the new Space's root folder. If
  // omitted, the Space starts empty (no auto-created starter tab — callers
  // can append a tab later if they want).
  initialTabIds?: number[]
}

export async function createSpace(input: CreateSpaceInput): Promise<Space> {
  const rootId = uid()
  const id = uid()
  const ts = now()
  const initial = input.initialTabIds ?? []
  const space: Space = {
    id,
    name: input.name,
    color: input.color,
    emoji: input.emoji,
    windowId: input.windowId,
    order: 0,
    rootFolderId: rootId,
    createdAt: ts,
    lastAccessedAt: ts,
    lastActiveTabId: initial[0],
  }
  const root: Folder = {
    id: rootId,
    name: input.name,
    collapsed: false,
    items: initial.map((tabId) => ({ kind: 'tab' as const, tabId })),
  }
  await updateStore((s) => {
    space.order = Object.values(s.spaces).filter((sp) => sp.windowId === input.windowId).length
    s.spaces[id] = space
    s.folders[rootId] = root
    for (const tabId of initial) {
      if (!s.tabs[tabId]) s.tabs[tabId] = { tabId, windowId: input.windowId }
    }
    // Newly-imported tabs are now claimed by this Space; any other Space's
    // root that was holding the same tab id should let go.
    detachTabsFromOtherSpaces(s, id, initial)
  })
  return space
}

function detachTabsFromOtherSpaces(
  s: SpaceStore,
  ownerSpaceId: SpaceId,
  tabIds: number[],
): void {
  if (tabIds.length === 0) return
  const claim = new Set(tabIds)
  for (const sp of Object.values(s.spaces)) {
    if (sp.id === ownerSpaceId) continue
    for (const folder of walkFolders(s, sp.rootFolderId)) {
      folder.items = folder.items.filter(
        (it) => !(it.kind === 'tab' && claim.has(it.tabId)),
      )
    }
  }
}

export async function renameSpace(id: SpaceId, name: string): Promise<void> {
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (!sp) return
    sp.name = name
  })
}

export async function setSpaceColor(id: SpaceId, color: SpaceColor): Promise<void> {
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (sp) sp.color = color
  })
}

export async function setSpaceEmoji(
  id: SpaceId,
  emoji: string | undefined,
): Promise<void> {
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (sp) sp.emoji = emoji
  })
}

export async function deleteSpace(
  id: SpaceId,
  options: { closeTabs: boolean },
): Promise<void> {
  const store = await loadStore()
  const space = store.spaces[id]
  if (!space) return

  const tabIds = collectSpaceTabIds(store, id)

  // Stop alarms for any Live folder under this Space.
  for (const folder of walkFolders(store, space.rootFolderId)) {
    if (folder.live) await unscheduleSync(folder.id)
  }

  if (options.closeTabs && tabIds.length > 0) {
    try {
      await chrome.tabs.remove(tabIds)
    } catch {
      /* some tabs may already be gone */
    }
  }

  await updateStore((s) => {
    const sp = s.spaces[id]
    if (!sp) return
    for (const folder of walkFolders(s, sp.rootFolderId)) {
      delete s.folders[folder.id]
    }
    if (options.closeTabs) {
      for (const tabId of tabIds) delete s.tabs[tabId]
    }
    delete s.spaces[id]
    for (const [winId, activeId] of Object.entries(s.activeSpaceByWindow)) {
      if (activeId === id) delete s.activeSpaceByWindow[Number(winId)]
    }
  })
}

export async function reorderSpaces(
  windowId: number,
  orderedIds: SpaceId[],
): Promise<void> {
  await updateStore((s) => {
    orderedIds.forEach((id, index) => {
      const sp = s.spaces[id]
      if (sp && sp.windowId === windowId) sp.order = index
    })
  })
}

// ---- Folder CRUD ---------------------------------------------------------

export interface CreateFolderInput {
  parentFolderId: FolderId
  name: string
  emoji?: string
  color?: SpaceColor
  live?: { source: LiveSource; refreshIntervalMin?: number }
}

export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  const id = uid()
  const folder: Folder = {
    id,
    name: input.name,
    emoji: input.emoji,
    color: input.color,
    collapsed: false,
    items: [],
    live: input.live
      ? {
          source: input.live.source,
          refreshIntervalMin: input.live.refreshIntervalMin ?? 0,
          managedTabs: [],
        }
      : undefined,
  }
  await updateStore((s) => {
    const parent = s.folders[input.parentFolderId]
    if (!parent) throw new Error(`Parent folder not found: ${input.parentFolderId}`)
    s.folders[id] = folder
    parent.items.push({ kind: 'folder', folderId: id })
  })
  if (folder.live && folder.live.refreshIntervalMin > 0) {
    await scheduleSync(id, folder.live.refreshIntervalMin)
  }
  return folder
}

export async function renameFolder(id: FolderId, name: string): Promise<void> {
  await updateStore((s) => {
    const f = s.folders[id]
    if (f) f.name = name
  })
}

export async function setFolderEmoji(
  id: FolderId,
  emoji: string | undefined,
): Promise<void> {
  await updateStore((s) => {
    const f = s.folders[id]
    if (f) f.emoji = emoji
  })
}

export async function setFolderCollapsed(
  id: FolderId,
  collapsed: boolean,
): Promise<void> {
  await updateStore((s) => {
    const f = s.folders[id]
    if (f) f.collapsed = collapsed
  })
}

export async function updateLiveFolder(
  id: FolderId,
  patch: { source?: LiveSource; refreshIntervalMin?: number },
): Promise<Folder | undefined> {
  let updated: Folder | undefined
  let intervalChanged = false
  await updateStore((s) => {
    const f = s.folders[id]
    if (!f || !f.live) return
    if (patch.source !== undefined) f.live.source = patch.source
    if (
      patch.refreshIntervalMin !== undefined &&
      patch.refreshIntervalMin !== f.live.refreshIntervalMin
    ) {
      f.live.refreshIntervalMin = patch.refreshIntervalMin
      intervalChanged = true
    }
    updated = f
  })
  if (updated && updated.live && intervalChanged) {
    await scheduleSync(id, updated.live.refreshIntervalMin)
  }
  return updated
}

export async function deleteFolder(
  id: FolderId,
  options: { closeTabs: boolean },
): Promise<void> {
  const store = await loadStore()
  const folder = store.folders[id]
  if (!folder) return
  // Don't allow deleting a Space's root folder via this — use deleteSpace.
  for (const sp of Object.values(store.spaces)) {
    if (sp.rootFolderId === id) {
      throw new Error('Cannot delete a root folder; delete the Space instead.')
    }
  }

  // Collect tabs to optionally close + folder ids to delete (recursive).
  const folderIdsToDelete: FolderId[] = []
  const tabIdsInside: number[] = []
  const visit = (fid: FolderId) => {
    const f = store.folders[fid]
    if (!f) return
    folderIdsToDelete.push(fid)
    for (const item of f.items) {
      if (item.kind === 'tab') tabIdsInside.push(item.tabId)
      else visit(item.folderId)
    }
  }
  visit(id)

  for (const fid of folderIdsToDelete) {
    const f = store.folders[fid]
    if (f?.live) await unscheduleSync(fid)
  }

  if (options.closeTabs && tabIdsInside.length > 0) {
    try {
      await chrome.tabs.remove(tabIdsInside)
    } catch {
      /* some tabs may already be gone */
    }
  }

  await updateStore((s) => {
    // Remove from any parent's items list.
    for (const f of Object.values(s.folders)) {
      f.items = f.items.filter((it) => !(it.kind === 'folder' && it.folderId === id))
    }
    for (const fid of folderIdsToDelete) delete s.folders[fid]
    if (options.closeTabs) {
      for (const tabId of tabIdsInside) delete s.tabs[tabId]
    }
  })
}

// ---- Item movement (DnD primitive) --------------------------------------

export interface MoveItemInput {
  item: ItemRef
  toFolderId: FolderId
  // index in the target folder's items; clamped to [0, items.length].
  toIndex: number
}

export async function moveItem(input: MoveItemInput): Promise<void> {
  await updateStore((s) => {
    const target = s.folders[input.toFolderId]
    if (!target) return
    // Refuse to drop user content into a Live folder: sync engine owns
    // those items deterministically.
    if (target.live) return
    // Refuse cycles: cannot move a folder into itself or a descendant.
    if (input.item.kind === 'folder') {
      if (input.item.folderId === input.toFolderId) return
      const descendants = new Set<FolderId>()
      const stack: FolderId[] = [input.item.folderId]
      while (stack.length) {
        const id = stack.pop()!
        if (descendants.has(id)) continue
        descendants.add(id)
        const f = s.folders[id]
        if (!f) continue
        for (const it of f.items) if (it.kind === 'folder') stack.push(it.folderId)
      }
      if (descendants.has(input.toFolderId)) return
    }

    // Pull the item out of whichever folder currently holds it.
    for (const f of Object.values(s.folders)) {
      f.items = f.items.filter((it) => !sameItem(it, input.item))
    }
    const insertAt = Math.max(0, Math.min(input.toIndex, target.items.length))
    target.items.splice(insertAt, 0, input.item)
  })
}

function sameItem(a: ItemRef, b: ItemRef): boolean {
  if (a.kind === 'tab' && b.kind === 'tab') return a.tabId === b.tabId
  if (a.kind === 'folder' && b.kind === 'folder') return a.folderId === b.folderId
  return false
}

// ---- Tab pinning (Arc snap-back) ----------------------------------------

export async function pinTab(tabId: number, baseUrl: string): Promise<void> {
  await updateStore((s) => {
    const t = s.tabs[tabId]
    if (t) t.baseUrl = baseUrl
  })
}

export async function unpinTab(tabId: number): Promise<void> {
  await updateStore((s) => {
    const t = s.tabs[tabId]
    if (t) delete t.baseUrl
  })
}

export async function resolveBaseUrl(tabId: number): Promise<string | undefined> {
  const store = await loadStore()
  // Live folders carry their managed URL — that wins over a user-set baseUrl.
  for (const f of Object.values(store.folders)) {
    if (!f.live) continue
    const m = f.live.managedTabs.find((mt) => mt.tabId === tabId)
    if (m) return m.url
  }
  return store.tabs[tabId]?.baseUrl
}

export async function resetTabToBase(tabId: number): Promise<boolean> {
  const url = await resolveBaseUrl(tabId)
  if (!url) return false
  try {
    await chrome.tabs.update(tabId, { url })
    return true
  } catch {
    return false
  }
}

// ---- Tab record bookkeeping (called from chrome.tabs handlers) ----------

export async function registerTab(tab: chrome.tabs.Tab): Promise<void> {
  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') return
  const tabId = tab.id
  const windowId = tab.windowId
  await updateStore((s) => {
    s.tabs[tabId] = { ...s.tabs[tabId], tabId, windowId }
    // Append to the active Space's root folder if not already tracked.
    const activeId = s.activeSpaceByWindow[windowId]
    if (!activeId) return
    const space = s.spaces[activeId]
    if (!space) return
    const root = s.folders[space.rootFolderId]
    if (!root) return
    const alreadyAnywhere = Object.values(s.folders).some((f) =>
      f.items.some((it) => it.kind === 'tab' && it.tabId === tabId),
    )
    if (!alreadyAnywhere) root.items.push({ kind: 'tab', tabId })
  })
}

export async function dropTab(tabId: number): Promise<void> {
  await updateStore((s) => {
    delete s.tabs[tabId]
    for (const f of Object.values(s.folders)) {
      f.items = f.items.filter((it) => !(it.kind === 'tab' && it.tabId === tabId))
      if (f.live) {
        f.live.managedTabs = f.live.managedTabs.filter((m) => m.tabId !== tabId)
      }
    }
    for (const sp of Object.values(s.spaces)) {
      if (sp.lastActiveTabId === tabId) sp.lastActiveTabId = undefined
    }
  })
}

export async function setLastActiveTab(windowId: number, tabId: number): Promise<void> {
  const store = await loadStore()
  const activeId = store.activeSpaceByWindow[windowId]
  if (!activeId) return
  const sp = store.spaces[activeId]
  if (!sp || sp.lastActiveTabId === tabId) return
  await updateStore((s) => {
    const id = s.activeSpaceByWindow[windowId]
    if (!id) return
    const space = s.spaces[id]
    if (space) space.lastActiveTabId = tabId
  })
}

// ---- Switch (the centerpiece) -------------------------------------------

export async function switchTo(spaceId: SpaceId, windowId?: number): Promise<void> {
  const store = await loadStore()
  const target = store.spaces[spaceId]
  if (!target) return
  const winId = windowId ?? target.windowId

  // Persist active first so onTabActivated and onTabUpdated handlers see
  // the new state and don't try to "fix up" tabs based on the old Space.
  await updateStore((s) => {
    s.activeSpaceByWindow[winId] = spaceId
    const sp = s.spaces[spaceId]
    if (sp) sp.lastAccessedAt = now()
  })

  const targetTabIds = new Set(collectSpaceTabIds(store, spaceId))

  // Activate one of the target's tabs first — Chrome refuses to hide an
  // active tab. Pick lastActiveTabId, fall back to the first known tab.
  const activatePreferred = target.lastActiveTabId
  let activatedId: number | undefined
  if (activatePreferred && targetTabIds.has(activatePreferred)) {
    try {
      await chrome.tabs.update(activatePreferred, { active: true })
      activatedId = activatePreferred
    } catch {
      /* tab missing */
    }
  }
  if (activatedId === undefined) {
    for (const id of targetTabIds) {
      try {
        await chrome.tabs.update(id, { active: true })
        activatedId = id
        break
      } catch {
        /* try next */
      }
    }
  }

  // If the Space has no tabs at all, create a starter tab for it.
  if (activatedId === undefined) {
    try {
      const created = await chrome.tabs.create({ windowId: winId, active: true })
      if (typeof created.id === 'number') {
        activatedId = created.id
        targetTabIds.add(created.id)
        await updateStore((s) => {
          s.tabs[created.id!] = { tabId: created.id!, windowId: winId }
          const sp = s.spaces[spaceId]
          if (!sp) return
          const root = s.folders[sp.rootFolderId]
          if (root) root.items.push({ kind: 'tab', tabId: created.id! })
        })
      }
    } catch {
      /* nothing we can do */
    }
  }

  // Show every target tab (idempotent), then hide every other tab in the
  // window.
  const allTabs = await chrome.tabs.query({ windowId: winId })
  const toShow: number[] = []
  const toHide: number[] = []
  for (const t of allTabs) {
    if (typeof t.id !== 'number') continue
    if (targetTabIds.has(t.id)) {
      if ((t as { hidden?: boolean }).hidden) toShow.push(t.id)
    } else if (t.id !== activatedId) {
      // Chrome refuses to hide the active tab; we already activated one in
      // the target Space above so this guard only triggers if activation
      // failed.
      toHide.push(t.id)
    }
  }
  // chrome.tabs.show / hide are real APIs but @types/chrome's version
  // here predates them. Cast to access.
  const tabsApi = chrome.tabs as unknown as {
    show: (ids: number[]) => Promise<void>
    hide: (ids: number[]) => Promise<void>
  }
  if (toShow.length > 0) {
    try {
      await tabsApi.show(toShow)
    } catch {
      /* ignore */
    }
  }
  if (toHide.length > 0) {
    try {
      await tabsApi.hide(toHide)
    } catch {
      /* ignore — some tabs may not be hideable */
    }
  }
}

// ---- Read helpers --------------------------------------------------------

export async function getSpace(id: SpaceId): Promise<Space | undefined> {
  return (await loadStore()).spaces[id]
}

export async function listSpaces(windowId?: number): Promise<Space[]> {
  const store = await loadStore()
  const all = Object.values(store.spaces)
  const filtered = windowId === undefined ? all : all.filter((s) => s.windowId === windowId)
  return filtered.sort((a, b) => a.order - b.order)
}

export async function getActiveSpace(windowId: number): Promise<Space | undefined> {
  const store = await loadStore()
  const id = store.activeSpaceByWindow[windowId]
  return id ? store.spaces[id] : undefined
}

// Append a batch of existing tabs to a folder. Used by the side panel's
// "orphan tabs" action — tabs that exist in the window but aren't claimed
// by any Space yet (created while the SW was suspended, or left behind by
// a `deleteSpace({ closeTabs: false })`). Live folders refuse adoption.
export async function addTabsToFolder(
  folderId: FolderId,
  tabIds: number[],
): Promise<void> {
  if (tabIds.length === 0) return
  const allTabs = await chrome.tabs.query({})
  const tabWindowById = new Map<number, number>()
  for (const t of allTabs) {
    if (typeof t.id === 'number' && typeof t.windowId === 'number') {
      tabWindowById.set(t.id, t.windowId)
    }
  }
  await updateStore((s) => {
    const folder = s.folders[folderId]
    if (!folder) return
    if (folder.live) return
    // Detach from any other folder so each tab belongs in one place.
    for (const f of Object.values(s.folders)) {
      if (f.id === folderId) continue
      f.items = f.items.filter(
        (it) => !(it.kind === 'tab' && tabIds.includes(it.tabId)),
      )
    }
    for (const tabId of tabIds) {
      if (!s.tabs[tabId]) {
        const wId = tabWindowById.get(tabId)
        if (wId === undefined) continue
        s.tabs[tabId] = { tabId, windowId: wId }
      }
      if (!folder.items.some((it) => it.kind === 'tab' && it.tabId === tabId)) {
        folder.items.push({ kind: 'tab', tabId })
      }
    }
  })
}

// Walk every Chrome Tab Group in the window and create a Space from each.
// Tabs claimed by an existing Space are skipped (they're already accounted
// for); leftover tabs in a group become the new Space's root folder. The
// underlying Chrome Tab Group is ungrouped at the end so the model stays
// in one place.
export async function importChromeTabGroups(windowId: number): Promise<Space[]> {
  const groups = await chrome.tabGroups.query({ windowId })
  const created: Space[] = []
  for (const g of groups) {
    let groupTabs: chrome.tabs.Tab[]
    try {
      groupTabs = await chrome.tabs.query({ groupId: g.id })
    } catch {
      continue
    }
    const store = await loadStore()
    const claimed = new Set<number>()
    for (const f of Object.values(store.folders)) {
      for (const it of f.items) if (it.kind === 'tab') claimed.add(it.tabId)
    }
    const tabIds = groupTabs
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number' && !claimed.has(id))
    if (tabIds.length === 0) continue

    const space = await createSpace({
      name: g.title || 'Imported',
      color: g.color,
      windowId,
      initialTabIds: tabIds,
    })
    created.push(space)

    try {
      await chrome.tabs.ungroup(tabIds)
    } catch {
      /* group may have just been removed */
    }
  }
  return created
}

// Replace the entire store with a previously-exported one. Tab refs and
// the TabRecord map are dropped because tab ids are session-scoped — the
// imported store almost certainly came from a different Chrome session.
// Folder structure / Live config / pinned baseUrls (those live on
// TabRecord, dropped) — only the durable parts survive.
//
// `currentWindowId` rehomes every Space and Live alarm to the window the
// user is in right now, since the source windowIds are stale too.
export async function importStore(
  raw: SpaceStore,
  currentWindowId: number,
): Promise<void> {
  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Schema version mismatch: file is v${raw.schemaVersion}, this build is v${CURRENT_SCHEMA_VERSION}`,
    )
  }
  // Strip tab refs from every folder; reset Live folder managedTabs.
  const folders: SpaceStore['folders'] = {}
  for (const f of Object.values(raw.folders)) {
    folders[f.id] = {
      ...f,
      items: f.items.filter((it) => it.kind === 'folder'),
      live: f.live
        ? {
            source: f.live.source,
            refreshIntervalMin: f.live.refreshIntervalMin,
            managedTabs: [],
            starterTabId: undefined,
            lastSyncAt: undefined,
            lastSyncError: undefined,
          }
        : undefined,
    }
  }
  const spaces: SpaceStore['spaces'] = {}
  for (const sp of Object.values(raw.spaces)) {
    spaces[sp.id] = {
      ...sp,
      windowId: currentWindowId,
      lastActiveTabId: undefined,
    }
  }
  const next: SpaceStore = {
    spaces,
    folders,
    tabs: {},
    activeSpaceByWindow: {},
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
  await updateStore(() => next)
}

// Reassign Spaces whose windowId no longer matches any open Chrome window
// to a live window. Called from bootstrap after Chrome restart: Chrome
// hands out new windowIds even with session restore enabled, so every
// previously-stored Space looks orphaned.
export async function reattachOrphanSpaces(): Promise<void> {
  const wins = await chrome.windows.getAll()
  const liveWindowIds = new Set(
    wins.map((w) => w.id).filter((id): id is number => typeof id === 'number'),
  )
  if (liveWindowIds.size === 0) return
  const fallback = [...liveWindowIds][0]!
  await updateStore((s) => {
    for (const sp of Object.values(s.spaces)) {
      if (!liveWindowIds.has(sp.windowId)) sp.windowId = fallback
    }
    for (const k of Object.keys(s.activeSpaceByWindow)) {
      if (!liveWindowIds.has(Number(k))) delete s.activeSpaceByWindow[Number(k)]
    }
    // Tab records can also outlive a Chrome session; rebase to fallback so
    // they don't shadow real tabs in other windows.
    for (const t of Object.values(s.tabs)) {
      if (!liveWindowIds.has(t.windowId)) t.windowId = fallback
    }
  })
}

// Used by reconcile to drop stale tab refs.
export function pruneDeadTabs(s: SpaceStore, liveTabIds: Set<number>): boolean {
  let changed = false
  for (const f of Object.values(s.folders)) {
    const before = f.items.length
    f.items = f.items.filter((it) => it.kind === 'folder' || liveTabIds.has(it.tabId))
    if (f.items.length !== before) changed = true
    if (f.live) {
      const beforeM = f.live.managedTabs.length
      f.live.managedTabs = f.live.managedTabs.filter((m) => liveTabIds.has(m.tabId))
      if (f.live.managedTabs.length !== beforeM) changed = true
    }
  }
  for (const tabId of Object.keys(s.tabs)) {
    if (!liveTabIds.has(Number(tabId))) {
      delete s.tabs[Number(tabId)]
      changed = true
    }
  }
  for (const sp of Object.values(s.spaces)) {
    if (sp.lastActiveTabId !== undefined && !liveTabIds.has(sp.lastActiveTabId)) {
      sp.lastActiveTabId = undefined
      changed = true
    }
  }
  return changed
}

// Re-exports kept for tests / handlers.
export { findContainingFolder, isLiveFolder, walkFolders }
export type { TabRecord }
