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
