import {
  dropPinForTab,
  findSpaceByGroupId,
  getActiveSpace,
  setLastActiveTab,
  switchTo,
} from './space-manager'
import { updateStore } from './storage'
import { TAB_GROUP_ID_NONE } from '../shared/types'
import { isAutoGroupingPaused, isStarterTab } from './inflight'

export async function onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') return
  if (isAutoGroupingPaused()) return
  if (isStarterTab(tab.id)) return
  if (tab.groupId !== undefined && tab.groupId !== TAB_GROUP_ID_NONE) return

  const active = await getActiveSpace(tab.windowId)
  if (!active || active.groupId === TAB_GROUP_ID_NONE) return
  if (active.kind === 'live') return

  try {
    await chrome.tabs.group({ tabIds: [tab.id], groupId: active.groupId })
  } catch {
    // Group may have been removed concurrently; reconcile handles it.
  }
}

export async function onTabActivated(info: chrome.tabs.TabActiveInfo): Promise<void> {
  await setLastActiveTab(info.windowId, info.tabId)
}

export async function onTabGroupUpdated(group: chrome.tabGroups.TabGroup): Promise<void> {
  const space = await findSpaceByGroupId(group.id, group.windowId)
  if (!space) return

  const titleChanged = typeof group.title === 'string' && space.name !== group.title
  const colorChanged = !!group.color && space.color !== group.color

  if (titleChanged || colorChanged) {
    await updateStore((s) => {
      const sp = s.spaces[space.id]
      if (!sp) return
      if (titleChanged) sp.name = group.title!
      if (colorChanged) sp.color = group.color
    })
  }

  if (group.collapsed === false) {
    const active = await getActiveSpace(group.windowId)
    if (active?.id !== space.id) await switchTo(space.id, group.windowId)
  }
}

export async function onTabRemoved(tabId: number): Promise<void> {
  await dropPinForTab(tabId)
}

export async function onTabGroupRemoved(group: chrome.tabGroups.TabGroup): Promise<void> {
  const space = await findSpaceByGroupId(group.id, group.windowId)
  if (!space) return
  await updateStore((s) => {
    const sp = s.spaces[space.id]
    if (sp) sp.groupId = TAB_GROUP_ID_NONE
  })
}
