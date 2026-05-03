import { describe, it, expect, beforeEach } from 'vitest'
import {
  createFolder,
  createSpace,
  deleteFolder,
  deleteSpace,
  dropTab,
  getActiveSpace,
  listSpaces,
  moveItem,
  pinTab,
  registerTab,
  resetTabToBase,
  resolveBaseUrl,
  switchTo,
  unpinTab,
  updateLiveFolder,
} from './space-manager'
import { loadStore } from './storage'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('space-manager (v2)', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('createSpace creates an empty Space with a root folder', async () => {
    const space = await createSpace({ name: 'Work', color: 'blue', windowId: 1 })
    expect(space.name).toBe('Work')
    const store = await loadStore()
    expect(store.folders[space.rootFolderId]?.items).toEqual([])
  })

  it('createSpace can adopt existing tab ids into the root folder', async () => {
    const t1 = await chrome.tabs.create({ windowId: 1 })
    const t2 = await chrome.tabs.create({ windowId: 1 })
    const space = await createSpace({
      name: 'Adopt',
      color: 'red',
      windowId: 1,
      initialTabIds: [t1.id!, t2.id!],
    })
    const store = await loadStore()
    const root = store.folders[space.rootFolderId]
    expect(root?.items).toEqual([
      { kind: 'tab', tabId: t1.id! },
      { kind: 'tab', tabId: t2.id! },
    ])
    expect(store.tabs[t1.id!]).toBeDefined()
    expect(store.tabs[t2.id!]).toBeDefined()
  })

  it('registerTab appends new tabs to the active Space', async () => {
    const space = await createSpace({ name: 'Active', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1) // makes it active
    const tab = await chrome.tabs.create({ windowId: 1 })
    await registerTab(tab)
    const store = await loadStore()
    const root = store.folders[space.rootFolderId]
    expect(root?.items.some((it) => it.kind === 'tab' && it.tabId === tab.id)).toBe(true)
  })

  it('switchTo hides other Spaces tabs and shows the target tabs', async () => {
    const a = await createSpace({ name: 'A', color: 'red', windowId: 1 })
    const t1 = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t1)
    await switchTo(a.id, 1)

    const b = await createSpace({ name: 'B', color: 'blue', windowId: 1 })
    // Switch to B: A's tabs should hide; B has none so a starter tab is created.
    await switchTo(b.id, 1)
    expect(mock.tabs.get(t1.id!)?.hidden).toBe(true)
  })

  it('deleteSpace optionally closes its tabs', async () => {
    const t1 = await chrome.tabs.create({ windowId: 1 })
    const space = await createSpace({
      name: 'Doomed',
      color: 'grey',
      windowId: 1,
      initialTabIds: [t1.id!],
    })
    await deleteSpace(space.id, { closeTabs: true })
    expect(mock.tabs.has(t1.id!)).toBe(false)
    expect(await listSpaces(1)).toHaveLength(0)
  })

  it('createFolder appends a new folder under a parent', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const f = await createFolder({ parentFolderId: space.rootFolderId, name: 'Sub' })
    const store = await loadStore()
    expect(store.folders[f.id]).toBeDefined()
    expect(store.folders[space.rootFolderId]?.items).toEqual([
      { kind: 'folder', folderId: f.id },
    ])
  })

  it('createFolder with live config schedules an alarm when interval > 0', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const f = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'PRs',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 5,
      },
    })
    expect(mock.alarms.has(`live-folder:${f.id}`)).toBe(true)
  })

  it('createFolder with refreshIntervalMin = 0 does not schedule an alarm', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const f = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'PRs manual',
      live: {
        source: { type: 'github-prs', preset: 'authored' },
        refreshIntervalMin: 0,
      },
    })
    expect(mock.alarms.has(`live-folder:${f.id}`)).toBe(false)
  })

  it('updateLiveFolder re-schedules when the interval changes', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const f = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'L',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 5,
      },
    })
    await updateLiveFolder(f.id, { refreshIntervalMin: 10 })
    expect(mock.alarms.get(`live-folder:${f.id}`)?.periodInMinutes).toBe(10)
  })

  it('deleteFolder refuses to remove a Space root', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await expect(
      deleteFolder(space.rootFolderId, { closeTabs: false }),
    ).rejects.toThrow(/root folder/)
  })

  it('moveItem rejects dropping into a Live folder', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const t = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t)
    await switchTo(space.id, 1)
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'PRs',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 0,
      },
    })
    const before = await loadStore()
    const beforeRoot = before.folders[space.rootFolderId]?.items
    await moveItem({
      item: { kind: 'tab', tabId: t.id! },
      toFolderId: live.id,
      toIndex: 0,
    })
    const after = await loadStore()
    // Live folder still empty, tab still in root.
    expect(after.folders[live.id]?.items).toEqual([])
    expect(after.folders[space.rootFolderId]?.items).toEqual(beforeRoot)
  })

  it('moveItem rejects moving a folder into its own descendant', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const outer = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Outer',
    })
    const inner = await createFolder({ parentFolderId: outer.id, name: 'Inner' })
    await moveItem({
      item: { kind: 'folder', folderId: outer.id },
      toFolderId: inner.id,
      toIndex: 0,
    })
    const store = await loadStore()
    // Outer should still be in space root, inner still in outer.
    expect(
      store.folders[space.rootFolderId]?.items.some(
        (it) => it.kind === 'folder' && it.folderId === outer.id,
      ),
    ).toBe(true)
    expect(
      store.folders[outer.id]?.items.some(
        (it) => it.kind === 'folder' && it.folderId === inner.id,
      ),
    ).toBe(true)
  })

  it('moveItem moves a tab between folders', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const t = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t)
    await switchTo(space.id, 1) // makes it active so registerTab places it in root
    const f = await createFolder({ parentFolderId: space.rootFolderId, name: 'Sub' })
    await moveItem({
      item: { kind: 'tab', tabId: t.id! },
      toFolderId: f.id,
      toIndex: 0,
    })
    const store = await loadStore()
    expect(store.folders[f.id]?.items).toEqual([{ kind: 'tab', tabId: t.id! }])
    expect(
      store.folders[space.rootFolderId]?.items.some(
        (i) => i.kind === 'tab' && i.tabId === t.id!,
      ),
    ).toBe(false)
  })

  it('pinTab / resetTabToBase work for a tracked tab', async () => {
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://example.com/a' })
    await registerTab(t)
    await pinTab(t.id!, 'https://example.com/home')
    expect(await resolveBaseUrl(t.id!)).toBe('https://example.com/home')
    await chrome.tabs.update(t.id!, { url: 'https://example.com/deep' })
    await resetTabToBase(t.id!)
    expect(mock.tabs.get(t.id!)?.url).toBe('https://example.com/home')
    await unpinTab(t.id!)
    expect(await resolveBaseUrl(t.id!)).toBeUndefined()
  })

  it('dropTab removes the tab from every folder and the tabs map', async () => {
    const t = await chrome.tabs.create({ windowId: 1 })
    const space = await createSpace({
      name: 'X',
      color: 'red',
      windowId: 1,
      initialTabIds: [t.id!],
    })
    await dropTab(t.id!)
    const store = await loadStore()
    expect(store.tabs[t.id!]).toBeUndefined()
    expect(store.folders[space.rootFolderId]?.items).toEqual([])
  })

  it('getActiveSpace tracks switchTo', async () => {
    const a = await createSpace({ name: 'A', color: 'red', windowId: 1 })
    const b = await createSpace({ name: 'B', color: 'blue', windowId: 1 })
    await switchTo(a.id, 1)
    expect((await getActiveSpace(1))?.id).toBe(a.id)
    await switchTo(b.id, 1)
    expect((await getActiveSpace(1))?.id).toBe(b.id)
  })
})
