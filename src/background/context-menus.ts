import {
  pinTab,
  resetTabToBase,
  unpinTab,
  walkFolders,
} from './space-manager'
import { syncLiveFolder } from './live/sync-engine'
import { loadStore } from './storage'

const ITEM_PIN = 'spaces:pin-tab'
const ITEM_UNPIN = 'spaces:unpin-tab'
const ITEM_RESET = 'spaces:reset-tab'
const ITEM_SYNC_LIVE = 'spaces:sync-live'
const ITEM_SYNC_LIVE_ACTION = 'spaces:sync-live-action'

const WEB_PAGES = ['http://*/*', 'https://*/*']

export async function installContextMenus(): Promise<void> {
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: ITEM_SYNC_LIVE,
    title: 'Sync this Live folder',
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_PIN,
    title: 'Pin tab to current URL',
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_UNPIN,
    title: 'Unpin tab',
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_RESET,
    title: 'Reset tab to base URL',
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_SYNC_LIVE_ACTION,
    title: 'Sync this Live folder',
    contexts: ['action'],
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
    case ITEM_SYNC_LIVE:
    case ITEM_SYNC_LIVE_ACTION: {
      const folderId = await findLiveFolderForTab(tab.id)
      if (folderId) await syncLiveFolder(folderId)
      return
    }
  }
}

async function findLiveFolderForTab(tabId: number): Promise<string | undefined> {
  const store = await loadStore()
  for (const sp of Object.values(store.spaces)) {
    for (const folder of walkFolders(store, sp.rootFolderId)) {
      if (!folder.live) continue
      if (folder.live.managedTabs.some((m) => m.tabId === tabId)) return folder.id
    }
  }
  return undefined
}

export const _ITEM_IDS = {
  ITEM_PIN,
  ITEM_UNPIN,
  ITEM_RESET,
  ITEM_SYNC_LIVE,
  ITEM_SYNC_LIVE_ACTION,
}
