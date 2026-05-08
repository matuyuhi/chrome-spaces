/**
 * Undo stack for destructive UI operations.
 *
 * Scope: operations triggered from the side panel UI. Chrome's own
 * tab-close (X button) is handled by Chrome's standard Cmd+Shift+T and
 * is NOT tracked here (chrome.tabs.onRemoved → dropTab path).
 *
 * Undo operations:
 *   - closeTab   (UI close button → 'closeTab' message)
 *   - moveItem   (DnD → 'moveItem' message)
 *   - deleteFolder (non-live, 'deleteFolder' message, closeTabs: true|false)
 *   - deleteSpace  ('deleteSpace' message, closeTabs: true|false)
 *
 * Non-undo (v1 skip):
 *   - Live folder delete / move — live config restoration + re-materialize
 *     complexity is out of scope for v1.
 *   - Redo (Cmd+Shift+Z)
 *   - Rename / color / emoji — non-destructive, low value to undo.
 *   - chrome.tabs.onRemoved → dropTab — Chrome handles this via Cmd+Shift+T.
 */

import { type Folder, type FolderId, type ItemRef, type Space, type SpaceId } from '../shared/types'
import { loadStore, updateStore } from './storage'
import { moveItem } from './space-manager'
import { scheduleSync } from './live/alarms'

// ---- Action types --------------------------------------------------------

interface ClosedTabSnapshot {
  url: string
  title?: string
  baseUrl?: string
  parentFolderId: FolderId
  /** index within parentFolder.items at snapshot time */
  index: number
}

export type UndoAction =
  | {
      kind: 'close-tab'
      windowId: number
      url: string
      title?: string
      baseUrl?: string
      /** folder that contained the tab */
      folderId: FolderId
      /** index in that folder's items array */
      index: number
    }
  | {
      kind: 'move-item'
      windowId: number
      item: ItemRef
      fromFolderId: FolderId
      fromIndex: number
    }
  | {
      kind: 'delete-folder'
      windowId: number
      /** folder that contained the deleted folder */
      parentFolderId: FolderId
      /** index in parent.items at snapshot time */
      index: number
      snapshot: {
        folder: Folder
        /** descendant folders (excluding the root folder itself) */
        descendantFolders: Folder[]
        /**
         * Populated only when closeTabs=true. Snapshots the tabs that were
         * closed so undo can re-open them.
         */
        closedTabs: ClosedTabSnapshot[]
        /** Live folders (within the subtree) that had active alarms (refreshIntervalMin >= 1). */
        liveSchedules: Array<{ folderId: FolderId; refreshIntervalMin: number }>
      }
    }
  | {
      kind: 'delete-space'
      windowId: number
      /** index in the ordered space list at snapshot time */
      orderIndex: number
      snapshot: {
        space: Space
        folders: Folder[]
        closedTabs: ClosedTabSnapshot[]
        /** Live folders (within the space) that had active alarms (refreshIntervalMin >= 1). */
        liveSchedules: Array<{ folderId: FolderId; refreshIntervalMin: number }>
      }
    }

// ---- Stack ---------------------------------------------------------------

const MAX_STACK_SIZE = 50

// windowId → stack (newest first at index 0)
const stacks = new Map<number, UndoAction[]>()

function getStack(windowId: number): UndoAction[] {
  let s = stacks.get(windowId)
  if (!s) {
    s = []
    stacks.set(windowId, s)
  }
  return s
}

function push(windowId: number, action: UndoAction): void {
  const s = getStack(windowId)
  s.unshift(action)
  if (s.length > MAX_STACK_SIZE) s.splice(MAX_STACK_SIZE)
}

export function clearUndoStack(windowId?: number): void {
  if (windowId !== undefined) {
    stacks.delete(windowId)
  } else {
    stacks.clear()
  }
}

export function peekUndoStack(windowId: number): UndoAction | undefined {
  return getStack(windowId)[0]
}

// ---- Utilities -----------------------------------------------------------

