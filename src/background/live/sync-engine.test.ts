import { describe, it, expect, beforeEach, vi } from 'vitest'
import { syncLiveSpace } from './sync-engine'
import { createLiveSpace, createStaticSpace, getSpace, switchTo } from '../space-manager'
import { onTabCreated } from '../handlers'
import { setGitHubToken } from '../secret-storage'
import { isLive } from '../../shared/types'
import { setupChromeMock, type ChromeMock } from '../test-utils'

function searchResponse(items: { repo: string; number: number; title?: string }[]): Response {
  return new Response(
    JSON.stringify({
      total_count: items.length,
      incomplete_results: false,
      items: items.map((i) => ({
        html_url: `https://github.com/${i.repo}/pull/${i.number}`,
        title: i.title ?? `PR ${i.number}`,
        number: i.number,
        state: 'open',
        draft: false,
        updated_at: '2026-01-01T00:00:00Z',
      })),
    }),
    { status: 200 },
  )
}

describe('syncLiveSpace', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('adds tabs for newly fetched PRs and closes the starter tab', async () => {
    await setGitHubToken('ghp_test')
    const space = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
    })
    expect(space.starterTabId).toBeDefined()

    const fakeFetch = vi.fn(async () =>
      searchResponse([{ repo: 'octo/repo', number: 1 }, { repo: 'octo/repo', number: 2 }]),
    )

    await syncLiveSpace(space.id, fakeFetch as unknown as typeof fetch)

    const updated = await getSpace(space.id)
    expect(updated && isLive(updated)).toBe(true)
    if (updated && isLive(updated)) {
      expect(updated.managedTabs).toHaveLength(2)
      expect(updated.managedTabs.map((t) => t.externalId).sort()).toEqual([
        'octo/repo#1',
        'octo/repo#2',
      ])
      expect(updated.starterTabId).toBeUndefined()
      expect(updated.lastSyncError).toBeUndefined()
      expect(updated.lastSyncAt).toBeDefined()
    }

    // Starter tab must be gone, real tabs must be in the live group
    expect(mock.tabs.has(space.starterTabId!)).toBe(false)
    const liveTabs = [...mock.tabs.values()].filter((t) => t.groupId === space.groupId)
    expect(liveTabs).toHaveLength(2)
    // All live tabs must be unloaded so they do not pre-fetch GitHub.
    for (const t of liveTabs) {
      expect((t as { discarded?: boolean }).discarded).toBe(true)
    }
  })

  it('removes tabs for PRs no longer in the result set', async () => {
    await setGitHubToken('ghp_test')
    const space = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
    })

    let fetchSeq = 0
    const fakeFetch = vi.fn(async () => {
      fetchSeq++
      if (fetchSeq === 1) return searchResponse([{ repo: 'a/b', number: 1 }, { repo: 'a/b', number: 2 }])
      return searchResponse([{ repo: 'a/b', number: 1 }])
    })

    await syncLiveSpace(space.id, fakeFetch as unknown as typeof fetch)
    await syncLiveSpace(space.id, fakeFetch as unknown as typeof fetch)

    const final = await getSpace(space.id)
    if (final && isLive(final)) {
      expect(final.managedTabs.map((t) => t.externalId)).toEqual(['a/b#1'])
    }
    const liveTabs = [...mock.tabs.values()].filter((t) => t.groupId === space.groupId)
    expect(liveTabs).toHaveLength(1)
  })

  it('records the error when no token is configured', async () => {
    const space = await createLiveSpace({
      name: 'NoToken',
      color: 'red',
      windowId: 1,
      source: { type: 'github-prs', preset: 'assigned' },
    })
    await syncLiveSpace(space.id)
    const after = await getSpace(space.id)
    if (after && isLive(after)) {
      expect(after.lastSyncError).toMatch(/token/i)
    }
  })

  it('keeps newly synced live tabs in the live group even when a static space is active', async () => {
    // Reproduces the bug: user is on a static Space, then creates a Live
    // folder. The popup does not switch active, so the static Space stays
    // active. Without auto-grouping protection in applyDiff, the
    // chrome.tabs.onCreated handler poaches each new live tab into the
    // active static group before applyDiff's chrome.tabs.group call lands.
    await setGitHubToken('ghp_test')
    const staticSpace = await createStaticSpace({ name: 'Work', color: 'red', windowId: 1 })
    await switchTo(staticSpace.id, 1)

    const liveSpace = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
    })

    // Real chrome would dispatch onTabCreated as a side effect of tabs.create.
    // Our mock doesn't, so we wire up the handler manually around the sync
    // so the test catches a regression where applyDiff stops protecting
    // against auto-grouping.
    const originalCreate = chrome.tabs.create
    chrome.tabs.create = (async (props: chrome.tabs.CreateProperties) => {
      const tab = await originalCreate(props)
      // Fire onTabCreated synchronously like Chrome would (and like
      // background/index.ts's listener does).
      void onTabCreated(tab)
      return tab
    }) as typeof chrome.tabs.create

    const fakeFetch = vi.fn(async () =>
      searchResponse([{ repo: 'octo/repo', number: 1 }, { repo: 'octo/repo', number: 2 }]),
    )
    await syncLiveSpace(liveSpace.id, fakeFetch as unknown as typeof fetch)

    chrome.tabs.create = originalCreate

    const updated = await getSpace(liveSpace.id)
    if (!updated || !isLive(updated)) throw new Error('expected live space')
    for (const m of updated.managedTabs) {
      const tab = mock.tabs.get(m.tabId)
      expect(tab?.groupId).toBe(liveSpace.groupId)
    }
    // Static space group must not have absorbed the live tabs.
    const staticGroupTabs = [...mock.tabs.values()].filter(
      (t) => t.groupId === staticSpace.groupId,
    )
    expect(staticGroupTabs).toHaveLength(1) // just the static space's own starter
  })

  it('records GitHub errors from the API', async () => {
    await setGitHubToken('bad')
    const space = await createLiveSpace({
      name: 'Bad',
      color: 'grey',
      windowId: 1,
      source: { type: 'github-prs', preset: 'authored' },
    })
    const fakeFetch = vi.fn(async () => new Response('Bad credentials', { status: 401 }))
    await syncLiveSpace(space.id, fakeFetch as unknown as typeof fetch)
    const after = await getSpace(space.id)
    if (after && isLive(after)) {
      expect(after.lastSyncError).toMatch(/401/)
    }
  })
})
