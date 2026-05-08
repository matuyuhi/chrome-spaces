import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { reconcile, reconcileIfStale } from './reconcile'
import { createSpace, createFolder, registerTab, switchTo } from './space-manager'
import { loadStore } from './storage'
import { setupChromeMock } from './test-utils'

describe('reconcile', () => {
  beforeEach(() => {
    setupChromeMock()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing when no tabs are missing', async () => {
    await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const t1 = await chrome.tabs.create({ windowId: 1 })
    const t2 = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t1)
    await registerTab(t2)

    const result = await reconcile()
    expect(result.dropped).toBe(0)

    const store = await loadStore()
    expect(store.tabs[t1.id!]).toBeDefined()
    expect(store.tabs[t2.id!]).toBeDefined()
  })

  it('drops tabs that are in the store but no longer live', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)

    const t1 = await chrome.tabs.create({ windowId: 1 })
    const t2 = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t1)
    await registerTab(t2)

    // Put t2 into a folder to test folder items pruning
    const folder = await createFolder({ parentFolderId: space.rootFolderId, name: 'F' })
    const storeBefore = await loadStore()
    const spaceRoot = storeBefore.folders[space.rootFolderId]
    spaceRoot.items = spaceRoot.items.filter(it => !(it.kind === 'tab' && it.tabId === t2.id!))
    storeBefore.folders[folder.id].items.push({ kind: 'tab', tabId: t2.id! })
    await chrome.storage.local.set({ spaceStore: storeBefore })

    // Simulate t1 and t2 being closed without the extension intercepting
    await chrome.tabs.remove(t1.id!)
    await chrome.tabs.remove(t2.id!)

    const result = await reconcile()
    expect(result.dropped).toBe(2)

    const store = await loadStore()
    expect(store.tabs[t1.id!]).toBeUndefined()
    expect(store.tabs[t2.id!]).toBeUndefined()

    // t2 should be gone from the folder
    expect(store.folders[folder.id].items).toEqual([])

    // t1 should be gone from the root folder
    expect(store.folders[space.rootFolderId].items.filter(it => it.kind === 'tab' && it.tabId === t1.id!)).toEqual([])
  })

  describe('reconcileIfStale', () => {
    it('throttles reconcile calls within 30 seconds', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(1000000000)

      await createSpace({ name: 'S', color: 'blue', windowId: 1 })
      const t1 = await chrome.tabs.create({ windowId: 1 })
      await registerTab(t1)
      await chrome.tabs.remove(t1.id!)

      // First call should run and drop the tab
      const r1 = await reconcileIfStale()
      expect(r1.dropped).toBe(1)

      // Add another tab and remove it, but we are within the throttle window
      const t2 = await chrome.tabs.create({ windowId: 1 })
      await registerTab(t2)
      await chrome.tabs.remove(t2.id!)

      vi.setSystemTime(1000000000 + 29_000) // +29s
      const r2 = await reconcileIfStale()
      expect(r2.dropped).toBe(0) // throttled

      // Advance past the 30s window
      vi.setSystemTime(1000000000 + 31_000) // +31s
      const r3 = await reconcileIfStale()
      expect(r3.dropped).toBe(1) // runs and drops t2
    })
  })
})
