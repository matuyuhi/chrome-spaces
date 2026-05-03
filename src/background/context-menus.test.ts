import { describe, it, expect, beforeEach } from 'vitest'
import { vi } from 'vitest'
import { _ITEM_IDS, handleContextMenuClick, installContextMenus } from './context-menus'
import { createLiveSpace, createStaticSpace } from './space-manager'
import { setGitHubToken } from './secret-storage'
import { loadStore } from './storage'
import { isLive } from '../shared/types'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('context-menus', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('installContextMenus registers every item idempotently', async () => {
    await installContextMenus()
    const firstCount = mock.contextMenuItems.size
    expect(firstCount).toBeGreaterThan(0)
    await installContextMenus()
    expect(mock.contextMenuItems.size).toBe(firstCount)
  })

  it('Pin click writes the tab URL into the Space record', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({
      windowId: 1,
      url: 'https://example.com/home',
    })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })

    await handleContextMenuClick(
      { menuItemId: _ITEM_IDS.ITEM_PIN } as chrome.contextMenus.OnClickData,
      tab,
    )

    const stored = (await loadStore()).spaces[space.id]
    expect(stored?.pinnedTabs?.[tab.id!]).toBe('https://example.com/home')
  })

  it('Reset click navigates the tab back to its base URL', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({
      windowId: 1,
      url: 'https://example.com/home',
    })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })

    await handleContextMenuClick(
      { menuItemId: _ITEM_IDS.ITEM_PIN } as chrome.contextMenus.OnClickData,
      tab,
    )
    await chrome.tabs.update(tab.id!, { url: 'https://example.com/page/x' })

    await handleContextMenuClick(
      { menuItemId: _ITEM_IDS.ITEM_RESET } as chrome.contextMenus.OnClickData,
      { ...tab, url: 'https://example.com/page/x' },
    )

    expect(mock.tabs.get(tab.id!)?.url).toBe('https://example.com/home')
  })

  it('Sync-live click triggers a sync for the live folder containing the tab', async () => {
    await setGitHubToken('ghp_test')
    const live = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
    })

    // Stub global fetch (used by sync-engine via the default fetchImpl).
    const stubResponse = new Response(
      JSON.stringify({
        total_count: 1,
        incomplete_results: false,
        items: [
          {
            html_url: 'https://github.com/octo/repo/pull/1',
            title: 'PR',
            number: 1,
            state: 'open',
            draft: false,
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      }),
      { status: 200 },
    )
    const fetchSpy = vi.fn(async () => stubResponse.clone())
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    try {
      // Simulate right-click on a tab inside the live folder.
      const liveTab = { id: live.starterTabId, groupId: live.groupId, windowId: 1 } as chrome.tabs.Tab
      await handleContextMenuClick(
        { menuItemId: _ITEM_IDS.ITEM_SYNC_LIVE } as chrome.contextMenus.OnClickData,
        liveTab,
      )
    } finally {
      globalThis.fetch = originalFetch
    }

    expect(fetchSpy).toHaveBeenCalledOnce()
    const after = (await loadStore()).spaces[live.id]
    if (after && isLive(after)) {
      expect(after.managedTabs.map((t) => t.externalId)).toEqual(['octo/repo#1'])
    }
  })

  it('Sync-live click on a tab outside any live folder is a no-op', async () => {
    const staticSpace = await createStaticSpace({ name: 'S', color: 'red', windowId: 1 })
    const fetchSpy = vi.fn()
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      await handleContextMenuClick(
        { menuItemId: _ITEM_IDS.ITEM_SYNC_LIVE } as chrome.contextMenus.OnClickData,
        { id: 999, groupId: staticSpace.groupId, windowId: 1 } as chrome.tabs.Tab,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
