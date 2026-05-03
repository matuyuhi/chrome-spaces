import {
  findSpaceByGroupId,
  pinTab,
  resetTabToBase,
  unpinTab,
} from './space-manager'
import { syncLiveSpace } from './live/sync-engine'
import { isLive, TAB_GROUP_ID_NONE } from '../shared/types'

const ITEM_PIN = 'spaces:pin-tab'
const ITEM_UNPIN = 'spaces:unpin-tab'
const ITEM_RESET = 'spaces:reset-tab'
const ITEM_SYNC_LIVE = 'spaces:sync-live'

export async function installContextMenus(): Promise<void> {
  // Re-create from scratch every install/startup so that label or order
  // changes ship without leaving stale entries behind.
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: ITEM_SYNC_LIVE,
    title: 'Sync this Live folder',
    // Chrome's contextMenus API does not actually accept a 'tab' context at
    // runtime (despite some docs suggesting it); attaching to 'page' /
    // 'frame' means the entry shows up when right-clicking the page of a
    // Live folder PR/issue. Non-live pages just no-op the click.
    contexts: ['page', 'frame'],
  })
  chrome.contextMenus.create({
    id: ITEM_PIN,
    title: 'Pin tab to current URL',
    contexts: ['page', 'frame'],
  })
  chrome.contextMenus.create({
    id: ITEM_UNPIN,
    title: 'Unpin tab',
    contexts: ['page', 'frame'],
  })
  chrome.contextMenus.create({
    id: ITEM_RESET,
    title: 'Reset tab to base URL',
    contexts: ['page', 'frame'],
  })
}

export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  if (typeof tab?.id !== 'number') return
  switch (info.menuItemId) {
    case ITEM_PIN: {
      const url = tab.url
      if (!url) return
      await pinTab(tab.id, url)
      return
    }
    case ITEM_UNPIN:
      await unpinTab(tab.id)
      return
    case ITEM_RESET:
      await resetTabToBase(tab.id)
      return
    case ITEM_SYNC_LIVE: {
      if (typeof tab.groupId !== 'number' || tab.groupId === TAB_GROUP_ID_NONE) return
      const space = await findSpaceByGroupId(tab.groupId, tab.windowId)
      if (!space || !isLive(space)) return
      await syncLiveSpace(space.id)
      return
    }
  }
}

export const _ITEM_IDS = { ITEM_PIN, ITEM_UNPIN, ITEM_RESET, ITEM_SYNC_LIVE }
