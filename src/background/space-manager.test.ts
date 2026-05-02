import { describe, it, expect, beforeEach } from 'vitest'
import {
  createStaticSpace,
  switchTo,
  listSpaces,
  deleteSpace,
  renameSpace,
  setSpaceColor,
  findSpaceByGroupId,
  reorderSpaces,
  getActiveSpace,
} from './space-manager'
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
})
