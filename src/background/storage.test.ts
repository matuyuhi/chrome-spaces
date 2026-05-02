import { describe, it, expect, beforeEach } from 'vitest'
import { loadStore, saveStore, updateStore } from './storage'
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
})
