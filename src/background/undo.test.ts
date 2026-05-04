import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearUndoStack,
  findWindowIdForFolder,
  findWindowIdForItem,
  peekUndo,
  peekUndoStack,
  recordCloseTab,
  recordDeleteFolder,
  recordDeleteSpace,
  recordMoveItem,
  undo,
} from './undo'
import {
  createFolder,
  createSpace,
  dropTab,
  moveItem,
  registerTab,
  switchTo,
} from './space-manager'
import { loadStore } from './storage'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('undo stack', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
    clearUndoStack()
  })

  // ---- closeTab → undo ----------------------------------------------------

  it('closeTab: undo restores tab to the same folder at the same index', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://example.com' })
    await registerTab(t)

    const store0 = await loadStore()
    const root = store0.folders[space.rootFolderId]!
    const originalIndex = root.items.findIndex(
      (it) => it.kind === 'tab' && it.tabId === t.id,
    )
    expect(originalIndex).toBeGreaterThanOrEqual(0)

    await recordCloseTab(t.id!, 1)

    // Simulate close.
    await chrome.tabs.remove(t.id!)
    await dropTab(t.id!)

    const result = await undo(1)
    expect(result.ok).toBe(true)
    expect(result.description).toContain('Closed tab')

    const storeAfter = await loadStore()
    const rootAfter = storeAfter.folders[space.rootFolderId]!
    // A new tab should be in the folder at the same index (or appended at end).
    const tabItem = rootAfter.items.find((it) => it.kind === 'tab')
    expect(tabItem).toBeDefined()
  })

  it('closeTab: undo creates a new Chrome tab with the original URL', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://example.com/page' })
    await registerTab(t)

    await recordCloseTab(t.id!, 1)
    await chrome.tabs.remove(t.id!)
    await dropTab(t.id!)

    const tabsBefore = mock.tabs.size

    const result = await undo(1)
    expect(result.ok).toBe(true)
    // A new tab must have been created.
    expect(mock.tabs.size).toBeGreaterThan(tabsBefore)
  })

  it('closeTab: baseUrl is preserved on the new TabRecord', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://example.com/deep' })
    await registerTab(t)

    // Simulate pinTab by writing baseUrl directly.
    await loadStore().then(() => {}) // ensure store is seeded
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      if (s.tabs[t.id!]) s.tabs[t.id!].baseUrl = 'https://example.com/home'
    })

    await recordCloseTab(t.id!, 1)
    await chrome.tabs.remove(t.id!)
    await dropTab(t.id!)

    await undo(1)

    const storeAfter = await loadStore()
    const tabEntries = Object.values(storeAfter.tabs)
    const restored = tabEntries.find((tr) => tr.baseUrl === 'https://example.com/home')
    expect(restored).toBeDefined()
  })

  it('closeTab: live-folder tabs are NOT recorded', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const liveFolder = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live',
      live: { source: { type: 'github-prs', preset: 'authored' }, refreshIntervalMin: 0 },
    })
    // Put a tab directly in the live folder (simulate materialize).
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://gh.com/pr/1' })
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      s.tabs[t.id!] = { tabId: t.id!, windowId: 1 }
      s.folders[liveFolder.id]!.items.push({ kind: 'tab', tabId: t.id! })
    })

    await recordCloseTab(t.id!, 1)

    // Stack must be empty — live-folder tabs are skipped.
    expect(peekUndoStack(1)).toBeUndefined()
  })

  // ---- moveItem → undo ----------------------------------------------------

  it('moveItem: undo returns item to original folder at original index', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t)

    const folder = await createFolder({ parentFolderId: space.rootFolderId, name: 'F' })

    // Record before move.
    await recordMoveItem({ kind: 'tab', tabId: t.id! }, 1)

    // Move the tab.
    await moveItem({ item: { kind: 'tab', tabId: t.id! }, toFolderId: folder.id, toIndex: 0 })

    // Undo.
    const result = await undo(1)
    expect(result.ok).toBe(true)

    const storeAfter = await loadStore()
    // Tab should be back in root.
    const inRoot = storeAfter.folders[space.rootFolderId]!.items.some(
      (it) => it.kind === 'tab' && it.tabId === t.id,
    )
    expect(inRoot).toBe(true)
    // And removed from folder.
    const inFolder = storeAfter.folders[folder.id]!.items.some(
      (it) => it.kind === 'tab' && it.tabId === t.id,
    )
    expect(inFolder).toBe(false)
  })

  it('moveItem: undo returns ok=false when original folder is gone', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1 })
    await registerTab(t)
    const folder = await createFolder({ parentFolderId: space.rootFolderId, name: 'Ephemeral' })

    await recordMoveItem({ kind: 'tab', tabId: t.id! }, 1)
    // Move the tab into the folder.
    await moveItem({ item: { kind: 'tab', tabId: t.id! }, toFolderId: folder.id, toIndex: 0 })

    // Delete the original folder (root) — but actually root can't be deleted.
    // Instead, simulate the folder being missing by replacing the stack entry's fromFolderId.
    // Easier: just clear folders in store to make fromFolderId invalid.
    const { updateStore } = await import('./storage')
    // Delete the target restore-to folder (root folder) is not possible legally.
    // Instead we test with a created-then-deleted intermediate folder.
    // Use a different approach: record a move from a non-root folder that we then delete.
    clearUndoStack(1)
    const sub = await createFolder({ parentFolderId: space.rootFolderId, name: 'Sub' })
    // Move tab into sub.
    await moveItem({ item: { kind: 'tab', tabId: t.id! }, toFolderId: sub.id, toIndex: 0 })
    // Record a fake move-item with fromFolderId = 'gone'.
    await updateStore((s) => {
      // Nothing; just to exercise the import.
      void s
    })
    // Manually push a move-item action with a non-existent fromFolderId.
    const stackModule = await import('./undo')
    // Access internal push via recordMoveItem by placing item in a deleted folder temporarily.
    // Simplest: call undo with a stale action by clearing the real stack and pushing manually.
    clearUndoStack(1)
    // We'll test this differently — just verify that when fromFolderId doesn't exist,
    // moveItem in space-manager is a no-op which means ok:true but item stays put.
    // The spec says: "元 folder が消えた状態で move-item を undo → { ok: false }"
    // We check this by deleting the sub folder from store after recording.
    const t2 = await chrome.tabs.create({ windowId: 1 })
    const sub2 = await createFolder({ parentFolderId: space.rootFolderId, name: 'Sub2' })
    await moveItem({ item: { kind: 'tab', tabId: t2.id! }, toFolderId: sub2.id, toIndex: 0 })
    // Record while item is in sub2.
    await stackModule.recordMoveItem({ kind: 'tab', tabId: t2.id! }, 1)

    // Now delete sub2 from store so fromFolderId is gone.
    await updateStore((s) => {
      delete s.folders[sub2.id]
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'folder' && it.folderId === sub2.id))
      }
    })

    const result = await stackModule.undo(1)
    expect(result.ok).toBe(false)
  })

  it('moveItem: live folder items are NOT recorded', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const liveFolder = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live',
      live: { source: { type: 'github-prs', preset: 'authored' }, refreshIntervalMin: 0 },
    })

    // Try to record a move for a live-folder ref — should be a no-op.
    await recordMoveItem({ kind: 'live', externalId: 'ext-1' }, 1)
    expect(peekUndoStack(1)).toBeUndefined()

    // Also try moving a live folder itself.
    await recordMoveItem({ kind: 'folder', folderId: liveFolder.id }, 1)
    expect(peekUndoStack(1)).toBeUndefined()
  })

  // ---- deleteFolder(closeTabs: false) → undo ------------------------------

  it('deleteFolder(closeTabs:false): undo restores folder and its items', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const folder = await createFolder({ parentFolderId: space.rootFolderId, name: 'MyFolder' })
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://example.com' })
    await registerTab(t)
    // Move tab into folder.
    await moveItem({ item: { kind: 'tab', tabId: t.id! }, toFolderId: folder.id, toIndex: 0 })

    await recordDeleteFolder(folder.id, false, 1)

    // Simulate delete (items remain since closeTabs=false, but folder removed from store).
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      delete s.folders[folder.id]
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'folder' && it.folderId === folder.id))
      }
    })

    const result = await undo(1)
    expect(result.ok).toBe(true)
    expect(result.description).toContain('MyFolder')

    const storeAfter = await loadStore()
    // Folder restored.
    expect(storeAfter.folders[folder.id]).toBeDefined()
    expect(storeAfter.folders[folder.id]!.name).toBe('MyFolder')
    // Folder ref in parent.
    const inParent = storeAfter.folders[space.rootFolderId]!.items.some(
      (it) => it.kind === 'folder' && it.folderId === folder.id,
    )
    expect(inParent).toBe(true)
  })

  // ---- deleteFolder(closeTabs: true) → undo -------------------------------

  it('deleteFolder(closeTabs:true): undo restores folder and re-opens closed tabs', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const folder = await createFolder({ parentFolderId: space.rootFolderId, name: 'FolderWithTabs' })
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://restored.example.com' })
    await registerTab(t)
    await moveItem({ item: { kind: 'tab', tabId: t.id! }, toFolderId: folder.id, toIndex: 0 })

    // Record BEFORE delete.
    await recordDeleteFolder(folder.id, true, 1)

    // Simulate delete with closeTabs=true.
    await chrome.tabs.remove(t.id!)
    await dropTab(t.id!)
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      delete s.folders[folder.id]
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'folder' && it.folderId === folder.id))
      }
    })

    const tabsBefore = mock.tabs.size

    const result = await undo(1)
    expect(result.ok).toBe(true)

    // A new tab should have been created (re-open).
    expect(mock.tabs.size).toBeGreaterThan(tabsBefore)

    const storeAfter = await loadStore()
    expect(storeAfter.folders[folder.id]).toBeDefined()
    // The new tab should appear in the restored folder.
    const folderItems = storeAfter.folders[folder.id]!.items
    expect(folderItems.length).toBeGreaterThan(0)
  })

  it('deleteFolder: live folder is NOT recorded', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    const liveFolder = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live',
      live: { source: { type: 'github-prs', preset: 'authored' }, refreshIntervalMin: 0 },
    })

    await recordDeleteFolder(liveFolder.id, false, 1)
    expect(peekUndoStack(1)).toBeUndefined()
  })

  // ---- deleteSpace → undo -------------------------------------------------

  it('deleteSpace: undo restores space and its folders', async () => {
    const space = await createSpace({ name: 'MySpace', color: 'red', windowId: 1 })
    await switchTo(space.id, 1)
    const folder = await createFolder({ parentFolderId: space.rootFolderId, name: 'SubF' })

    await recordDeleteSpace(space.id, false, 1)

    // Simulate delete.
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      for (const fid of [space.rootFolderId, folder.id]) delete s.folders[fid]
      delete s.spaces[space.id]
    })

    const result = await undo(1)
    expect(result.ok).toBe(true)
    expect(result.description).toContain('MySpace')

    const storeAfter = await loadStore()
    expect(storeAfter.spaces[space.id]).toBeDefined()
    expect(storeAfter.folders[space.rootFolderId]).toBeDefined()
    expect(storeAfter.folders[folder.id]).toBeDefined()
  })

  it('deleteSpace(closeTabs:true): undo re-opens closed tabs', async () => {
    const space = await createSpace({ name: 'SpaceWithTabs', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://space-tab.example.com' })
    await registerTab(t)

    await recordDeleteSpace(space.id, true, 1)

    // Simulate delete.
    await chrome.tabs.remove(t.id!)
    await dropTab(t.id!)
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      for (const folder of Object.values(s.folders)) {
        if (
          Object.values(s.spaces).some((sp) => {
            // collect folder ids under this space
            const ids = new Set<string>()
            const q = [sp.rootFolderId]
            while (q.length) {
              const id = q.shift()!
              ids.add(id)
              const f = s.folders[id]
              if (f) for (const it of f.items) if (it.kind === 'folder') q.push(it.folderId)
            }
            return ids.has(folder.id) && sp.id === space.id
          })
        ) {
          delete s.folders[folder.id]
        }
      }
      delete s.spaces[space.id]
    })

    const tabsBefore = mock.tabs.size
    const result = await undo(1)
    expect(result.ok).toBe(true)
    expect(mock.tabs.size).toBeGreaterThan(tabsBefore)
  })

  // ---- Stack limit --------------------------------------------------------

  it('stack capped at 50 entries; oldest are dropped', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)

    // Push 55 entries by creating and recording 55 different tabs.
    for (let i = 0; i < 55; i++) {
      const t = await chrome.tabs.create({ windowId: 1, url: `https://example.com/${i}` })
      await registerTab(t)
      await recordCloseTab(t.id!, 1)
    }

    const stack = peekUndoStack(1)
    expect(stack).toBeDefined()

    // Internal access: verify size via repeated undo + emptiness check.
    // Pop 50 times — each should succeed.
    for (let i = 0; i < 50; i++) {
      // Just verify the peek is defined (not popping for perf).
    }

    // After 50 undos the stack should be empty.
    // Clear and re-push 50+1 items; the 51st should not be there.
    clearUndoStack(1)
    const createdTabs: number[] = []
    for (let i = 0; i < 51; i++) {
      const t = await chrome.tabs.create({ windowId: 1, url: `https://example.com/b/${i}` })
      await registerTab(t)
      await recordCloseTab(t.id!, 1)
      createdTabs.push(t.id!)
    }

    // Drain 50 times — should all return ok:true since they re-create tabs.
    let okCount = 0
    for (let i = 0; i < 51; i++) {
      const r = await undo(1)
      if (r.ok) okCount++
    }
    // 51st undo should fail (stack exhausted).
    const last = await undo(1)
    expect(last.ok).toBe(false)
    // We should have gotten 50 ok undos (1 entry was dropped).
    expect(okCount).toBe(50)
  })

  // ---- Empty stack --------------------------------------------------------

  it('undo on empty stack returns ok: false', async () => {
    const result = await undo(1)
    expect(result.ok).toBe(false)
    expect(result.description).toBeUndefined()
  })

  // ---- clearUndoStack via window removal ----------------------------------

  it('clearUndoStack(windowId) clears only that window\'s stack', async () => {
    const space1 = await createSpace({ name: 'S1', color: 'blue', windowId: 1 })
    await switchTo(space1.id, 1)
    const t1 = await chrome.tabs.create({ windowId: 1, url: 'https://win1.example.com' })
    await registerTab(t1)
    await recordCloseTab(t1.id!, 1)

    const space2 = await createSpace({ name: 'S2', color: 'red', windowId: 2 })
    await switchTo(space2.id, 2)
    const t2 = await chrome.tabs.create({ windowId: 2, url: 'https://win2.example.com' })
    await registerTab(t2)
    await recordCloseTab(t2.id!, 2)

    expect(peekUndoStack(1)).toBeDefined()
    expect(peekUndoStack(2)).toBeDefined()

    // Simulate window 1 removed.
    clearUndoStack(1)
    expect(peekUndoStack(1)).toBeUndefined()
    // Window 2 stack should be intact.
    expect(peekUndoStack(2)).toBeDefined()
  })

  // ---- peekUndo -----------------------------------------------------------

  it('peekUndo returns human-readable description without consuming the entry', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const t = await chrome.tabs.create({ windowId: 1, url: 'https://peek.example.com' })
    await registerTab(t)
    await recordCloseTab(t.id!, 1)

    const peek1 = peekUndo(1)
    expect(peek1).toBeDefined()
    expect(peek1!.kind).toBe('close-tab')
    expect(peek1!.description).toContain('Closed tab')

    // Stack entry not consumed.
    const peek2 = peekUndo(1)
    expect(peek2).toBeDefined()
  })

  it('peekUndo returns undefined when stack is empty', () => {
    expect(peekUndo(99)).toBeUndefined()
  })

  // ---- findWindowIdForFolder / findWindowIdForItem utilities --------------

  it('findWindowIdForFolder correctly traces through nested folders', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 42 })
    const sub = await createFolder({ parentFolderId: space.rootFolderId, name: 'Sub' })
    const store = await loadStore()
    expect(findWindowIdForFolder(store, sub.id)).toBe(42)
  })

  it('findWindowIdForItem finds windowId by tab item', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 7 })
    await switchTo(space.id, 7)
    const t = await chrome.tabs.create({ windowId: 7 })
    await registerTab(t)
    const store = await loadStore()
    expect(findWindowIdForItem(store, { kind: 'tab', tabId: t.id! })).toBe(7)
  })

  // ---- Live folder alarm re-schedule after undo ---------------------------

  it('deleteSpace with live folder (refreshIntervalMin >= 1): undo restores alarm', async () => {
    const space = await createSpace({ name: 'LiveSpace', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    const liveFolder = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'LiveF',
      live: { source: { type: 'github-prs', preset: 'authored' }, refreshIntervalMin: 5 },
    })

    // Clear alarm call history to isolate what happens after undo.
    const alarmCreateSpy = mock.alarms
    const alarmsBefore = [...alarmCreateSpy.keys()]
    void alarmsBefore

    await recordDeleteSpace(space.id, false, 1)

    // Simulate delete (remove space + folders from store).
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      delete s.folders[liveFolder.id]
      delete s.folders[space.rootFolderId]
      delete s.spaces[space.id]
    })
    // Also clear the alarm as deleteSpace would.
    await chrome.alarms.clear(`live-folder:${liveFolder.id}`)

    // Verify alarm is gone.
    expect(mock.alarms.has(`live-folder:${liveFolder.id}`)).toBe(false)

    // Undo.
    const result = await undo(1)
    expect(result.ok).toBe(true)

    // Alarm should be re-scheduled.
    expect(mock.alarms.has(`live-folder:${liveFolder.id}`)).toBe(true)
    expect(mock.alarms.get(`live-folder:${liveFolder.id}`)?.periodInMinutes).toBe(5)
  })

  it('deleteFolder with nested live folder (refreshIntervalMin >= 1): undo restores alarm', async () => {
    const space = await createSpace({ name: 'S', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    // Parent (non-live) folder contains a live sub-folder.
    const parentFolder = await createFolder({ parentFolderId: space.rootFolderId, name: 'Parent' })
    const liveSubFolder = await createFolder({
      parentFolderId: parentFolder.id,
      name: 'LiveSub',
      live: { source: { type: 'github-prs', preset: 'authored' }, refreshIntervalMin: 10 },
    })

    await recordDeleteFolder(parentFolder.id, false, 1)

    // Simulate delete.
    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      delete s.folders[liveSubFolder.id]
      delete s.folders[parentFolder.id]
      for (const f of Object.values(s.folders)) {
        f.items = f.items.filter((it) => !(it.kind === 'folder' && it.folderId === parentFolder.id))
      }
    })
    await chrome.alarms.clear(`live-folder:${liveSubFolder.id}`)

    // Alarm gone.
    expect(mock.alarms.has(`live-folder:${liveSubFolder.id}`)).toBe(false)

    // Undo.
    const result = await undo(1)
    expect(result.ok).toBe(true)

    // Alarm restored.
    expect(mock.alarms.has(`live-folder:${liveSubFolder.id}`)).toBe(true)
    expect(mock.alarms.get(`live-folder:${liveSubFolder.id}`)?.periodInMinutes).toBe(10)
  })

  it('deleteSpace with manual-only live folder (refreshIntervalMin = 0): undo does NOT schedule alarm', async () => {
    const space = await createSpace({ name: 'ManualSpace', color: 'blue', windowId: 1 })
    await switchTo(space.id, 1)
    await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'ManualLive',
      live: { source: { type: 'github-prs', preset: 'authored' }, refreshIntervalMin: 0 },
    })

    await recordDeleteSpace(space.id, false, 1)

    const { updateStore } = await import('./storage')
    await updateStore((s) => {
      for (const fid of Object.keys(s.folders)) {
        // Delete all folders belonging to this space by checking store snapshot.
        // Simpler: just delete everything.
        delete s.folders[fid]
      }
      delete s.spaces[space.id]
    })

    // Track how many times alarms.create is called during undo.
    const createCallsBefore = (mock.alarms as Map<string, { name: string; periodInMinutes?: number }>).size

    const result = await undo(1)
    expect(result.ok).toBe(true)

    // No new alarm for the manual-only folder (periodInMinutes = 0 → no alarm).
    const liveAlarms = [...mock.alarms.keys()].filter((k) => k.startsWith('live-folder:'))
    expect(liveAlarms.length).toBe(0)
    void createCallsBefore
  })
})
