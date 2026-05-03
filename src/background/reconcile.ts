import { loadStore, updateStore } from './storage'
import { pruneDeadTabs } from './space-manager'

// Drop tab refs and TabRecord entries for tabs that no longer exist.
// Called at SW startup; the store can drift if tabs were closed while the
// SW was suspended.
export async function reconcile(): Promise<void> {
  const tabs = await chrome.tabs.query({})
  const liveIds = new Set(
    tabs.map((t) => t.id).filter((id): id is number => typeof id === 'number'),
  )
  const store = await loadStore()
  const wouldChange = pruneDeadTabs(structuredClone(store), liveIds)
  if (!wouldChange) return
  await updateStore((s) => {
    pruneDeadTabs(s, liveIds)
  })
}
