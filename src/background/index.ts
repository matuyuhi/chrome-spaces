import {
  onTabActivated,
  onTabAttached,
  onTabCreated,
  onTabRemoved,
  onWindowRemoved,
} from './handlers'
import { handleCommand, resolveWindowId } from './commands'
import {
  addTabsToFolder,
  createFolder,
  createSpace,
  deleteFolder,
  deleteSpace,
  importChromeTabGroups,
  importStore,
  moveItem,
  pinTab,
  reattachOrphanSpaces,
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
import {
  DEFAULT_GITHUB_API_BASE,
  getGitHubApiBaseUrl,
  getGitHubClientId,
  getGitHubOauthToken,
  getGitHubPat,
  getGitHubToken,
  getPreferredAuth,
  setGitHubApiBaseUrl,
  setGitHubClientId,
  setGitHubOauthToken,
  setGitHubPat,
  setPreferredAuth,
} from './secret-storage'
import { BUILTIN_GITHUB_CLIENT_ID, pollDeviceFlow, startDeviceFlow } from './oauth'
import { getUIPrefs, setUIPrefs } from './ui-prefs'
import { ensureAutoArchiveAlarm } from './auto-archive'
import { type Message, type MessageResponse } from '../shared/messaging'

async function bootstrap(): Promise<void> {
  await migrateIfNeeded()
  await reattachOrphanSpaces()
  await reconcile()
  await reconcileAlarms()
  await ensureAutoArchiveAlarm()
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
    case 'addTabsToFolder':
      return addTabsToFolder(msg.folderId, msg.tabIds)
    case 'importStore':
      return importStore(msg.store, msg.currentWindowId)
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
    case 'getGitHubAuthState': {
      const [oauth, pat, preferred, active] = await Promise.all([
        getGitHubOauthToken(),
        getGitHubPat(),
        getPreferredAuth(),
        // Walk getGitHubToken's resolution to learn which slot it picks.
        (async () => {
          const tok = await getGitHubToken()
          if (!tok) return undefined
          if (tok === (await getGitHubOauthToken())) return 'oauth' as const
          return 'pat' as const
        })(),
      ])
      return {
        hasOauth: !!oauth,
        hasPat: !!pat,
        preferred,
        active,
      }
    }
    case 'setGitHubPat':
      return setGitHubPat(msg.token)
    case 'clearGitHubOauthToken':
      return setGitHubOauthToken(undefined)
    case 'setPreferredAuth':
      return setPreferredAuth(msg.method)
    case 'getGitHubApiBaseUrl': {
      const url = await getGitHubApiBaseUrl()
      return { url, isCustom: url !== DEFAULT_GITHUB_API_BASE }
    }
    case 'setGitHubApiBaseUrl':
      return setGitHubApiBaseUrl(msg.url)
    case 'getGitHubClientId':
      return {
        hasOverride: !!(await getGitHubClientId()),
        hasBuiltin: !!BUILTIN_GITHUB_CLIENT_ID,
      }
    case 'setGitHubClientId':
      return setGitHubClientId(msg.clientId)
    case 'startGitHubOAuth':
      return startDeviceFlow()
    case 'pollGitHubOAuth':
      return pollDeviceFlow(msg.deviceCode)
    case 'getUIPrefs':
      return getUIPrefs()
    case 'setUIPrefs': {
      const before = await getUIPrefs()
      await setUIPrefs(msg.prefs)
      const after = await getUIPrefs()
      if (before.autoArchiveDays !== after.autoArchiveDays) {
        await ensureAutoArchiveAlarm()
      }
      return undefined
    }
    case 'openCommandBar':
      // Background → side panel broadcast; the side panel handles it.
      return undefined
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

chrome.windows.onRemoved.addListener((windowId) => {
  void onWindowRemoved(windowId)
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab)
})
