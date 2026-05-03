import { loadStore } from '../storage'
import { type FolderId } from '../../shared/types'
import { syncLiveFolder } from './sync-engine'

const ALARM_PREFIX = 'live-folder:'

export function alarmName(folderId: FolderId): string {
  return `${ALARM_PREFIX}${folderId}`
}

export function folderIdFromAlarm(name: string): FolderId | undefined {
  return name.startsWith(ALARM_PREFIX) ? name.slice(ALARM_PREFIX.length) : undefined
}

export async function scheduleSync(
  folderId: FolderId,
  intervalMin: number,
): Promise<void> {
  if (intervalMin < 1) {
    await chrome.alarms.clear(alarmName(folderId))
    return
  }
  await chrome.alarms.create(alarmName(folderId), { periodInMinutes: intervalMin })
}

export async function unscheduleSync(folderId: FolderId): Promise<void> {
  await chrome.alarms.clear(alarmName(folderId))
}

export async function reconcileAlarms(): Promise<void> {
  const all = await chrome.alarms.getAll()
  const desired = new Map<string, number>()

  const store = await loadStore()
  for (const f of Object.values(store.folders)) {
    if (!f.live) continue
    if (f.live.refreshIntervalMin < 1) continue
    desired.set(alarmName(f.id), f.live.refreshIntervalMin)
  }

  for (const a of all) {
    if (!a.name.startsWith(ALARM_PREFIX)) continue
    if (!desired.has(a.name)) await chrome.alarms.clear(a.name)
  }

  for (const [name, interval] of desired) {
    const existing = all.find((a) => a.name === name)
    if (!existing || (existing.periodInMinutes ?? 0) !== interval) {
      await chrome.alarms.create(name, { periodInMinutes: interval })
    }
  }
}

export function handleAlarm(alarm: chrome.alarms.Alarm): void {
  const id = folderIdFromAlarm(alarm.name)
  if (!id) return
  void syncLiveFolder(id)
}
