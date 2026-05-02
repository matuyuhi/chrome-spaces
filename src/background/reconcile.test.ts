import { describe, it, expect, beforeEach } from 'vitest'
import { reconcile } from './reconcile'
import { createStaticSpace, listSpaces } from './space-manager'
import { TAB_GROUP_ID_NONE } from '../shared/types'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('reconcile', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('marks spaces whose Tab Group no longer exists as unmounted', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    mock.groups.delete(space.groupId)
    await reconcile()
    const list = await listSpaces(1)
    expect(list[0]?.groupId).toBe(TAB_GROUP_ID_NONE)
  })

  it('leaves still-existing groups untouched', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    await reconcile()
    expect((await listSpaces(1))[0]?.groupId).toBe(space.groupId)
  })

  it('adoptExistingGroups creates Spaces for orphan Tab Groups', async () => {
    mock.groups.set(99, { id: 99, windowId: 1, title: 'Existing', color: 'green', collapsed: false })
    await reconcile({ adoptExistingGroups: true })
    const list = await listSpaces(1)
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('Existing')
    expect(list[0]?.color).toBe('green')
    expect(list[0]?.groupId).toBe(99)
  })

  it('adoptExistingGroups skips already-claimed groups', async () => {
    const claimed = await createStaticSpace({ name: 'Mine', color: 'red', windowId: 1 })
    mock.groups.set(99, { id: 99, windowId: 1, title: 'Other', color: 'blue', collapsed: false })
    await reconcile({ adoptExistingGroups: true })
    const list = await listSpaces(1)
    expect(list).toHaveLength(2)
    expect(list.find((s) => s.groupId === claimed.groupId)?.name).toBe('Mine')
    expect(list.find((s) => s.groupId === 99)?.name).toBe('Other')
  })
})
