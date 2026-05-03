import { loadStore } from '../storage'
import { isLive, type SpaceId } from '../../shared/types'
import { syncLiveSpace } from './sync-engine'

const ALARM_PREFIX = 'live-space:'

export function alarmName(spaceId: SpaceId): string {
  return `${ALARM_PREFIX}${spaceId}`
}

export function spaceIdFromAlarm(name: string): SpaceId | undefined {
  return name.startsWith(ALARM_PREFIX) ? name.slice(ALARM_PREFIX.length) : undefined
}

export async function scheduleSync(spaceId: SpaceId, intervalMin: number): Promise<void> {
  // 0 (or anything <1) means "manual only" — clear any existing alarm.
  if (intervalMin < 1) {
    await chrome.alarms.clear(alarmName(spaceId))
    return
  }
  await chrome.alarms.create(alarmName(spaceId), { periodInMinutes: intervalMin })
}

export async function unscheduleSync(spaceId: SpaceId): Promise<void> {
  await chrome.alarms.clear(alarmName(spaceId))
}

export async function reconcileAlarms(): Promise<void> {
  const all = await chrome.alarms.getAll()
  const desired = new Map<string, number>()

  const store = await loadStore()
  for (const sp of Object.values(store.spaces)) {
    if (!isLive(sp)) continue
    if (sp.refreshIntervalMin < 1) continue // manual-only — no alarm
    desired.set(alarmName(sp.id), sp.refreshIntervalMin)
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
  const id = spaceIdFromAlarm(alarm.name)
  if (!id) return
  void syncLiveSpace(id)
}
