import {
  type LiveSource,
  type LiveSpace,
  type Space,
  type SpaceId,
  type StaticSpace,
  type SpaceColor,
  TAB_GROUP_ID_NONE,
  isLive,
} from '../shared/types'
import { loadStore, updateStore } from './storage'
import { createTabAsGroupSeed } from './inflight'
import { scheduleSync, unscheduleSync } from './live/alarms'
import { syncLiveSpace } from './live/sync-engine'

const now = (): number => Date.now()
const uid = (): string => crypto.randomUUID()

export interface CreateStaticSpaceInput {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
}

export async function createStaticSpace(input: CreateStaticSpaceInput): Promise<StaticSpace> {
  const seed = await createTabAsGroupSeed({ windowId: input.windowId, active: false })
  if (!seed) throw new Error('Failed to create starter tab')
  const { tab, groupId } = seed
  await safeTabGroupUpdate(groupId, {
    title: input.name,
    color: input.color,
    collapsed: false,
  })

  const id = uid()
  const ts = now()
  const space: StaticSpace = {
    kind: 'static',
    id,
    name: input.name,
    color: input.color,
    emoji: input.emoji,
    groupId,
    windowId: input.windowId,
    order: 0,
    lastActiveTabId: tab.id,
    createdAt: ts,
    lastAccessedAt: ts,
  }

  await updateStore((s) => {
    space.order = Object.values(s.spaces).filter((sp) => sp.windowId === input.windowId).length
    s.spaces[id] = space
  })

  return space
}

export interface CreateStaticFromTabsInput {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
  // If omitted, captures every ungrouped tab in the window.
  tabIds?: number[]
}

export async function createStaticSpaceFromTabs(
  input: CreateStaticFromTabsInput,
): Promise<StaticSpace> {
  let tabIds = input.tabIds
  if (tabIds === undefined) {
    const tabs = await chrome.tabs.query({ windowId: input.windowId })
    tabIds = tabs
      .filter((t) => t.groupId === TAB_GROUP_ID_NONE && typeof t.id === 'number')
      .map((t) => t.id as number)
  }
  if (tabIds.length === 0) {
    throw new Error('No ungrouped tabs to capture in this window.')
  }

  const groupId = await chrome.tabs.group({
    createProperties: { windowId: input.windowId },
    tabIds,
  })
  await safeTabGroupUpdate(groupId, {
    title: input.name,
    color: input.color,
    collapsed: false,
  })

  // Prefer the currently-active tab as lastActiveTabId so switching back
  // to this space lands on what the user was just looking at.
  const [activeTab] = await chrome.tabs.query({ windowId: input.windowId, active: true })
  const activeId = typeof activeTab?.id === 'number' ? activeTab.id : undefined
  const lastActiveTabId = activeId && tabIds.includes(activeId) ? activeId : tabIds[0]

  const id = uid()
  const ts = now()
  const space: StaticSpace = {
    kind: 'static',
    id,
    name: input.name,
    color: input.color,
    emoji: input.emoji,
    groupId,
    windowId: input.windowId,
    order: 0,
    lastActiveTabId,
    createdAt: ts,
    lastAccessedAt: ts,
  }

  await updateStore((s) => {
    space.order = Object.values(s.spaces).filter((sp) => sp.windowId === input.windowId).length
    s.spaces[id] = space
  })

  return space
}

export interface CreateLiveSpaceInput {
  name: string
  color: SpaceColor
  emoji?: string
  windowId: number
  source: LiveSource
  refreshIntervalMin?: number
}

export async function createLiveSpace(input: CreateLiveSpaceInput): Promise<LiveSpace> {
  const seed = await createTabAsGroupSeed({ windowId: input.windowId, active: false })
  if (!seed) throw new Error('Failed to create starter tab')
  const { tab, groupId } = seed
  await safeTabGroupUpdate(groupId, {
    title: input.name,
    color: input.color,
    collapsed: false,
  })

  const id = uid()
  const ts = now()
  const space: LiveSpace = {
    kind: 'live',
    id,
    name: input.name,
    color: input.color,
    emoji: input.emoji,
    groupId,
    windowId: input.windowId,
    order: 0,
    lastActiveTabId: tab.id,
    createdAt: ts,
    lastAccessedAt: ts,
    source: input.source,
    refreshIntervalMin: input.refreshIntervalMin ?? 0,
    managedTabs: [],
    starterTabId: tab.id,
  }

  await updateStore((s) => {
    space.order = Object.values(s.spaces).filter((sp) => sp.windowId === input.windowId).length
    s.spaces[id] = space
  })

  await scheduleSync(id, space.refreshIntervalMin)

  return space
}

export async function renameSpace(id: SpaceId, name: string): Promise<void> {
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (sp) sp.name = name
  })
  const sp = (await loadStore()).spaces[id]
  if (sp && sp.groupId !== TAB_GROUP_ID_NONE) {
    await safeTabGroupUpdate(sp.groupId, { title: name })
  }
}