/** Walk all spaces to find the windowId that owns a given folderId. */
export function findWindowIdForFolder(
  store: Awaited<ReturnType<typeof loadStore>>,
  folderId: FolderId,
): number | undefined {
  // BFS from every space root.
  for (const sp of Object.values(store.spaces)) {
    const visited = new Set<FolderId>()
    const queue: FolderId[] = [sp.rootFolderId]
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      if (id === folderId) return sp.windowId
      const f = store.folders[id]
      if (!f) continue
      for (const it of f.items) {
        if (it.kind === 'folder') queue.push(it.folderId)
      }
    }
  }
  return undefined
}

/** Walk all spaces to find the windowId that owns a given ItemRef. */
export function findWindowIdForItem(
  store: Awaited<ReturnType<typeof loadStore>>,
  item: ItemRef,
): number | undefined {
  for (const f of Object.values(store.folders)) {
    if (f.live) continue // live-folder items are not undo-tracked
    const found = f.items.some((it) => {
      if (it.kind !== item.kind) return false
      if (it.kind === 'tab' && item.kind === 'tab') return it.tabId === item.tabId
      if (it.kind === 'folder' && item.kind === 'folder') return it.folderId === item.folderId
      return false
    })
    if (found) return findWindowIdForFolder(store, f.id)
  }
  return undefined
}

/** Find the folder + index that contains an ItemRef. */
function findItemLocation(
  store: Awaited<ReturnType<typeof loadStore>>,
  item: ItemRef,
): { folderId: FolderId; index: number } | undefined {
  for (const f of Object.values(store.folders)) {
    const idx = f.items.findIndex((it) => {
      if (it.kind !== item.kind) return false
      if (it.kind === 'tab' && item.kind === 'tab') return it.tabId === item.tabId
      if (it.kind === 'folder' && item.kind === 'folder') return it.folderId === item.folderId
      return false
    })
    if (idx !== -1) return { folderId: f.id, index: idx }
  }
  return undefined
}

/** Collect a human-readable description for a UndoAction. */
function describe(action: UndoAction): string {
  switch (action.kind) {
    case 'close-tab':
      return `Closed tab: ${action.title ?? action.url}`
    case 'move-item':
      return `Moved item`
    case 'delete-folder':
      return `Deleted folder: ${action.snapshot.folder.name}`
    case 'delete-space':
      return `Deleted space: ${action.snapshot.space.name}`
  }
}

// ---- Record helpers (call BEFORE the destructive operation) --------------

/** Record a tab-close. Call right before chrome.tabs.remove. */
export async function recordCloseTab(tabId: number, windowId: number): Promise<void> {
  const store = await loadStore()
  const tabRecord = store.tabs[tabId]

  // Find which folder contains this tab and at what index.
  const location = findItemLocation(store, { kind: 'tab', tabId })
  if (!location) return // tab not tracked in any folder

  const folder = store.folders[location.folderId]
  if (!folder) return

  // Don't record undo for live-folder tabs (link items; user can re-materialize).
  if (folder.live) return

  const chromeTab = await chrome.tabs.get(tabId).catch(() => undefined)
  push(windowId, {
    kind: 'close-tab',
    windowId,
    url: chromeTab?.url ?? '',
    title: chromeTab?.title,
    baseUrl: tabRecord?.baseUrl,
    folderId: location.folderId,
    index: location.index,
  })
}

/** Record an item move. Call right before moveItem(). */
export async function recordMoveItem(item: ItemRef, windowId: number): Promise<void> {
  // Don't record live refs.
  if (item.kind === 'live') return

  const store = await loadStore()

  // Don't record if the item is inside a live folder.
  const location = findItemLocation(store, item)
  if (!location) return
  const parentFolder = store.folders[location.folderId]
  if (parentFolder?.live) return

  // Don't record if the item itself is a live folder.
  if (item.kind === 'folder') {
    const f = store.folders[item.folderId]
    if (f?.live) return
  }

  push(windowId, {
    kind: 'move-item',
    windowId,
    item,
    fromFolderId: location.folderId,
    fromIndex: location.index,
  })
}

