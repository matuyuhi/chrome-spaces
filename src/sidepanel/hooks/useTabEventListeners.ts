import { useEffect } from 'react'

// Refresh on every chrome.tabs.* event so the panel mirrors the browser
// state. Multiple events can fire in a single tick (close, switch, etc.) —
// `refresh` is idempotent so duplicate calls just coalesce.
export function useTabEventListeners(refresh: () => Promise<void>): void {
  useEffect(() => {
    const listener = () => void refresh()
    chrome.tabs.onCreated.addListener(listener)
    chrome.tabs.onRemoved.addListener(listener)
    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.onActivated.addListener(listener)
    chrome.tabs.onMoved.addListener(listener)
    return () => {
      chrome.tabs.onCreated.removeListener(listener)
      chrome.tabs.onRemoved.removeListener(listener)
      chrome.tabs.onUpdated.removeListener(listener)
      chrome.tabs.onActivated.removeListener(listener)
      chrome.tabs.onMoved.removeListener(listener)
    }
  }, [refresh])
}
