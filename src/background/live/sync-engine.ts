import {
  type LiveSpace,
  type ManagedTab,
  type SpaceId,
  isLive,
  TAB_GROUP_ID_NONE,
} from '../../shared/types'
import { loadStore, updateStore } from '../storage'
import { getGitHubToken } from '../secret-storage'
import { createTabInExistingGroup } from '../inflight'
import { fetchSearchResults, GitHubError, type ItemRef } from './sources/github'
import { diff } from './diff'

const now = (): number => Date.now()

export async function syncLiveSpace(
  spaceId: SpaceId,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const initial = (await loadStore()).spaces[spaceId]
  if (!initial || !isLive(initial)) return

  try {
    const items = await fetchItems(initial, fetchImpl)
    await applyDiff(initial, items)
    await updateStore((s) => {
      const sp = s.spaces[spaceId]
      if (sp && isLive(sp)) {
        sp.lastSyncAt = now()
        sp.lastSyncError = undefined
      }
    })
  } catch (err) {
    const message = formatError(err)
    await updateStore((s) => {
      const sp = s.spaces[spaceId]
      if (sp && isLive(sp)) {
        sp.lastSyncError = message
        sp.lastSyncAt = now()
      }
    })
  }
}

async function fetchItems(space: LiveSpace, fetchImpl: typeof fetch): Promise<ItemRef[]> {
  if (space.source.type === 'github-prs' || space.source.type === 'github-issues') {
    const token = await getGitHubToken()
    if (!token) throw new Error('GitHub token not configured. Open Spaces popup → Settings → paste a PAT.')
    return fetchSearchResults(space.source, token, fetchImpl)
  }
  throw new Error(`Unsupported live source: ${(space.source as { type: string }).type}`)
}

async function applyDiff(space: LiveSpace, items: ItemRef[]): Promise<void> {
  if (space.groupId === TAB_GROUP_ID_NONE) return // group is gone; reconcile will handle

  const result = diff(space.managedTabs, items)

  const created: ManagedTab[] = []
  for (const item of result.toAdd) {
    try {
      // createTabInExistingGroup pauses onTabCreated auto-grouping for the
      // create+group window so the tab cannot be hijacked into whatever
      // Space happens to be active in this window.
      const tab = await createTabInExistingGroup(
        { url: item.url, windowId: space.windowId, active: false },
        space.groupId,
      )
      if (!tab || typeof tab.id !== 'number') continue
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

  // Clean up the seed tab once we have real managed tabs.
  let starterToClose: number | undefined
  if (space.starterTabId !== undefined && finalManaged.length > 0) {
    starterToClose = space.starterTabId
  }

  if (starterToClose !== undefined) {
    try {
      await chrome.tabs.remove(starterToClose)
    } catch {
      /* already gone */
    }
  }

  await updateStore((s) => {
    const sp = s.spaces[space.id]
    if (!sp || !isLive(sp)) return
    sp.managedTabs = finalManaged
    if (starterToClose !== undefined) sp.starterTabId = undefined
  })
}

function formatError(err: unknown): string {
  if (err instanceof GitHubError) return `GitHub ${err.status}: ${err.message.slice(0, 200)}`
  if (err instanceof Error) return err.message
  return String(err)
}