/** Record a folder delete. Call right before deleteFolder(). */
export async function recordDeleteFolder(
  folderId: FolderId,
  closeTabs: boolean,
  windowId: number,
): Promise<void> {
  const store = await loadStore()
  const folder = store.folders[folderId]
  if (!folder) return

  // Don't record live folder deletions.
  if (folder.live) return

  // Find the parent folder.
  let parentFolderId: FolderId | undefined
  let parentIndex = -1
  for (const f of Object.values(store.folders)) {
    const idx = f.items.findIndex((it) => it.kind === 'folder' && it.folderId === folderId)
    if (idx !== -1) {
      parentFolderId = f.id
      parentIndex = idx
      break
    }
  }
  if (!parentFolderId) return

  // Collect the full subtree of folders (excluding the root folder itself which
  // is snapshot-ed separately).
  const descendantFolders: Folder[] = []
  const collectDescendants = (fid: FolderId) => {
    const f = store.folders[fid]
    if (!f) return
    for (const it of f.items) {
      if (it.kind === 'folder') {
        const child = store.folders[it.folderId]
        if (child) {
          descendantFolders.push(structuredClone(child))
          collectDescendants(it.folderId)
        }
      }
    }
  }
  collectDescendants(folderId)

  // Collect live schedules (refreshIntervalMin >= 1) across the subtree.
  const liveSchedules: Array<{ folderId: FolderId; refreshIntervalMin: number }> = []
  const checkLive = (f: Folder) => {
    if (f.live && f.live.refreshIntervalMin >= 1) {
      liveSchedules.push({ folderId: f.id, refreshIntervalMin: f.live.refreshIntervalMin })
    }
  }
  checkLive(folder)
  for (const df of descendantFolders) checkLive(df)

  // Collect tabs to re-open if closeTabs=true.
  const closedTabs: ClosedTabSnapshot[] = []
  if (closeTabs) {
    // Walk the subtree depth-first and collect (tabId, folderId, index) tuples.
    const tabSnapshots: Array<{ tabId: number; folderId: FolderId; index: number; baseUrl?: string }> = []
    const collectTabIds = (fid: FolderId) => {
      const f = store.folders[fid]
      if (!f) return
      f.items.forEach((it, idx) => {
        if (it.kind === 'tab') {
          tabSnapshots.push({
            tabId: it.tabId,
            folderId: fid,
            index: idx,
            baseUrl: store.tabs[it.tabId]?.baseUrl,
          })
        } else if (it.kind === 'folder') {
          collectTabIds(it.folderId)
        }
      })
    }
    collectTabIds(folderId)

    // Parallel fetch of URL/title from Chrome (before the tabs are closed).
    const tabInfos = await Promise.all(
      tabSnapshots.map((snap) => chrome.tabs.get(snap.tabId).catch(() => undefined)),
    )
    for (let i = 0; i < tabSnapshots.length; i++) {
      const snap = tabSnapshots[i]!
      const tab = tabInfos[i]
      closedTabs.push({
        url: tab?.url ?? '',
        title: tab?.title,
        baseUrl: snap.baseUrl,
        parentFolderId: snap.folderId,
        index: snap.index,
      })
    }
  }

  push(windowId, {
    kind: 'delete-folder',
    windowId,
    parentFolderId,
    index: parentIndex,
    snapshot: {
      folder: structuredClone(folder),
      descendantFolders,
      closedTabs,
      liveSchedules,
    },
  })
}

