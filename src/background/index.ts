import {
  onTabCreated,
  onTabActivated,
  onTabGroupUpdated,
  onTabGroupRemoved,
} from './handlers'
import { handleCommand, resolveWindowId } from './commands'
import {
  createLiveSpace,
  createStaticSpace,
  deleteSpace,
  getActiveSpace,
  listSpaces,
  renameSpace,
  reorderSpaces,
  setSpaceColor,
  setSpaceEmoji,
  switchTo,
} from './space-manager'
import { syncLiveSpace } from './live/sync-engine'
import { getGitHubToken, setGitHubToken } from './secret-storage'
import { type Message, type MessageResponse } from '../shared/messaging'

import { reconcile } from './reconcile'
import { handleAlarm, reconcileAlarms } from './live/alarms'

async function bootstrap(adopt: boolean): Promise<void> {
  await reconcile({ adoptExistingGroups: adopt })
  await reconcileAlarms()
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Spaces] installed', details.reason)
  void bootstrap(details.reason === 'install')
})

chrome.runtime.onStartup.addListener(() => {
  console.log('[Spaces] startup')
  void bootstrap(false)
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
  console.log('[Spaces] message', msg.type)
  switch (msg.type) {
    case 'createStatic':
      return createStaticSpace(msg.payload)
    case 'createLive':
      return createLiveSpace(msg.payload)
    case 'syncLive':
      return syncLiveSpace(msg.spaceId)
    case 'listSpaces':
      return listSpaces(msg.windowId)
    case 'getActiveSpace':
      return getActiveSpace(msg.windowId)
    case 'switchTo':
      return switchTo(msg.spaceId, msg.windowId)
    case 'deleteSpace':
      return deleteSpace(msg.spaceId, { closeTabs: msg.closeTabs })
    case 'renameSpace':
      return renameSpace(msg.spaceId, msg.name)
    case 'setSpaceColor':
      return setSpaceColor(msg.spaceId, msg.color)
    case 'getGitHubToken':
      return { hasToken: !!(await getGitHubToken()) }
    case 'setGitHubToken':
      return setGitHubToken(msg.token)
    case 'reorderSpaces':
      return reorderSpaces(msg.windowId, msg.orderedIds)
    case 'setSpaceEmoji':
      return setSpaceEmoji(msg.spaceId, msg.emoji)
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

chrome.tabGroups.onUpdated.addListener((group) => {
  void onTabGroupUpdated(group)
})

chrome.tabGroups.onRemoved.addListener((group) => {
  void onTabGroupRemoved(group)
})
