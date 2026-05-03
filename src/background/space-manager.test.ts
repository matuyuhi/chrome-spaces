import { describe, it, expect, beforeEach } from 'vitest'
import {
  createLiveSpace,
  createStaticSpace,
  createStaticSpaceFromTabs,
  dropPinForTab,
  switchTo,
  listSpaces,
  deleteSpace,
  pinTab,
  reconcilePinnedTabs,
  renameSpace,
  resetTabToBase,
  resolveBaseUrl,
  setSpaceColor,
  findSpaceByGroupId,
  reorderSpaces,
  getActiveSpace,
  unpinTab,
  updateLiveSpace,
} from './space-manager'
import { isLive } from '../shared/types'
import { updateStore } from './storage'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('space-manager', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('creates a static space backed by a Tab Group with a starter tab', async () => {
    const space = await createStaticSpace({ name: 'Work', color: 'blue', windowId: 1 })
    expect(space.name).toBe('Work')
    expect(space.kind).toBe('static')
    expect(mock.groups.get(space.groupId)?.title).toBe('Work')
    expect(mock.groups.get(space.groupId)?.color).toBe('blue')
    const groupTabs = [...mock.tabs.values()].filter((t) => t.groupId === space.groupId)
    expect(groupTabs).toHaveLength(1)
  })

  it('orders spaces by creation order in the same window', async () => {
    const a = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const b = await createStaticSpace({ name: 'B', color: 'blue', windowId: 1 })
    const c = await createStaticSpace({ name: 'C', color: 'green', windowId: 1 })
    const list = await listSpaces(1)
    expect(list.map((s) => s.id)).toEqual([a.id, b.id, c.id])
  })

  it('switchTo collapses other groups and expands target', async () => {
    const a = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const b = await createStaticSpace({ name: 'B', color: 'blue', windowId: 1 })
    await switchTo(a.id)
    expect(mock.groups.get(a.groupId)?.collapsed).toBe(false)
    expect(mock.groups.get(b.groupId)?.collapsed).toBe(true)
    await switchTo(b.id)
    expect(mock.groups.get(a.groupId)?.collapsed).toBe(true)
    expect(mock.groups.get(b.groupId)?.collapsed).toBe(false)
    expect((await getActiveSpace(1))?.id).toBe(b.id)
  })

  it('switchTo only affects the target window', async () => {
    const win1 = await createStaticSpace({ name: 'W1', color: 'red', windowId: 1 })
    const win2 = await createStaticSpace({ name: 'W2', color: 'blue', windowId: 2 })
    await switchTo(win1.id)
    expect(mock.groups.get(win2.groupId)?.collapsed).toBe(false)
  })

  it('rename updates store and tab group title', async () => {
    const s = await createStaticSpace({ name: 'Old', color: 'red', windowId: 1 })
    await renameSpace(s.id, 'New')
    expect(mock.groups.get(s.groupId)?.title).toBe('New')
    const list = await listSpaces(1)
    expect(list[0]?.name).toBe('New')
  })

  it('setSpaceColor updates store and tab group color', async () => {
    const s = await createStaticSpace({ name: 'X', color: 'red', windowId: 1 })
    await setSpaceColor(s.id, 'cyan')
    expect(mock.groups.get(s.groupId)?.color).toBe('cyan')
  })

  it('deleteSpace removes the space and (optionally) its tabs', async () => {
    const s = await createStaticSpace({ name: 'Doomed', color: 'grey', windowId: 1 })
    const groupId = s.groupId
    expect([...mock.tabs.values()].filter((t) => t.groupId === groupId)).toHaveLength(1)
    await deleteSpace(s.id, { closeTabs: true })
    expect([...mock.tabs.values()].filter((t) => t.groupId === groupId)).toHaveLength(0)
    expect(await listSpaces(1)).toHaveLength(0)
  })

  it('findSpaceByGroupId resolves the right space', async () => {
    const a = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const b = await createStaticSpace({ name: 'B', color: 'blue', windowId: 1 })
    expect((await findSpaceByGroupId(a.groupId))?.id).toBe(a.id)
    expect((await findSpaceByGroupId(b.groupId))?.id).toBe(b.id)
  })

  it('reorderSpaces persists the new order', async () => {
    const a = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const b = await createStaticSpace({ name: 'B', color: 'blue', windowId: 1 })
    const c = await createStaticSpace({ name: 'C', color: 'green', windowId: 1 })
    await reorderSpaces(1, [c.id, a.id, b.id])
    const list = await listSpaces(1)
    expect(list.map((s) => s.id)).toEqual([c.id, a.id, b.id])
  })

  it('createStaticSpaceFromTabs groups every ungrouped tab in the window', async () => {
    const t1 = await chrome.tabs.create({ windowId: 1 })
    const t2 = await chrome.tabs.create({ windowId: 1 })
    const t3 = await chrome.tabs.create({ windowId: 1 })
    // A tab in another window should not be captured.
    const otherWin = await chrome.tabs.create({ windowId: 2 })

    const space = await createStaticSpaceFromTabs({
      name: 'Captured',
      color: 'cyan',
      windowId: 1,
    })

    expect(space.kind).toBe('static')
    expect(mock.tabs.get(t1.id!)?.groupId).toBe(space.groupId)
    expect(mock.tabs.get(t2.id!)?.groupId).toBe(space.groupId)
    expect(mock.tabs.get(t3.id!)?.groupId).toBe(space.groupId)
    expect(mock.tabs.get(otherWin.id!)?.groupId).toBe(-1)
    expect(mock.groups.get(space.groupId)?.title).toBe('Captured')
  })

  it('createStaticSpaceFromTabs throws when no ungrouped tabs exist', async () => {
    // Pre-grouped tab + same-window's only-grouped state
    const t = await chrome.tabs.create({ windowId: 1 })
    await chrome.tabs.group({ createProperties: { windowId: 1 }, tabIds: [t.id!] })

    await expect(
      createStaticSpaceFromTabs({ name: 'X', color: 'blue', windowId: 1 }),
    ).rejects.toThrow('No ungrouped tabs')
  })

  it('pinTab persists base URL on the tab\'s Space', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1 })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    await pinTab(tab.id!, 'https://example.com/home')
    const stored = (await listSpaces(1))[0]
    expect(stored?.pinnedTabs?.[tab.id!]).toBe('https://example.com/home')
  })

  it('resolveBaseUrl prefers managedTab.url over pinnedTabs', async () => {
    const live = await createLiveSpace({
      name: 'PRs',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
      refreshIntervalMin: 5,
    })
    // Inject a managed tab manually (bypassing sync) for the test.
    const managedTabId = 999
    await updateStore((s) => {
      const sp = s.spaces[live.id]
      if (sp && sp.kind === 'live') {
        sp.managedTabs = [
          {
            externalId: 'a/b#1',
            url: 'https://github.com/a/b/pull/1',
            tabId: managedTabId,
            addedAt: 0,
          },
        ]
        sp.pinnedTabs = { [managedTabId]: 'https://example.com/override' }
      }
    })
    expect(await resolveBaseUrl(managedTabId)).toBe('https://github.com/a/b/pull/1')
  })

  it('resetTabToBase navigates the tab back to its base URL', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1, url: 'https://example.com/page' })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    await pinTab(tab.id!, 'https://example.com/home')
    // Simulate the user navigating away.
    await chrome.tabs.update(tab.id!, { url: 'https://example.com/page/deep' })
    const ok = await resetTabToBase(tab.id!)
    expect(ok).toBe(true)
    expect(mock.tabs.get(tab.id!)?.url).toBe('https://example.com/home')
  })

  it('resetTabToBase returns false when no base URL is known', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1 })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    expect(await resetTabToBase(tab.id!)).toBe(false)
  })

  it('unpinTab removes the entry and clears the field when empty', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1 })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    await pinTab(tab.id!, 'https://example.com/home')
    await unpinTab(tab.id!)
    expect((await listSpaces(1))[0]?.pinnedTabs).toBeUndefined()
  })

  it('dropPinForTab handles an already-unpinned tab without writes', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1 })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    await dropPinForTab(tab.id!) // no-op, must not throw
    expect((await listSpaces(1))[0]?.pinnedTabs).toBeUndefined()
  })

  it('reconcilePinnedTabs drops entries for tabs that no longer exist', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1 })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    await pinTab(tab.id!, 'https://example.com/home')
    // Pretend the tab vanished without firing onRemoved.
    mock.tabs.delete(tab.id!)
    await reconcilePinnedTabs()
    expect((await listSpaces(1))[0]?.pinnedTabs).toBeUndefined()
  })

  it('switchTo rehydrates a Space whose Tab Group was removed externally', async () => {
    const space = await createStaticSpace({ name: 'Work', color: 'green', windowId: 1 })
    const oldGroupId = space.groupId

    // Simulate the user closing the Tab Group from Chrome's UI: tabs.onRemoved
    // fires for every tab in the group, then tabGroups.onRemoved fires.
    // Our handler marks groupId = TAB_GROUP_ID_NONE.
    await import('./handlers').then(({ onTabGroupRemoved }) =>
      onTabGroupRemoved({ id: oldGroupId, windowId: 1 } as chrome.tabGroups.TabGroup),
    )
    expect((await listSpaces(1))[0]?.groupId).toBe(-1)

    await switchTo(space.id, 1)

    const revived = (await listSpaces(1))[0]
    expect(revived?.groupId).not.toBe(-1)
    expect(revived?.groupId).not.toBe(oldGroupId)
    expect(mock.groups.get(revived!.groupId)?.title).toBe('Work')
    expect(mock.groups.get(revived!.groupId)?.color).toBe('green')
  })

  it('rehydrate clears pinnedTabs that referenced the dead group', async () => {
    const space = await createStaticSpace({ name: 'Work', color: 'green', windowId: 1 })
    const tab = await chrome.tabs.create({ windowId: 1, url: 'https://example.com/' })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })
    await pinTab(tab.id!, 'https://example.com/home')
    expect((await listSpaces(1))[0]?.pinnedTabs?.[tab.id!]).toBe('https://example.com/home')

    await import('./handlers').then(({ onTabGroupRemoved }) =>
      onTabGroupRemoved({ id: space.groupId, windowId: 1 } as chrome.tabGroups.TabGroup),
    )
    await switchTo(space.id, 1)
    expect((await listSpaces(1))[0]?.pinnedTabs).toBeUndefined()
  })

  it('updateLiveSpace replaces source and re-schedules on interval change', async () => {
    const live = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
      refreshIntervalMin: 5,
    })
    await updateLiveSpace(live.id, {
      source: { type: 'github-prs', preset: 'custom', query: 'is:pr is:open org:foo' },
      refreshIntervalMin: 15,
    })
    const updated = (await listSpaces(1))[0]
    if (!updated || !isLive(updated)) throw new Error('expected live space')
    expect(updated.refreshIntervalMin).toBe(15)
    expect(updated.source).toEqual({
      type: 'github-prs',
      preset: 'custom',
      query: 'is:pr is:open org:foo',
    })
    const alarm = mock.alarms.get(`live-space:${live.id}`)
    expect(alarm?.periodInMinutes).toBe(15)
  })
})