/** Record a space delete. Call right before deleteSpace(). */
export async function recordDeleteSpace(
  spaceId: SpaceId,
  closeTabs: boolean,
  windowId: number,
): Promise<void> {
  const store = await loadStore()
  const space = store.spaces[spaceId]
  if (!space) return

  // Collect all folders in the subtree.
  const folders: Folder[] = []
  const collectFolders = (fid: FolderId) => {
    const f = store.folders[fid]
    if (!f) return
    folders.push(structuredClone(f))
    for (const it of f.items) {
      if (it.kind === 'folder') collectFolders(it.folderId)
    }
  }
  collectFolders(space.rootFolderId)

  // Collect live schedules (refreshIntervalMin >= 1) across all folders in the subtree.
  const liveSchedules: Array<{ folderId: FolderId; refreshIntervalMin: number }> = []
  for (const f of folders) {
    if (f.live && f.live.refreshIntervalMin >= 1) {
      liveSchedules.push({ folderId: f.id, refreshIntervalMin: f.live.refreshIntervalMin })
    }
  }

  // Compute order index (position among window's spaces sorted by order).
  const windowSpaces = Object.values(store.spaces)
    .filter((s) => s.windowId === space.windowId)
    .sort((a, b) => a.order - b.order)
  const orderIndex = windowSpaces.findIndex((s) => s.id === spaceId)

  // Collect closed tabs if closeTabs=true.
  const closedTabs: ClosedTabSnapshot[] = []
  if (closeTabs) {
    const tabSnapshots: Array<{ tabId: number; folderId: FolderId; index: number; baseUrl?: string }> = []
    const collectTabIds = (fid: FolderId) => {
      const f = store.folders[fid]
      if (!f) return
      f.items.forEach((it, idx) => {
        if (it.kind === 'tab') {
          tabSnapshots.push({
            tabId: it.tabId,
            folderId: fid,
            index: idx,
            baseUrl: store.tabs[it.tabId]?.baseUrl,
          })
        } else if (it.kind === 'folder') {
          collectTabIds(it.folderId)
        }
      })
    }
    collectTabIds(space.rootFolderId)

    // Parallel fetch of tab URL/title.
    const tabInfos = await Promise.all(
      tabSnapshots.map((snap) => chrome.tabs.get(snap.tabId).catch(() => undefined)),
    )
    for (let i = 0; i < tabSnapshots.length; i++) {
      const snap = tabSnapshots[i]!
      const tab = tabInfos[i]
      closedTabs.push({
        url: tab?.url ?? '',
        title: tab?.title,
        baseUrl: snap.baseUrl,
        parentFolderId: snap.folderId,
        index: snap.index,
      })
    }
  }

  push(windowId, {
    kind: 'delete-space',
    windowId,
    orderIndex: Math.max(0, orderIndex),
    snapshot: {
      space: structuredClone(space),
      folders,
      closedTabs,
      liveSchedules,
    },
  })
}

// ---- Undo (pop & restore) ------------------------------------------------

export async function undo(
  windowId: number,
): Promise<{ ok: boolean; description?: string }> {
  const stack = getStack(windowId)
  const action = stack[0]
  if (!action) return { ok: false }

  try {
    const ok = await applyUndo(action, windowId)
    if (ok) stack.shift()
    return ok ? { ok: true, description: describe(action) } : { ok: false }
  } catch (e) {
    console.error('[Spaces] undo failed', action, e)
    return { ok: false }
  }
}

async function applyUndo(action: UndoAction, windowId: number): Promise<boolean> {
  switch (action.kind) {
    case 'close-tab':
      return undoCloseTab(action, windowId)
    case 'move-item':
      return undoMoveItem(action)
    case 'delete-folder':
      return undoDeleteFolder(action, windowId)
    case 'delete-space':
      return undoDeleteSpace(action, windowId)
  }
}

// ---- close-tab undo -------------------------------------------------------

