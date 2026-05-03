// Tabs that the extension itself just created and is in the middle of
// grouping. Listeners check this set to avoid auto-claiming the tab into
// a different Space before grouping completes.
const starterTabs = new Set<number>()

export function markStarterTab(tabId: number): void {
  starterTabs.add(tabId)
}

export function unmarkStarterTab(tabId: number): void {
  starterTabs.delete(tabId)
}

export function isStarterTab(tabId: number): boolean {
  return starterTabs.has(tabId)
}

// Counter that pauses auto-grouping in onTabCreated. createStaticSpace /
// createLiveSpace bump this around tabs.create so the in-flight starter
// tab is not stolen into the previously-active group before we create
// its real one. The starter-tab Set is a backup for any racy events.
let autoGroupingPauseCount = 0

export function pauseAutoGrouping(): void {
  autoGroupingPauseCount++
}

export function resumeAutoGrouping(): void {
  if (autoGroupingPauseCount > 0) autoGroupingPauseCount--
}

export function isAutoGroupingPaused(): boolean {
  return autoGroupingPauseCount > 0
}

// Creates a tab and adds it to the given Tab Group, with auto-grouping
// paused for the duration so chrome.tabs.onCreated cannot route the tab
// into the currently-active Space's group before our group call lands.
// Use this for every extension-initiated tab creation that targets an
// existing group (sync-engine.applyDiff, future popup actions, etc.).
export async function createTabInExistingGroup(
  props: chrome.tabs.CreateProperties,
  groupId: number,
): Promise<chrome.tabs.Tab | undefined> {
  pauseAutoGrouping()
  try {
    const tab = await chrome.tabs.create(props)
    if (typeof tab.id !== 'number') return undefined
    markStarterTab(tab.id)
    try {
      await chrome.tabs.group({ tabIds: [tab.id], groupId })
    } finally {
      unmarkStarterTab(tab.id)
    }
    return tab
  } finally {
    resumeAutoGrouping()
  }
}

// Creates a tab and starts a fresh Tab Group seeded with it. Returns the
// tab + the new groupId. Same auto-grouping race protection as
// createTabInExistingGroup; use this for createStaticSpace / createLiveSpace
// / rehydrate.
export async function createTabAsGroupSeed(
  props: chrome.tabs.CreateProperties,
): Promise<{ tab: chrome.tabs.Tab; groupId: number } | undefined> {
  pauseAutoGrouping()
  try {
    const tab = await chrome.tabs.create(props)
    if (typeof tab.id !== 'number') return undefined
    markStarterTab(tab.id)
    try {
      const groupId = await chrome.tabs.group({
        createProperties: { windowId: props.windowId },
        tabIds: [tab.id],
      })
      return { tab, groupId }
    } finally {
      unmarkStarterTab(tab.id)
    }
  } finally {
    resumeAutoGrouping()
  }
}
