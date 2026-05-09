import {
  onTabActivated,
  onTabAttached,
  onTabCreated,
  onTabRemoved,
  onTabUpdated,
  onWindowRemoved,
} from './handlers'
import { handleCommand, resolveWindowId } from './commands'
import {
  addTabsToFolder,
  createFolder,
  createSpace,
  deleteFolder,
  deleteSpace,
  dropTab,
  importChromeTabGroups,
  importStore,
  materializeLiveTab,
  moveItem,
  pinTab,
  pinUrl,
  reattachOrphanSpaces,
  renameFolder,
  renameSpace,
  reorderPinnedUrls,
  reorderSpaces,
  resetTabToBase,
  setFolderCollapsed,
  setFolderEmoji,
  setSpaceColor,
  setSpaceEmoji,
  switchTo,
  unpinTab,
  unpinUrl,
  updateLiveFolder,
  validateLiveTabIds,
} from './space-manager'
import { handleAlarm, reconcileAlarms } from './live/alarms'
import { syncLiveFolder } from './live/sync-engine'
import { handleContextMenuClick, installContextMenus } from './context-menus'
import { reconcile, reconcileIfStale } from './reconcile'
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
import {
  clearUndoStack,
  findWindowIdForFolder,
  findWindowIdForItem,
  peekUndo,
  popUndoIfKind,
  recordCloseTab,
  recordDeleteFolder,
  recordDeleteSpace,
  recordMoveItem,
  undo,
} from './undo'
import { type Message, type MessageResponse } from '../shared/messaging'

async function bootstrap(): Promise<void> {
  await migrateIfNeeded()
  await reattachOrphanSpaces()
  await reconcile()
  await validateLiveTabIds()
  await reconcileAlarms()
  await ensureAutoArchiveAlarm()
  await installContextMenus()
}

chrome.runtime.onInstalled.addListener(() => {
  void bootstrap()
})

chrome.runtime.onStartup.addListener(() => {
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
    case 'deleteSpace': {
      const _store = await loadStore()
      const _sp = _store.spaces[msg.spaceId]
      if (_sp) {
        const _wid0 = _sp.windowId
        try {
          await recordDeleteSpace(msg.spaceId, msg.closeTabs, _wid0)
        } catch (e) {
          console.error('[Spaces] undo record failed', e)
        }
      }
      return deleteSpace(msg.spaceId, { closeTabs: msg.closeTabs })
    }
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
    case 'deleteFolder': {
      const _store2 = await loadStore()
      const _folder = _store2.folders[msg.folderId]
      if (_folder && !_folder.live) {
        const _wid = findWindowIdForFolder(_store2, msg.folderId)
        if (typeof _wid === 'number') {
          try {
            await recordDeleteFolder(msg.folderId, msg.closeTabs, _wid)
          } catch (e) {
            console.error('[Spaces] undo record failed', e)
          }
        }
      }
      return deleteFolder(msg.folderId, { closeTabs: msg.closeTabs })
    }
    case 'updateLiveFolder':
      return updateLiveFolder(msg.folderId, {
        source: msg.source,
        refreshIntervalMin: msg.refreshIntervalMin,
      })
    case 'syncLiveFolder':
      return syncLiveFolder(msg.folderId)
    case 'materializeLiveTab':
      return materializeLiveTab(msg.folderId, msg.externalId)
    case 'moveItem': {
      const _store3 = await loadStore()
      const _wid2 = findWindowIdForItem(_store3, msg.item)
      if (typeof _wid2 === 'number') {
        try {
          await recordMoveItem(msg.item, _wid2)
        } catch (e) {
          console.error('[Spaces] undo record failed', e)
        }
      }
      return moveItem({ item: msg.item, toFolderId: msg.toFolderId, toIndex: msg.toIndex })
    }
    case 'pinTab':
      return pinTab(msg.tabId, msg.baseUrl)
    case 'unpinTab':
      return unpinTab(msg.tabId)
    case 'resetTab':
      return resetTabToBase(msg.tabId)
    case 'closeTab': {
      const _tabInfo = await chrome.tabs.get(msg.tabId).catch(() => undefined)
      if (_tabInfo && typeof _tabInfo.windowId === 'number') {
        const _wid = _tabInfo.windowId
        // Snapshot undo BEFORE remove — recordCloseTab needs the still-
        // present folder location and chrome.tabs.get to succeed. If
        // remove fails, roll the entry back so it doesn't refer to a
        // tab that's still alive (which would duplicate on undo).
        try {
          await recordCloseTab(msg.tabId, _wid)
        } catch (e) {
          console.error('[Spaces] undo record failed', e)
        }
        try {
          await chrome.tabs.remove(msg.tabId)
          return
        } catch (e) {
          console.warn('[Spaces] chrome.tabs.remove failed; dropping ref', msg.tabId, e)
          popUndoIfKind(_wid, 'close-tab')
        }
      }
      // Either chrome.tabs.get failed (zombie reference left over from
      // an SW suspension that missed onTabRemoved, or a stale tabId from
      // a botched import) or remove failed. Drop the ref so the X button
      // always succeeds from the user's POV.
      await dropTab(msg.tabId)
      return
    }
    case 'activateTab':
      return chrome.tabs.update(msg.tabId, { active: true })
    case 'reconcile':
      return reconcileIfStale()
    case 'pinUrl':
      return pinUrl(msg.spaceId, { url: msg.url, title: msg.title, favIconUrl: msg.favIconUrl })
    case 'unpinUrl':
      return unpinUrl(msg.spaceId, msg.pinnedId)
    case 'reorderPinnedUrls':
      return reorderPinnedUrls(msg.spaceId, msg.orderedIds)
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
    case 'undo':
      return undo(msg.windowId)
    case 'peekUndo':
      return peekUndo(msg.windowId)
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  void onTabUpdated(tabId, changeInfo, tab)
})

chrome.windows.onRemoved.addListener((windowId) => {
  clearUndoStack(windowId)
  void onWindowRemoved(windowId)
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab)
})