async function undoCloseTab(
  action: Extract<UndoAction, { kind: 'close-tab' }>,
  windowId: number,
): Promise<boolean> {
  if (!action.url) return false

  // Re-open the tab.
  let newTabId: number
  try {
    const created = await chrome.tabs.create({
      url: action.url,
      windowId,
      active: false,
    })
    if (typeof created.id !== 'number') return false
    newTabId = created.id
  } catch {
    return false
  }

  // Yield so that registerTab (onCreated → registerTab) can write first,
  // then we overwrite with the correct position.
  await new Promise<void>((r) => setTimeout(r, 0))

  await updateStore((s) => {
    // Strip from everywhere (counteract the registerTab race).
    for (const f of Object.values(s.folders)) {
      f.items = f.items.filter((it) => !(it.kind === 'tab' && it.tabId === newTabId))
    }
    // Insert into original folder at original index (best effort).
    const targetFolder = s.folders[action.folderId]
    if (targetFolder && !targetFolder.live) {
      const insertAt = Math.min(action.index, targetFolder.items.length)
      targetFolder.items.splice(insertAt, 0, { kind: 'tab', tabId: newTabId })
    } else {
      // Original folder gone — fall back to active Space root.
      const activeSpaceId = s.activeSpaceByWindow[windowId]
      const activeSpace = activeSpaceId ? s.spaces[activeSpaceId] : undefined
      const root = activeSpace ? s.folders[activeSpace.rootFolderId] : undefined
      if (root) root.items.push({ kind: 'tab', tabId: newTabId })
    }
    // Create / update the TabRecord.
    s.tabs[newTabId] = {
      tabId: newTabId,
      windowId,
      baseUrl: action.baseUrl,
      lastActiveAt: Date.now(),
    }
  })

  return true
}

// ---- move-item undo -------------------------------------------------------

async function undoMoveItem(
  action: Extract<UndoAction, { kind: 'move-item' }>,
): Promise<boolean> {
  const store = await loadStore()
  const targetFolder = store.folders[action.fromFolderId]
  if (!targetFolder) return false

  await moveItem({
    item: action.item,
    toFolderId: action.fromFolderId,
    toIndex: action.fromIndex,
  })
  return true
}

// ---- delete-folder undo ---------------------------------------------------

async function undoDeleteFolder(
  action: Extract<UndoAction, { kind: 'delete-folder' }>,
  windowId: number,
): Promise<boolean> {
  // Re-open closed tabs first so we have the new tabIds before writing store.
  const newTabIds = new Map<string, number>() // key: `${folderId}:${index}`

  await Promise.all(
    action.snapshot.closedTabs.map(async (ct) => {
      if (!ct.url) return
      try {
        const created = await chrome.tabs.create({
          url: ct.url,
          windowId,
          active: false,
        })
        if (typeof created.id === 'number') {
          newTabIds.set(`${ct.parentFolderId}:${ct.index}`, created.id)
        }
      } catch {
        /* best effort */
      }
    })
  )

  // Yield for registerTab races.
  if (newTabIds.size > 0) await new Promise<void>((r) => setTimeout(r, 0))

  await updateStore((s) => {
    // Restore descendant folders first (so parent can reference them).
    for (const f of action.snapshot.descendantFolders) {
      s.folders[f.id] = structuredClone(f)
    }
    // Restore the deleted folder itself.
    const restoredFolder = structuredClone(action.snapshot.folder)
    s.folders[restoredFolder.id] = restoredFolder

    // Rebuild tab items for the restored folders using new tabIds.
    for (const ct of action.snapshot.closedTabs) {
      const key = `${ct.parentFolderId}:${ct.index}`
      const newTabId = newTabIds.get(key)
      if (typeof newTabId !== 'number') continue
      // Strip from everywhere first.
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'tab' && it.tabId === newTabId))
      }
      const f = s.folders[ct.parentFolderId]
      if (f && !f.live) {
        const insertAt = Math.min(ct.index, f.items.length)
        f.items.splice(insertAt, 0, { kind: 'tab', tabId: newTabId })
      }
      s.tabs[newTabId] = {
        tabId: newTabId,
        windowId,
        baseUrl: ct.baseUrl,
        lastActiveAt: Date.now(),
      }
    }

    // Re-attach the restored folder to its parent at the original index.
    const parent = s.folders[action.parentFolderId]
    if (parent) {
      const ref: ItemRef = { kind: 'folder', folderId: restoredFolder.id }
      const insertAt = Math.min(action.index, parent.items.length)
      parent.items.splice(insertAt, 0, ref)
    } else {
      // Parent gone — attach to active Space root.
      const activeSpaceId = s.activeSpaceByWindow[windowId]
      const activeSpace = activeSpaceId ? s.spaces[activeSpaceId] : undefined
      const root = activeSpace ? s.folders[activeSpace.rootFolderId] : undefined
      if (root) root.items.push({ kind: 'folder', folderId: restoredFolder.id })
    }
  })

  // Re-schedule any live folder alarms that were active before deletion.
  for (const { folderId: liveFid, refreshIntervalMin } of action.snapshot.liveSchedules) {
    await scheduleSync(liveFid, refreshIntervalMin)
  }

  return true
}

