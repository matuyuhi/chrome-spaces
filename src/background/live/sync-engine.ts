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
    await applyDiff(folder, result.items)
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

async function applyDiff(folder: Folder, items: LiveItem[]): Promise<void> {
  if (!folder.live) return
  const result = diff(folder.live.managedTabs, items)

  // Disappeared upstream: if a managedTab had been materialized into a
  // real Chrome tab, close it. Unmaterialized entries just vanish.
  const removedTabIds = result.toRemove
    .map((t) => t.tabId)
    .filter((id): id is number => typeof id === 'number')
  if (removedTabIds.length > 0) {
    try {
      await chrome.tabs.remove(removedTabIds)
    } catch {
      /* tab(s) may already be gone */
    }
  }

  // Carry materialized tabId forward for items still present, refresh
  // url/title from upstream. New items start unmaterialized.
  const finalManaged: ManagedTab[] = [
    ...result.toKeep.map(({ managed, fetched }) => ({
      ...managed,
      url: fetched.url,
      title: fetched.title ?? managed.title,
    })),
    ...result.toAdd.map((item) => ({
      externalId: item.externalId,
      url: item.url,
      title: item.title,
      addedAt: now(),
    })),
  ]

  // starterTabId is a v2 leftover (anchor tab so the live folder was
  // visible in the strip). With link rendering the folder is always
  // visible, so close any lingering anchor.
  const starterToClose = folder.live.starterTabId
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
    // Sync the folder's items list with managedTabs. Live folders own
    // their items deterministically — kind:'live' refs by externalId.
    f.items = finalManaged.map((m) => ({
      kind: 'live' as const,
      externalId: m.externalId,
    }))
    for (const id of removedTabIds) delete s.tabs[id]
  })
}

function formatError(err: unknown): string {
  if (err instanceof SourceError)
    return `[${err.status}] ${err.message.slice(0, 200)}`
  if (err instanceof Error) return err.message
  return String(err)
}