export async function setSpaceColor(id: SpaceId, color: SpaceColor): Promise<void> {
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (sp) sp.color = color
  })
  const sp = (await loadStore()).spaces[id]
  if (sp && sp.groupId !== TAB_GROUP_ID_NONE) {
    await safeTabGroupUpdate(sp.groupId, { color })
  }
}

export interface UpdateLiveSpaceInput {
  source?: LiveSource
  refreshIntervalMin?: number
}

export async function updateLiveSpace(
  id: SpaceId,
  patch: UpdateLiveSpaceInput,
): Promise<LiveSpace | undefined> {
  let updated: LiveSpace | undefined
  let intervalChanged = false
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (!sp || !isLive(sp)) return
    if (patch.source !== undefined) sp.source = patch.source
    if (patch.refreshIntervalMin !== undefined && patch.refreshIntervalMin !== sp.refreshIntervalMin) {
      sp.refreshIntervalMin = patch.refreshIntervalMin
      intervalChanged = true
    }
    updated = sp
  })
  if (updated && intervalChanged) {
    await scheduleSync(id, updated.refreshIntervalMin)
  }
  return updated
}

export async function setSpaceEmoji(id: SpaceId, emoji: string | undefined): Promise<void> {
  await updateStore((s) => {
    const sp = s.spaces[id]
    if (sp) sp.emoji = emoji
  })
}

export async function deleteSpace(id: SpaceId, options: { closeTabs: boolean }): Promise<void> {
  const store = await loadStore()
  const space = store.spaces[id]
  if (!space) return

  if (isLive(space)) await unscheduleSync(id)

  if (options.closeTabs && space.groupId !== TAB_GROUP_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({ groupId: space.groupId })
      const ids = tabs.map((t) => t.id).filter((tid): tid is number => typeof tid === 'number')
      if (ids.length > 0) await chrome.tabs.remove(ids)
    } catch {
      // Group already gone — nothing to close.
    }
  }

  await updateStore((s) => {
    delete s.spaces[id]
    for (const [winId, activeId] of Object.entries(s.activeSpaceByWindow)) {
      if (activeId === id) delete s.activeSpaceByWindow[Number(winId)]
    }
  })
}

export async function switchTo(spaceId: SpaceId, windowId?: number): Promise<void> {
  const store = await loadStore()
  let target = store.spaces[spaceId]
  if (!target) return
  const winId = windowId ?? target.windowId

  // The Tab Group may have been removed outside the popup (right-click →
  // Close group, or closing every tab in the group). The Space record was
  // preserved with groupId = TAB_GROUP_ID_NONE; switching to it should
  // resurrect the group rather than no-op.
  if (target.groupId === TAB_GROUP_ID_NONE) {
    target = await rehydrateSpace(target)
  }

  // Persist active first so the onTabGroupUpdated handler does not see a
  // stale activeSpaceByWindow when our own tabGroups.update events fire,
  // which would otherwise cause a recursive switchTo storm and burn through
  // the storage write quota.
  await updateStore((s) => {
    s.activeSpaceByWindow[winId] = spaceId
    const sp = s.spaces[spaceId]
    if (sp) sp.lastAccessedAt = now()
  })

  const sameWindow = Object.values(store.spaces).filter((s) => s.windowId === winId)

  for (const s of sameWindow) {
    if (s.id === spaceId) continue
    if (s.groupId === TAB_GROUP_ID_NONE) continue
    await safeTabGroupUpdate(s.groupId, { collapsed: true })
  }

  if (target.groupId !== TAB_GROUP_ID_NONE) {
    await safeTabGroupUpdate(target.groupId, { collapsed: false })
  }

  let activated = false
  if (target.lastActiveTabId !== undefined) {
    try {
      await chrome.tabs.update(target.lastActiveTabId, { active: true })
      activated = true
    } catch {
      // tab gone; fall through
    }
  }
  if (!activated && target.groupId !== TAB_GROUP_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({ groupId: target.groupId })
      const firstId = tabs[0]?.id
      if (typeof firstId === 'number') await chrome.tabs.update(firstId, { active: true })
    } catch {
      /* nothing to activate */
    }
  }
}

export async function getSpace(id: SpaceId): Promise<Space | undefined> {
  return (await loadStore()).spaces[id]
}

export async function listSpaces(windowId?: number): Promise<Space[]> {
  const store = await loadStore()
  const all = Object.values(store.spaces)
  const filtered = windowId === undefined ? all : all.filter((s) => s.windowId === windowId)
  return filtered.sort((a, b) => a.order - b.order)
}

export async function getActiveSpace(windowId: number): Promise<Space | undefined> {
  const store = await loadStore()
  const id = store.activeSpaceByWindow[windowId]
  return id ? store.spaces[id] : undefined
}

export async function findSpaceByGroupId(
  groupId: number,
  windowId?: number,
): Promise<Space | undefined> {
  const store = await loadStore()
  return Object.values(store.spaces).find(
    (s) => s.groupId === groupId && (windowId === undefined || s.windowId === windowId),
  )
}