// ---- delete-space undo ----------------------------------------------------

async function undoDeleteSpace(
  action: Extract<UndoAction, { kind: 'delete-space' }>,
  windowId: number,
): Promise<boolean> {
  // Re-open closed tabs first.
  const newTabIds = new Map<string, number>() // key: `${folderId}:${index}`

  await Promise.all(
    action.snapshot.closedTabs.map(async (ct) => {
      if (!ct.url) return
      try {
        const created = await chrome.tabs.create({
          url: ct.url,
          windowId,
          active: false,
        })
        if (typeof created.id === 'number') {
          newTabIds.set(`${ct.parentFolderId}:${ct.index}`, created.id)
        }
      } catch {
        /* best effort */
      }
    })
  )

  if (newTabIds.size > 0) await new Promise<void>((r) => setTimeout(r, 0))

  await updateStore((s) => {
    const sp = action.snapshot.space
    // Rehome to the current windowId if the original window is gone.
    const targetWindowId = windowId

    // Restore folders.
    for (const f of action.snapshot.folders) {
      s.folders[f.id] = structuredClone(f)
    }

    // Restore space; rehome windowId.
    const restoredSpace = structuredClone(sp)
    restoredSpace.windowId = targetWindowId

    // Recompute order: insert at orderIndex among window's spaces.
    const windowSpaces = Object.values(s.spaces)
      .filter((ws) => ws.windowId === targetWindowId)
      .sort((a, b) => a.order - b.order)
    // Shift existing spaces' order up to make room.
    for (const ws of windowSpaces) {
      if (ws.order >= action.orderIndex) ws.order++
    }
    restoredSpace.order = action.orderIndex
    s.spaces[restoredSpace.id] = restoredSpace

    // Rebuild tab items using new tabIds.
    for (const ct of action.snapshot.closedTabs) {
      const key = `${ct.parentFolderId}:${ct.index}`
      const newTabId = newTabIds.get(key)
      if (typeof newTabId !== 'number') continue
      // Strip from everywhere first.
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'tab' && it.tabId === newTabId))
      }
      const f = s.folders[ct.parentFolderId]
      if (f && !f.live) {
        const insertAt = Math.min(ct.index, f.items.length)
        f.items.splice(insertAt, 0, { kind: 'tab', tabId: newTabId })
      }
      s.tabs[newTabId] = {
        tabId: newTabId,
        windowId: targetWindowId,
        baseUrl: ct.baseUrl,
        lastActiveAt: Date.now(),
      }
    }
  })

  // Re-schedule any live folder alarms that were active before deletion.
  for (const { folderId: liveFid, refreshIntervalMin } of action.snapshot.liveSchedules) {
    await scheduleSync(liveFid, refreshIntervalMin)
  }

  return true
}

// ---- peekUndo (for UI description) --------------------------------------

export function peekUndo(
  windowId: number,
): { kind: string; description: string } | undefined {
  const action = peekUndoStack(windowId)
  if (!action) return undefined
  return {
    kind: action.kind,
    description: describe(action),
  }
}
