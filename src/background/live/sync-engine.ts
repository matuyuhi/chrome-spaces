import {
  type Folder,
  type FolderId,
  type ManagedTab,
  type SpaceStore,
  isLiveFolder,
} from '../../shared/types'
import { loadStore, updateStore } from '../storage'
import { dispatchFetch, type SearchResult, SourceError } from './sources'
import { type LiveItem } from './sources/types'
import { diff } from './diff'

const now = (): number => Date.now()

export async function syncLiveFolder(
  folderId: FolderId,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const store = await loadStore()
  const folder = store.folders[folderId]
  if (!folder || !isLiveFolder(folder)) return

  // The Folder must belong to a Space (find by walking from each Space's
  // root). We need the windowId for tab creation.
  let windowId: number | undefined
  for (const sp of Object.values(store.spaces)) {
    const reachable = reachableFolders(store, sp.rootFolderId)
    if (reachable.has(folderId)) {
      windowId = sp.windowId
      break
    }
  }
  if (windowId === undefined) return

  // The owning Space's window may have been closed since the alarm was
  // scheduled. Bail early with a recorded error rather than letting
  // chrome.tabs.create throw "No window with id" for every item.
  try {
    await chrome.windows.get(windowId)
  } catch {
    await updateStore((s) => {
      const f = s.folders[folderId]
      if (f && f.live) {
        f.live.lastSyncError = `Window ${windowId} is gone`
        f.live.lastSyncAt = now()
      }
    })
    return
  }

  try {
    const result = await fetchItems(folder, fetchImpl)
    if (result.notModified) {
      await updateStore((s) => {
        const f = s.folders[folderId]
        if (f && f.live) {
          f.live.lastSyncAt = now()
          f.live.lastSyncError = undefined
          // etag stays the same; nothing else to do.
        }
      })
      return
    }
    await applyDiff(folder, result.items, windowId)
    await updateStore((s) => {
      const f = s.folders[folderId]
      if (f && f.live) {
        f.live.lastSyncAt = now()
        f.live.lastSyncError = undefined
        f.live.etag = result.etag
      }
    })
  } catch (err) {
    const message = formatError(err)
    await updateStore((s) => {
      const f = s.folders[folderId]
      if (f && f.live) {
        f.live.lastSyncError = message
        f.live.lastSyncAt = now()
      }
    })
  }
}

function reachableFolders(store: SpaceStore, rootFolderId: FolderId): Set<FolderId> {
  const seen = new Set<FolderId>()
  const stack = [rootFolderId]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const f = store.folders[id]
    if (!f) continue
    for (const it of f.items) {
      if (it.kind === 'folder') stack.push(it.folderId)
    }
  }
  return seen
}

async function fetchItems(folder: Folder, fetchImpl: typeof fetch): Promise<SearchResult> {
  if (!folder.live) return { notModified: false, items: [] }
  return dispatchFetch(folder.live.source, {
    etag: folder.live.etag,
    fetch: fetchImpl,
  })
}

async function applyDiff(
  folder: Folder,
  items: LiveItem[],
  windowId: number,
): Promise<void> {
  if (!folder.live) return
  const result = diff(folder.live.managedTabs, items)

  const created: ManagedTab[] = []
  for (const item of result.toAdd) {
    try {
      const tab = await chrome.tabs.create({ url: item.url, windowId, active: false })
      if (typeof tab.id !== 'number') continue
      created.push({
        externalId: item.externalId,
        url: item.url,
        tabId: tab.id,
        addedAt: now(),
      })
    } catch (e) {
      console.error('[Spaces] failed to add live tab', item.externalId, e)
    }
  }

  if (result.toRemove.length > 0) {
    const ids = result.toRemove.map((t) => t.tabId)
    try {
      await chrome.tabs.remove(ids)
    } catch {
      /* tab(s) may already be gone */
    }
  }

  const finalManaged = [
    ...result.toKeep.map(({ managed, fetched }) => ({ ...managed, url: fetched.url })),
    ...created,
  ]

  let starterToClose: number | undefined
  if (folder.live.starterTabId !== undefined && finalManaged.length > 0) {
    starterToClose = folder.live.starterTabId
  }
  if (starterToClose !== undefined) {
    try {
      await chrome.tabs.remove(starterToClose)
    } catch {
      /* already gone */
    }
  }

  await updateStore((s) => {
    const f = s.folders[folder.id]
    if (!f || !f.live) return
    f.live.managedTabs = finalManaged
    if (starterToClose !== undefined) f.live.starterTabId = undefined
    // Sync the folder's items list with managedTabs (Live folders own
    // their items deterministically — no manual reordering inside).
    f.items = finalManaged.map((m) => ({ kind: 'tab' as const, tabId: m.tabId }))
    // chrome.tabs.onCreated may have fired between our chrome.tabs.create
    // call and this updateStore, in which case handlers.registerTab
    // already appended the new tab to the active Space's root folder.
    // Strip those tabIds from any folder that isn't this Live one so the
    // tab is owned by exactly one place.
    const claimed = new Set(finalManaged.map((m) => m.tabId))
    for (const other of Object.values(s.folders)) {
      if (other.id === folder.id) continue
      other.items = other.items.filter(
        (it) => !(it.kind === 'tab' && claimed.has(it.tabId)),
      )
    }
    // TabRecord registration for the new tabs.
    for (const m of finalManaged) {
      if (!s.tabs[m.tabId]) s.tabs[m.tabId] = { tabId: m.tabId, windowId }
    }
    for (const t of result.toRemove) delete s.tabs[t.tabId]
  })
}

function formatError(err: unknown): string {
  if (err instanceof SourceError)
    return `[${err.status}] ${err.message.slice(0, 200)}`
  if (err instanceof Error) return err.message
  return String(err)
}