export async function setLastActiveTab(windowId: number, tabId: number): Promise<void> {
  // Skip the write if the value would not change. This keeps rapid tab
  // navigation from generating one storage write per onActivated event.
  const store = await loadStore()
  const activeId = store.activeSpaceByWindow[windowId]
  if (!activeId) return
  const sp = store.spaces[activeId]
  if (!sp || sp.lastActiveTabId === tabId) return

  await updateStore((s) => {
    const id = s.activeSpaceByWindow[windowId]
    if (!id) return
    const space = s.spaces[id]
    if (space) space.lastActiveTabId = tabId
  })
}

async function rehydrateSpace(space: Space): Promise<Space> {
  const seed = await createTabAsGroupSeed({ windowId: space.windowId, active: false })
  if (!seed) throw new Error('Failed to create starter tab for rehydrate')
  const { tab, groupId } = seed
  await safeTabGroupUpdate(groupId, {
    title: space.name,
    color: space.color,
    collapsed: false,
  })

  let updated: Space = space
  await updateStore((s) => {
    const sp = s.spaces[space.id]
    if (!sp) return
    sp.groupId = groupId
    sp.lastActiveTabId = tab.id
    // pinnedTabs referenced tab ids that are gone with the old group.
    sp.pinnedTabs = undefined
    if (isLive(sp)) {
      // Old managedTabs are gone with the old group; the next sync will
      // refill from the source.
      sp.managedTabs = []
      sp.starterTabId = tab.id
    }
    updated = sp
  })

  if (isLive(updated)) {
    // Don't await: the sync may take several seconds (network) and the
    // caller is in the middle of a switchTo flow.
    void syncLiveSpace(updated.id)
  }
  return updated
}

export async function pinTab(tabId: number, baseUrl: string): Promise<Space | undefined> {
  let groupId: number | undefined
  try {
    const tab = await chrome.tabs.get(tabId)
    if (typeof tab.groupId === 'number') groupId = tab.groupId
  } catch {
    return undefined
  }
  if (groupId === undefined || groupId === TAB_GROUP_ID_NONE) return undefined
  const store = await loadStore()
  const space = Object.values(store.spaces).find((sp) => sp.groupId === groupId)
  if (!space) return undefined
  await updateStore((s) => {
    const sp = s.spaces[space.id]
    if (!sp) return
    if (!sp.pinnedTabs) sp.pinnedTabs = {}
    sp.pinnedTabs[tabId] = baseUrl
  })
  return space
}

export async function unpinTab(tabId: number): Promise<void> {
  await updateStore((s) => {
    for (const sp of Object.values(s.spaces)) {
      if (sp.pinnedTabs && tabId in sp.pinnedTabs) {
        delete sp.pinnedTabs[tabId]
        if (Object.keys(sp.pinnedTabs).length === 0) sp.pinnedTabs = undefined
      }
    }
  })
}

export async function resolveBaseUrl(tabId: number): Promise<string | undefined> {
  const store = await loadStore()
  for (const sp of Object.values(store.spaces)) {
    if (isLive(sp)) {
      const managed = sp.managedTabs.find((m) => m.tabId === tabId)
      if (managed) return managed.url
    }
    if (sp.pinnedTabs && tabId in sp.pinnedTabs) {
      return sp.pinnedTabs[tabId]
    }
  }
  return undefined
}

export async function resetTabToBase(tabId: number): Promise<boolean> {
  const url = await resolveBaseUrl(tabId)
  if (!url) return false
  try {
    await chrome.tabs.update(tabId, { url })
    return true
  } catch {
    return false
  }
}

export async function dropPinForTab(tabId: number): Promise<void> {
  // Same as unpinTab but reads conditionally to avoid spurious writes when
  // the closed tab was never pinned (the common case on every tab close).
  const store = await loadStore()
  const hasPin = Object.values(store.spaces).some(
    (sp) => sp.pinnedTabs && tabId in sp.pinnedTabs,
  )
  if (!hasPin) return
  await unpinTab(tabId)
}

export async function reconcilePinnedTabs(): Promise<void> {
  const allTabs = await chrome.tabs.query({})
  const liveIds = new Set(
    allTabs.map((t) => t.id).filter((id): id is number => typeof id === 'number'),
  )
  await updateStore((s) => {
    for (const sp of Object.values(s.spaces)) {
      if (!sp.pinnedTabs) continue
      for (const idStr of Object.keys(sp.pinnedTabs)) {
        if (!liveIds.has(Number(idStr))) delete sp.pinnedTabs[Number(idStr)]
      }
      if (Object.keys(sp.pinnedTabs).length === 0) sp.pinnedTabs = undefined
    }
  })
}

export async function reorderSpaces(windowId: number, orderedIds: SpaceId[]): Promise<void> {
  await updateStore((s) => {
    orderedIds.forEach((id, index) => {
      const sp = s.spaces[id]
      if (sp && sp.windowId === windowId) sp.order = index
    })
  })
}

async function safeTabGroupUpdate(
  groupId: number,
  changes: chrome.tabGroups.UpdateProperties,
): Promise<void> {
  try {
    await chrome.tabGroups.update(groupId, changes)
  } catch {
    // Group may have been removed by the user; reconcile handles cleanup.
  }
}
