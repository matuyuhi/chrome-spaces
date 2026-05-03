import {
  onTabActivated,
  onTabAttached,
  onTabCreated,
  onTabRemoved,
} from './handlers'
import { handleCommand, resolveWindowId } from './commands'
import {
  createFolder,
  createSpace,
  deleteFolder,
  deleteSpace,
  importChromeTabGroups,
  moveItem,
  pinTab,
  renameFolder,
  renameSpace,
  reorderSpaces,
  resetTabToBase,
  setFolderCollapsed,
  setFolderEmoji,
  setSpaceColor,
  setSpaceEmoji,
  switchTo,
  unpinTab,
  updateLiveFolder,
} from './space-manager'
import { handleAlarm, reconcileAlarms } from './live/alarms'
import { syncLiveFolder } from './live/sync-engine'
import { handleContextMenuClick, installContextMenus } from './context-menus'
import { reconcile } from './reconcile'
import { loadStore, migrateIfNeeded } from './storage'
import { getGitHubToken, setGitHubToken } from './secret-storage'
import { type Message, type MessageResponse } from '../shared/messaging'

async function bootstrap(): Promise<void> {
  await migrateIfNeeded()
  await reconcile()
  await reconcileAlarms()
  await installContextMenus()
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Spaces] installed', details.reason)
  void bootstrap()
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[Spaces] startup')
  void bootstrap()
})

// Open the side panel when the user clicks the toolbar icon.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.error('[Spaces] setPanelBehavior failed', e))
})

chrome.alarms.onAlarm.addListener(handleAlarm)

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  void (async () => {
    try {
      const data = await handleMessage(msg)
      const response: MessageResponse = { ok: true, data }
      sendResponse(response)
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      console.error('[Spaces] message handler error', msg, e)
      const response: MessageResponse = { ok: false, error }
      sendResponse(response)
    }
  })()
  return true
})

async function handleMessage(msg: Message): Promise<unknown> {
  switch (msg.type) {
    case 'getStore':
      return loadStore()
    case 'createSpace':
      return createSpace(msg.payload)
    case 'importChromeTabGroups':
      return importChromeTabGroups(msg.windowId)
    case 'renameSpace':
      return renameSpace(msg.spaceId, msg.name)
    case 'setSpaceColor':
      return setSpaceColor(msg.spaceId, msg.color)
    case 'setSpaceEmoji':
      return setSpaceEmoji(msg.spaceId, msg.emoji)
    case 'deleteSpace':
      return deleteSpace(msg.spaceId, { closeTabs: msg.closeTabs })
    case 'reorderSpaces':
      return reorderSpaces(msg.windowId, msg.orderedIds)
    case 'switchTo':
      return switchTo(msg.spaceId, msg.windowId)
    case 'createFolder':
      return createFolder(msg.payload)
    case 'renameFolder':
      return renameFolder(msg.folderId, msg.name)
    case 'setFolderEmoji':
      return setFolderEmoji(msg.folderId, msg.emoji)
    case 'setFolderCollapsed':
      return setFolderCollapsed(msg.folderId, msg.collapsed)
    case 'deleteFolder':
      return deleteFolder(msg.folderId, { closeTabs: msg.closeTabs })
    case 'updateLiveFolder':
      return updateLiveFolder(msg.folderId, {
        source: msg.source,
        refreshIntervalMin: msg.refreshIntervalMin,
      })
    case 'syncLiveFolder':
      return syncLiveFolder(msg.folderId)
    case 'moveItem':
      return moveItem({ item: msg.item, toFolderId: msg.toFolderId, toIndex: msg.toIndex })
    case 'pinTab':
      return pinTab(msg.tabId, msg.baseUrl)
    case 'unpinTab':
      return unpinTab(msg.tabId)
    case 'resetTab':
      return resetTabToBase(msg.tabId)
    case 'closeTab':
      return chrome.tabs.remove(msg.tabId)
    case 'activateTab':
      return chrome.tabs.update(msg.tabId, { active: true })
    case 'getGitHubToken':
      return { hasToken: !!(await getGitHubToken()) }
    case 'setGitHubToken':
      return setGitHubToken(msg.token)
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  void (async () => {
    const windowId = await resolveWindowId(tab)
    if (windowId !== undefined) await handleCommand(command, windowId)
  })()
})

chrome.tabs.onCreated.addListener((tab) => {
  void onTabCreated(tab)
})

chrome.tabs.onActivated.addListener((info) => {
  void onTabActivated(info)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void onTabRemoved(tabId)
})

chrome.tabs.onAttached.addListener((tabId, info) => {
  void onTabAttached(tabId, info)
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab)
})
