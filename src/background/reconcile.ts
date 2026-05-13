import { loadStore, updateStore } from './storage'
import { pruneDeadTabs } from './space-manager'

// Drop tab refs and TabRecord entries for tabs that no longer exist.
// Called at SW startup; the store can drift if tabs were closed while the
// SW was suspended (MV3 events fired during suspension are not replayed).
// Also kicks in when a folder's items hold duplicate entries for the
// same tabId — pruneDeadTabs dedupes those alongside the dead-tab cull.
export async function reconcile(): Promise<{ dropped: number }> {
  const tabs = await chrome.tabs.query({})
  const liveIds = new Set(
    tabs.map((t) => t.id).filter((id): id is number => typeof id === 'number'),
  )
  const before = await loadStore()
  const droppedIds = new Set<number>()
  let hasDuplicate = false
  for (const id of Object.keys(before.tabs).map(Number)) {
    if (!liveIds.has(id)) droppedIds.add(id)
  }
  for (const f of Object.values(before.folders)) {
    const seen = new Set<number>()
    for (const it of f.items) {
      if (it.kind !== 'tab') continue
      if (!liveIds.has(it.tabId)) droppedIds.add(it.tabId)
      else if (seen.has(it.tabId)) hasDuplicate = true
      else seen.add(it.tabId)
    }
  }
  if (droppedIds.size === 0 && !hasDuplicate) return { dropped: 0 }
  await updateStore((s) => {
    pruneDeadTabs(s, liveIds)
  })
  return { dropped: droppedIds.size }
}

// Throttled wrapper for the side panel to call on mount / focus without
// risking a reconcile per refresh. 30s window picked so user-initiated
// "I just opened the panel" cleanups still feel snappy while the SW
// doesn't churn through chrome.tabs.query on every storage refresh.
const RECONCILE_MIN_INTERVAL_MS = 30_000
let lastReconcileAt = 0

export async function reconcileIfStale(): Promise<{ dropped: number }> {
  const now = Date.now()
  if (now - lastReconcileAt < RECONCILE_MIN_INTERVAL_MS) {
    return { dropped: 0 }
  }
  lastReconcileAt = now
  return reconcile()
}
