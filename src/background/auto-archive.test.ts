import { describe, it, expect, beforeEach } from 'vitest'
import { archiveStaleTabs, ensureAutoArchiveAlarm, AUTO_ARCHIVE_ALARM } from './auto-archive'
import { createFolder, createSpace } from './space-manager'
import { loadStore, updateStore } from './storage'
import { setUIPrefs } from './ui-prefs'
import { setupChromeMock } from './test-utils'

const DAY = 24 * 60 * 60 * 1000

async function plantTab(
  folderId: string,
  tabId: number,
  lastActiveAt: number,
): Promise<void> {
  await updateStore((s) => {
    s.tabs[tabId] = { tabId, windowId: 1, lastActiveAt }
    const f = s.folders[folderId]
    if (f) f.items.push({ kind: 'tab', tabId })
  })
}

describe('archiveStaleTabs', () => {
  beforeEach(() => setupChromeMock())

  it('does nothing when autoArchiveDays is 0', async () => {
    const space = await createSpace({ name: 'S', color: 'red', windowId: 1 })
    await plantTab(space.rootFolderId, 100, Date.now() - 30 * DAY)
    const result = await archiveStaleTabs()
    expect(result.archived).toEqual([])
  })

  it('moves tabs older than the threshold into a per-Space Archive folder', async () => {
    await setUIPrefs({ autoArchiveDays: 7 })
    const space = await createSpace({ name: 'S', color: 'red', windowId: 1 })
    await plantTab(space.rootFolderId, 100, Date.now() - 10 * DAY) // stale
    await plantTab(space.rootFolderId, 200, Date.now() - 1 * DAY) // fresh

    const result = await archiveStaleTabs()
    expect(result.archived.map((a) => a.tabId)).toEqual([100])

    const store = await loadStore()
    const root = store.folders[space.rootFolderId]!
    // Fresh tab still in root.
    expect(root.items.some((it) => it.kind === 'tab' && it.tabId === 200)).toBe(true)
    // Stale tab no longer in root.
    expect(root.items.some((it) => it.kind === 'tab' && it.tabId === 100)).toBe(false)
    // Archive folder created and contains the stale tab.
    const archiveItem = root.items.find((it) => it.kind === 'folder')
    expect(archiveItem).toBeTruthy()
    if (archiveItem?.kind !== 'folder') throw new Error('expected folder')
    const archive = store.folders[archiveItem.folderId]!
    expect(archive.name).toBe('Archive')
    expect(archive.items).toEqual([{ kind: 'tab', tabId: 100 }])
  })

  it('reuses an existing Archive folder by name', async () => {
    await setUIPrefs({ autoArchiveDays: 7 })
    const space = await createSpace({ name: 'S', color: 'red', windowId: 1 })
    const archive = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Archive',
    })
    await plantTab(space.rootFolderId, 100, Date.now() - 10 * DAY)

    await archiveStaleTabs()
    const store = await loadStore()
    const archiveAfter = store.folders[archive.id]!
    expect(archiveAfter.items).toEqual([{ kind: 'tab', tabId: 100 }])
    // No second Archive folder under root.
    const root = store.folders[space.rootFolderId]!
    const archiveFolders = root.items
      .filter((it) => it.kind === 'folder')
      .map((it) => (it.kind === 'folder' ? store.folders[it.folderId]?.name : ''))
    expect(archiveFolders.filter((n) => n === 'Archive')).toHaveLength(1)
  })

  it('skips Live folder tabs and the active tab', async () => {
    await setUIPrefs({ autoArchiveDays: 7 })
    const space = await createSpace({ name: 'S', color: 'red', windowId: 1 })
    const live = await createFolder({
      parentFolderId: space.rootFolderId,
      name: 'Reviews',
      live: {
        source: { type: 'github-prs', preset: 'review-requested' },
        refreshIntervalMin: 0,
      },
    })
    // Stale tab inside a Live folder — must NOT be archived.
    await updateStore((s) => {
      s.tabs[300] = { tabId: 300, windowId: 1, lastActiveAt: Date.now() - 10 * DAY }
      const f = s.folders[live.id]
      if (f) {
        f.items.push({ kind: 'tab', tabId: 300 })
        if (f.live) {
          f.live.managedTabs.push({
            externalId: 'a/b#1',
            url: 'https://x',
            tabId: 300,
            addedAt: 0,
          })
        }
      }
    })
    // Stale tab that's the Space's lastActiveTab — must NOT be archived.
    await plantTab(space.rootFolderId, 400, Date.now() - 10 * DAY)
    await updateStore((s) => {
      const sp = s.spaces[space.id]
      if (sp) sp.lastActiveTabId = 400
    })

    const result = await archiveStaleTabs()
    expect(result.archived).toEqual([])
  })
})

describe('ensureAutoArchiveAlarm', () => {
  let chromeMock: ReturnType<typeof setupChromeMock>
  beforeEach(() => {
    chromeMock = setupChromeMock()
  })

  it('clears the alarm if autoArchiveDays is 0', async () => {
    await setUIPrefs({ autoArchiveDays: 0 })
    chromeMock.alarms.set(AUTO_ARCHIVE_ALARM, { name: AUTO_ARCHIVE_ALARM, periodInMinutes: 1440 })
    await ensureAutoArchiveAlarm()
    expect(chromeMock.alarms.has(AUTO_ARCHIVE_ALARM)).toBe(false)
  })

  it('clears the alarm if autoArchiveDays is undefined', async () => {
    await setUIPrefs({ autoArchiveDays: undefined as any })
    chromeMock.alarms.set(AUTO_ARCHIVE_ALARM, { name: AUTO_ARCHIVE_ALARM, periodInMinutes: 1440 })
    await ensureAutoArchiveAlarm()
    expect(chromeMock.alarms.has(AUTO_ARCHIVE_ALARM)).toBe(false)
  })

  it('creates the alarm if autoArchiveDays > 0 and it does not exist', async () => {
    await setUIPrefs({ autoArchiveDays: 7 })
    await ensureAutoArchiveAlarm()
    const alarm = chromeMock.alarms.get(AUTO_ARCHIVE_ALARM)
    expect(alarm).toBeDefined()
    expect(alarm?.periodInMinutes).toBe(1440)
  })

  it('recreates the alarm if it exists with the wrong period', async () => {
    await setUIPrefs({ autoArchiveDays: 7 })
    chromeMock.alarms.set(AUTO_ARCHIVE_ALARM, { name: AUTO_ARCHIVE_ALARM, periodInMinutes: 60 })
    await ensureAutoArchiveAlarm()
    const alarm = chromeMock.alarms.get(AUTO_ARCHIVE_ALARM)
    expect(alarm).toBeDefined()
    expect(alarm?.periodInMinutes).toBe(1440)
  })

  it('does nothing if the alarm already exists with the correct period', async () => {
    await setUIPrefs({ autoArchiveDays: 7 })
    chromeMock.alarms.set(AUTO_ARCHIVE_ALARM, { name: AUTO_ARCHIVE_ALARM, periodInMinutes: 1440 })
    const createSpy = (globalThis as any).chrome.alarms.create
    createSpy.mockClear()
    await ensureAutoArchiveAlarm()
    expect(createSpy).not.toHaveBeenCalled()
  })
})
