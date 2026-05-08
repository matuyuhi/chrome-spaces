import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { reconcileAlarms, alarmName } from './alarms'
import { createSpace, createFolder } from '../space-manager'
import { setupChromeMock } from '../test-utils'

describe('reconcileAlarms', () => {
  beforeEach(() => {
    setupChromeMock()
  })

  afterEach(async () => {
    await chrome.storage.local.clear()
    await chrome.alarms.clearAll()
  })

  it('creates alarms for live folders with refreshIntervalMin >= 1', async () => {
    const space = await createSpace({ name: 'Work', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Test Live Folder',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 5,
      },
    })

    await reconcileAlarms()

    const alarms = await chrome.alarms.getAll()
    expect(alarms).toHaveLength(1)
    expect(alarms[0].name).toBe(alarmName(live.id))
    expect(alarms[0].periodInMinutes).toBe(5)
  })

  it('does not create alarms for standard folders or live folders with refreshIntervalMin < 1', async () => {
    const space = await createSpace({ name: 'Work', color: 'red', windowId: 1 })

    // Standard folder
    await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Standard Folder',
    })

    // Live folder with < 1 interval
    await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live Manual',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 0,
      },
    })

    await reconcileAlarms()

    const alarms = await chrome.alarms.getAll()
    expect(alarms).toHaveLength(0)
  })

  it('clears alarms for folders that no longer exist', async () => {
    const oldAlarmName = alarmName('nonexistent-folder-id' as any)
    await chrome.alarms.create(oldAlarmName, { periodInMinutes: 10 })

    const space = await createSpace({ name: 'Work', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live 5',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 5,
      },
    })

    await reconcileAlarms()

    const alarms = await chrome.alarms.getAll()
    expect(alarms).toHaveLength(1)
    expect(alarms[0].name).toBe(alarmName(live.id))
    expect(alarms[0].periodInMinutes).toBe(5)
  })

  it('updates an existing alarm if its interval has changed', async () => {
    const space = await createSpace({ name: 'Work', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live Update',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 15,
      },
    })

    // Create an old alarm with a different interval
    await chrome.alarms.create(alarmName(live.id), { periodInMinutes: 5 })

    await reconcileAlarms()

    const alarms = await chrome.alarms.getAll()
    expect(alarms).toHaveLength(1)
    expect(alarms[0].name).toBe(alarmName(live.id))
    expect(alarms[0].periodInMinutes).toBe(15)
  })

  it('ignores alarms without the live-folder: prefix', async () => {
    await chrome.alarms.create('other-alarm', { periodInMinutes: 30 })

    const space = await createSpace({ name: 'Work', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Live 5',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 5,
      },
    })

    await reconcileAlarms()

    const alarms = await chrome.alarms.getAll()
    expect(alarms).toHaveLength(2)
    const otherAlarm = alarms.find((a) => a.name === 'other-alarm')
    const liveAlarm = alarms.find((a) => a.name === alarmName(live.id))
    expect(otherAlarm).toBeDefined()
    expect(otherAlarm?.periodInMinutes).toBe(30)
    expect(liveAlarm).toBeDefined()
    expect(liveAlarm?.periodInMinutes).toBe(5)
  })
})
