import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncLiveFolder } from './sync-engine'
import {
  createFolder,
  createSpace,
  switchTo,
} from '../space-manager'
import { onTabCreated } from '../handlers'
import { setGitHubToken } from '../secret-storage'
import { loadStore } from '../storage'
import { setupChromeMock, type ChromeMock } from '../test-utils'

function searchResponse(
  items: { repo: string; number: number }[],
  etag?: string,
): Response {
  const headers: Record<string, string> = {}
  if (etag) headers.ETag = etag
  return new Response(
    JSON.stringify({
      total_count: items.length,
      incomplete_results: false,
      items: items.map((i) => ({
        html_url: `https://github.com/${i.repo}/pull/${i.number}`,
        title: `PR ${i.number}`,
        number: i.number,
        state: 'open',
        draft: false,
        updated_at: '2026-01-01T00:00:00Z',
      })),
    }),
    { status: 200, headers },
  )
}

describe('syncLiveFolder', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('places synced tabs in the live folder, not in the active Space', async () => {
    await setGitHubToken('ghp_test')
    const space = await createSpace({ name: 'Work', color: 'red', windowId: 1 })
    await switchTo(space.id, 1)
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Reviews',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 0,
      },
    })

    // Reproduce the chrome.tabs.onCreated → registerTab race that previously
    // double-claimed each new tab into the active Space's root folder.
    const original = chrome.tabs.create
    chrome.tabs.create = (async (props: chrome.tabs.CreateProperties) => {
      const tab = await original(props)
      void onTabCreated(tab)
      return tab
    }) as typeof chrome.tabs.create

    const fakeFetch = vi.fn(async () =>
      searchResponse([{ repo: 'a/b', number: 1 }, { repo: 'a/b', number: 2 }]),
    )
    await syncLiveFolder(live.id, fakeFetch as unknown as typeof fetch)

    chrome.tabs.create = original

    const store = await loadStore()
    const liveFolder = store.folders[live.id]!
    const root = store.folders[space.rootFolderId]!

    expect(liveFolder.items.map((it) => (it.kind === 'tab' ? it.tabId : null))).toEqual(
      liveFolder.live!.managedTabs.map((m) => m.tabId),
    )
    // Each synced tab should appear in the Live folder ONLY, not also in
    // the Space root.
    for (const m of liveFolder.live!.managedTabs) {
      expect(root.items.some((it) => it.kind === 'tab' && it.tabId === m.tabId)).toBe(false)
    }
  })

  it('records GitHub errors from the API', async () => {
    await setGitHubToken('bad')
    const space = await createSpace({ name: 'X', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Bad',
      live: {
        source: { type: 'github-prs', preset: 'authored' },
        refreshIntervalMin: 0,
      },
    })
    const fakeFetch = vi.fn(
      async () => new Response('Bad credentials', { status: 401 }),
    )
    await syncLiveFolder(live.id, fakeFetch as unknown as typeof fetch)
    const after = (await loadStore()).folders[live.id]
    expect(after?.live?.lastSyncError).toMatch(/401/)
  })

  it('persists ETag and short-circuits on 304', async () => {
    await setGitHubToken('ghp_test')
    const space = await createSpace({ name: 'E', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Reviews',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 0,
      },
    })

    const fakeFetch = vi.fn<typeof fetch>()
    fakeFetch.mockResolvedValueOnce(searchResponse([{ repo: 'a/b', number: 1 }], 'W/"v1"'))
    fakeFetch.mockResolvedValueOnce(new Response(null, { status: 304 }))

    await syncLiveFolder(live.id, fakeFetch)
    const afterFirst = (await loadStore()).folders[live.id]
    expect(afterFirst?.live?.etag).toBe('W/"v1"')
    expect(afterFirst?.live?.managedTabs).toHaveLength(1)
    const tabsBefore = mock.tabs.size

    await syncLiveFolder(live.id, fakeFetch)
    const afterSecond = (await loadStore()).folders[live.id]
    expect(afterSecond?.live?.etag).toBe('W/"v1"')
    expect(afterSecond?.live?.managedTabs).toHaveLength(1)
    expect(afterSecond?.live?.lastSyncError).toBeUndefined()
    // No tab churn on 304.
    expect(mock.tabs.size).toBe(tabsBefore)
    // Second call must include If-None-Match.
    const secondCall = fakeFetch.mock.calls[1]! as unknown as [string, RequestInit]
    const secondHeaders = secondCall[1].headers as Record<string, string>
    expect(secondHeaders['If-None-Match']).toBe('W/"v1"')
  })

  it('removes managed tabs that disappeared from the result set', async () => {
    await setGitHubToken('ghp_test')
    const space = await createSpace({ name: 'S', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Reviews',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 0,
      },
    })

    let seq = 0
    const fakeFetch = vi.fn(async () => {
      seq++
      return seq === 1
        ? searchResponse([{ repo: 'a/b', number: 1 }, { repo: 'a/b', number: 2 }])
        : searchResponse([{ repo: 'a/b', number: 1 }])
    })
    await syncLiveFolder(live.id, fakeFetch as unknown as typeof fetch)
    await syncLiveFolder(live.id, fakeFetch as unknown as typeof fetch)

    const final = (await loadStore()).folders[live.id]
    expect(final?.live?.managedTabs.map((m) => m.externalId)).toEqual(['a/b#1'])
    // Mock state: the second tab should be removed.
    const surviving = [...mock.tabs.values()]
    expect(surviving).toHaveLength(1)
  })
})
