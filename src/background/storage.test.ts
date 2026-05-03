import { describe, it, expect, beforeEach } from 'vitest'
import { loadStore, migrateIfNeeded, saveStore, updateStore } from './storage'
import { CURRENT_SCHEMA_VERSION, emptyStore } from '../shared/types'
import { setupChromeMock } from './test-utils'

describe('storage', () => {
  beforeEach(() => setupChromeMock())

  it('returns empty store when nothing is persisted', async () => {
    expect(await loadStore()).toEqual(emptyStore())
  })

  it('round-trips a store', async () => {
    const store = emptyStore()
    store.activeSpaceByWindow[1] = 'a'
    await saveStore(store)
    expect(await loadStore()).toEqual(store)
  })

  it('updateStore applies a mutating callback and persists', async () => {
    const result = await updateStore((s) => {
      s.activeSpaceByWindow[42] = 'foo'
    })
    expect(result.activeSpaceByWindow[42]).toBe('foo')
    expect((await loadStore()).activeSpaceByWindow[42]).toBe('foo')
  })

  it('updateStore accepts a callback that returns a fresh store', async () => {
    await updateStore(() => {
      const next = emptyStore()
      next.activeSpaceByWindow[7] = 'bar'
      return next
    })
    expect((await loadStore()).activeSpaceByWindow[7]).toBe('bar')
  })

  it('migrates older schema versions on load', async () => {
    await chrome.storage.sync.set({
      spaceStore: { spaces: {}, activeSpaceByWindow: {}, schemaVersion: 0 },
    })
    const loaded = await loadStore()
    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('migrates v2 → v3: live folder items become kind:"live" refs', async () => {
    // Hand-craft a v2 store with kind:'tab' items inside a live folder.
    const v2Store = {
      schemaVersion: 2,
      activeSpaceByWindow: { 1: 'sp1' },
      spaces: {
        sp1: {
          id: 'sp1',
          name: 'S',
          color: 'red',
          windowId: 1,
          order: 0,
          rootFolderId: 'r1',
          createdAt: 0,
          lastAccessedAt: 0,
        },
      },
      folders: {
        r1: {
          id: 'r1',
          name: 'S',
          collapsed: false,
          items: [{ kind: 'folder', folderId: 'live1' }],
        },
        live1: {
          id: 'live1',
          name: 'Reviews',
          collapsed: false,
          items: [
            { kind: 'tab', tabId: 100 },
            { kind: 'tab', tabId: 200 },
          ],
          live: {
            source: { type: 'github-prs', preset: 'review-requested' },
            refreshIntervalMin: 0,
            managedTabs: [
              {
                externalId: 'a/b#1',
                url: 'https://github.com/a/b/pull/1',
                tabId: 100,
                addedAt: 0,
              },
              {
                externalId: 'a/b#2',
                url: 'https://github.com/a/b/pull/2',
                tabId: 200,
                addedAt: 0,
              },
            ],
          },
        },
      },
      tabs: {
        100: { tabId: 100, windowId: 1 },
        200: { tabId: 200, windowId: 1 },
      },
    }
    await chrome.storage.local.set({ spaceStore: v2Store })
    await migrateIfNeeded()
    const after = await loadStore()
    expect(after.schemaVersion).toBe(3)
    const live = after.folders.live1!
    expect(live.items).toEqual([
      { kind: 'live', externalId: 'a/b#1' },
      { kind: 'live', externalId: 'a/b#2' },
    ])
    // Materialized tabIds carry forward so users keep their open tabs.
    expect(live.live!.managedTabs.map((m) => m.tabId)).toEqual([100, 200])
  })
})
