import { t } from '../shared/i18n'
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
    title: t('ctx_syncLiveFolder'),
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_PIN,
    title: t('ctx_pinTab'),
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_UNPIN,
    title: t('ctx_unpinTab'),
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_RESET,
    title: t('ctx_resetTab'),
    contexts: ['page', 'frame'],
    documentUrlPatterns: WEB_PAGES,
  })
  chrome.contextMenus.create({
    id: ITEM_SYNC_LIVE_ACTION,
    title: t('ctx_syncLiveFolder'),
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
