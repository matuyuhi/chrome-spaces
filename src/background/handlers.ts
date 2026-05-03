import { dropTab, registerTab, setLastActiveTab } from './space-manager'
import { updateStore } from './storage'

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

// When a Chrome window closes, the Space records that lived in it become
// orphaned — their windowId no longer points at any real window. Don't
// delete: that would lose the user's setup on every Chrome restart
// (every window fires onRemoved during shutdown). Just clear the
// per-window active pointer; bootstrap's reattachOrphanSpaces() rehomes
// the Spaces to a live window the next time the SW spins up.
export async function onWindowRemoved(windowId: number): Promise<void> {
  await updateStore((s) => {
    delete s.activeSpaceByWindow[windowId]
  })
}
