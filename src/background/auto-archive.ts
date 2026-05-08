import {
  type FolderId,
  type Space,
  type SpaceId,
  type SpaceStore,
  isLiveFolder,
  walkFolders,
} from '../shared/types'
import { loadStore, updateStore } from './storage'
import { getUIPrefs } from './ui-prefs'

const ARCHIVE_FOLDER_NAME = 'Archive'
const ALARM_NAME = 'auto-archive'
// Daily check is fine — archive thresholds are measured in days.
const ALARM_PERIOD_MIN = 60 * 24

const now = (): number => Date.now()

export interface ArchiveResult {
  archived: { spaceId: SpaceId; folderId: FolderId; tabId: number }[]
}

// Find or create the per-Space "Archive" folder under root. Returns the
// id of an existing folder named "Archive" (case-insensitive, root-only)
// so the user can rename / customize without breaking the lookup.
function ensureArchiveFolder(s: SpaceStore, space: Space): FolderId {
  const root = s.folders[space.rootFolderId]
  if (!root) return space.rootFolderId
  for (const item of root.items) {
    if (item.kind !== 'folder') continue
    const f = s.folders[item.folderId]
    if (f && !isLiveFolder(f) && f.name.toLowerCase() === 'archive') {
      return f.id
    }
  }
  const folderId = `folder_${Math.random().toString(36).slice(2, 10)}`
  s.folders[folderId] = {
    id: folderId,
    name: ARCHIVE_FOLDER_NAME,
    collapsed: true,
    items: [],
  }
  root.items.push({ kind: 'folder', folderId })
  return folderId
}

interface Candidate {
  spaceId: SpaceId
  fromFolderId: FolderId
  tabId: number
}

function collectCandidates(
  store: SpaceStore,
  threshold: number,
): Candidate[] {
  const out: Candidate[] = []
  for (const space of Object.values(store.spaces)) {
    const archiveName = (() => {
      const root = store.folders[space.rootFolderId]
      if (!root) return undefined
      for (const item of root.items) {
        if (item.kind !== 'folder') continue
        const f = store.folders[item.folderId]
        if (f && f.name.toLowerCase() === 'archive') return item.folderId
      }
      return undefined
    })()
    for (const folder of walkFolders(store, space.rootFolderId)) {
      // Live-folder content is owned by the sync engine; never touch it.
      if (isLiveFolder(folder)) continue
      // Don't drag tabs out of an existing Archive folder back into one.
      if (folder.id === archiveName) continue
      for (const item of folder.items) {
        if (item.kind !== 'tab') continue
        const rec = store.tabs[item.tabId]
        const lastActiveAt = rec?.lastActiveAt
        if (typeof lastActiveAt !== 'number') continue
        if (now() - lastActiveAt < threshold) continue
        // Don't archive the current Space's currently-active tab.
        if (space.lastActiveTabId === item.tabId) continue
        out.push({
          spaceId: space.id,
          fromFolderId: folder.id,
          tabId: item.tabId,
        })
      }
    }
  }
  return out
}

export async function archiveStaleTabs(): Promise<ArchiveResult> {
  const prefs = await getUIPrefs()
  const days = prefs.autoArchiveDays
  if (!days || days <= 0) return { archived: [] }
  const thresholdMs = days * 24 * 60 * 60 * 1000
  const store = await loadStore()
  const candidates = collectCandidates(store, thresholdMs)
  if (candidates.length === 0) return { archived: [] }
  const archived: ArchiveResult['archived'] = []
  await updateStore((s) => {
    for (const c of candidates) {
      const space = s.spaces[c.spaceId]
      if (!space) continue
      const archiveId = ensureArchiveFolder(s, space)
      // Don't move a tab onto itself (would happen if the candidate's
      // own folder was renamed mid-flight; defensive).
      if (archiveId === c.fromFolderId) continue
      const fromFolder = s.folders[c.fromFolderId]
      if (!fromFolder) continue
      fromFolder.items = fromFolder.items.filter(
        (it) => !(it.kind === 'tab' && it.tabId === c.tabId),
      )
      const archive = s.folders[archiveId]
      if (!archive) continue
      // Don't double-add (paranoia).
      if (archive.items.some((it) => it.kind === 'tab' && it.tabId === c.tabId))
        continue
      archive.items.push({ kind: 'tab', tabId: c.tabId })
      archived.push({ spaceId: c.spaceId, folderId: archiveId, tabId: c.tabId })
    }
  })
  return { archived }
}

export async function ensureAutoArchiveAlarm(): Promise<void> {
  const prefs = await getUIPrefs()
  if (!prefs.autoArchiveDays || prefs.autoArchiveDays <= 0) {
    await chrome.alarms.clear(ALARM_NAME)
    return
  }
  const existing = await chrome.alarms.get(ALARM_NAME)
  if (existing && existing.periodInMinutes === ALARM_PERIOD_MIN) return
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: ALARM_PERIOD_MIN,
    delayInMinutes: 1, // small initial delay so SW startup doesn't race
  })
}

export const AUTO_ARCHIVE_ALARM = ALARM_NAME
