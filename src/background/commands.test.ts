import { describe, it, expect, beforeEach } from 'vitest'
import { handleCommand } from './commands'
import { createStaticSpace, listSpaces, getActiveSpace } from './space-manager'
import { setupChromeMock } from './test-utils'

describe('commands', () => {
  beforeEach(() => setupChromeMock())

  it('switch-space-N picks the Nth space in window order', async () => {
    const a = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const b = await createStaticSpace({ name: 'B', color: 'blue', windowId: 1 })
    await createStaticSpace({ name: 'C', color: 'green', windowId: 1 })

    await handleCommand('switch-space-2', 1)
    expect((await getActiveSpace(1))?.id).toBe(b.id)

    await handleCommand('switch-space-1', 1)
    expect((await getActiveSpace(1))?.id).toBe(a.id)
  })

  it('switch-space-N is a no-op when no Nth space exists', async () => {
    const a = await createStaticSpace({ name: 'Solo', color: 'red', windowId: 1 })
    await handleCommand('switch-space-2', 1)
    expect((await getActiveSpace(1))?.id ?? a.id).toBe(a.id)
  })

  it('new-space creates a fresh static space in the current window', async () => {
    await handleCommand('new-space', 1)
    const list = await listSpaces(1)
    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('Space 1')
  })

  it('new-space numbers sequentially', async () => {
    await handleCommand('new-space', 1)
    await handleCommand('new-space', 1)
    await handleCommand('new-space', 1)
    const list = await listSpaces(1)
    expect(list.map((s) => s.name)).toEqual(['Space 1', 'Space 2', 'Space 3'])
  })

  it('ignores unknown commands', async () => {
    await handleCommand('totally-unknown', 1)
    expect(await listSpaces(1)).toHaveLength(0)
  })
})
