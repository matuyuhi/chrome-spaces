import { dropTab, registerTab, setLastActiveTab } from './space-manager'

export async function onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  await registerTab(tab)
}

export async function onTabActivated(info: chrome.tabs.TabActiveInfo): Promise<void> {
  await setLastActiveTab(info.windowId, info.tabId)
}

export async function onTabRemoved(tabId: number): Promise<void> {
  await dropTab(tabId)
}

export async function onTabAttached(
  tabId: number,
  info: chrome.tabs.TabAttachInfo,
): Promise<void> {
  // Tab moved to a different window. Re-register so its windowId is fresh.
  try {
    const tab = await chrome.tabs.get(tabId)
    if (typeof tab.id === 'number' && tab.windowId === info.newWindowId) {
      await registerTab(tab)
    }
  } catch {
    /* tab gone */
  }
}
