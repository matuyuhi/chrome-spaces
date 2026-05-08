import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  clearUndoStack,
  recordDeleteFolder,
  undo,
} from './undo'
import {
  createFolder,
  createSpace,
  dropTab,
  registerTab,
  switchTo,
  moveItem,
} from './space-manager'
import { loadStore } from './storage'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('undo performance', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
    clearUndoStack()

    // Clear the original mock completely to replace it
    mock.tabs.create = vi.fn().mockImplementation(async (opts: chrome.tabs.CreateProperties) => {
      await new Promise(r => setTimeout(r, 10)) // 10ms network/IPC delay per tab
      const id = Math.floor(Math.random() * 1000000)
      const tab = { id, windowId: opts.windowId ?? 1, groupId: -1, active: opts.active ?? false, hidden: false, url: opts.url }
      mock.tabs.set(id, tab)
      return tab as unknown as chrome.tabs.Tab
    })
  })

  it('undo delete folder with many tabs', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 100 })
    await switchTo(space.id, 100)
    const store = await loadStore()
    const rootFolderId = space.rootFolderId
    const folder = await createFolder({ parentFolderId: rootFolderId, name: 'bench' })
    const fId = folder.id

    // Add 20 tabs
    for (let i = 0; i < 20; i++) {
      const t = await chrome.tabs.create({ windowId: 100, url: `https://test${i}.com` })
      await registerTab(t)
      await moveItem({ item: { kind: 'tab', tabId: t.id! }, toFolderId: fId, toIndex: 0 })
    }

    // Delete folder
    await recordDeleteFolder(fId, true, 100) // closeTabs: true

    // Simulate delete with closeTabs=true.
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      delete s.folders[fId]
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'folder' && it.folderId === fId))
      }
    })

    const start = Date.now()
    await undo(100)
    const end = Date.now()

    const duration = end - start
    console.log(`Undo delete folder with 20 tabs took ${duration}ms`)

    // With sequential creation (20 tabs * 10ms = ~200ms)
    // With parallel creation, it should be closer to 10ms
  })
})
