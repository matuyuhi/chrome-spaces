import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileAlarms, alarmName, scheduleSync, unscheduleSync } from './alarms'
import { createLiveSpace, createStaticSpace, deleteSpace } from '../space-manager'
import { setupChromeMock, type ChromeMock } from '../test-utils'

describe('alarms', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('createLiveSpace schedules an alarm with the configured interval', async () => {
    const space = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'review-requested' },
      refreshIntervalMin: 7,
    })
    expect(mock.alarms.get(alarmName(space.id))?.periodInMinutes).toBe(7)
  })

  it('deleteSpace clears the alarm of a live space', async () => {
    const space = await createLiveSpace({
      name: 'X',
      color: 'red',
      windowId: 1,
      source: { type: 'github-prs', preset: 'assigned' },
    })
    expect(mock.alarms.has(alarmName(space.id))).toBe(true)
    await deleteSpace(space.id, { closeTabs: false })
    expect(mock.alarms.has(alarmName(space.id))).toBe(false)
  })

  it('reconcileAlarms creates missing and clears stale alarms', async () => {
    const live = await createLiveSpace({
      name: 'Reviews',
      color: 'blue',
      windowId: 1,
      source: { type: 'github-prs', preset: 'authored' },
      refreshIntervalMin: 5,
    })
    await createStaticSpace({ name: 'Static', color: 'red', windowId: 1 })

    // Simulate stale alarm + missing alarm
    await scheduleSync('orphan-id', 5)
    await unscheduleSync(live.id)

    await reconcileAlarms()

    expect(mock.alarms.has(alarmName(live.id))).toBe(true)
    expect(mock.alarms.has(alarmName('orphan-id'))).toBe(false)
  })
})
