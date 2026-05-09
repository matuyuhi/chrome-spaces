import { useEffect } from 'react'

// The chrome.tabs.onRemoved listener in `useTabEventListeners` fires in
// the side panel context concurrently with the SW's `onTabRemoved →
// dropTab`. The panel's refresh races the SW's storage write — when
// refresh wins, it sees the *pre-drop* store and renders a phantom
// "missing tab" row that only goes away on the next interaction.
//
// Subscribing to `chrome.storage.onChanged` for the spaceStore key
// guarantees a follow-up refresh after the SW's write lands, so the
// stale row is cleared without any user action.
export function useStoreChangeListener(refresh: () => Promise<void>): void {
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local') return
      if ('spaceStore' in changes) void refresh()
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [refresh])
}
