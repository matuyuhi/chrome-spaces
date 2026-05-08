import { useCallback, useState } from 'react'
import {
  DEFAULT_UI_PREFS,
  sendMessage,
  type UIPreferences,
} from '../../shared/messaging'
import { type SpaceStore } from '../../shared/types'
import { type TabInfo } from '../dnd'
import { applyFontSize } from '../theme'

export interface StoreData {
  windowId: number | undefined
  store: SpaceStore | undefined
  tabs: Record<number, TabInfo>
  prefs: UIPreferences
  tabGroupCount: number
  error: string | undefined
  refresh: () => Promise<void>
  refreshPrefs: () => Promise<void>
  onError: (e: unknown) => void
  clearError: () => void
}

// Owns the panel's data: SpaceStore, the live tab map for the current
// window, UI preferences, and any surfaced error string. Side-effect
// scheduling (visibility sweep, tab event listeners) lives in App.tsx —
// this hook only exposes the imperatives.
export function useStoreData(): StoreData {
  const [windowId, setWindowId] = useState<number | undefined>()
  const [store, setStore] = useState<SpaceStore | undefined>()
  const [tabs, setTabs] = useState<Record<number, TabInfo>>({})
  const [prefs, setPrefs] = useState<UIPreferences>(DEFAULT_UI_PREFS)
  const [tabGroupCount, setTabGroupCount] = useState(0)
  const [error, setError] = useState<string | undefined>()

  const onError = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    [],
  )

  const refresh = useCallback(async () => {
    try {
      const win = await chrome.windows.getCurrent()
      if (typeof win.id !== 'number') return
      setWindowId(win.id)
      const next = await sendMessage({ type: 'getStore' })
      setStore(next)
      const winTabs = await chrome.tabs.query({ windowId: win.id })
      const map: Record<number, TabInfo> = {}
      for (const t of winTabs) {
        if (typeof t.id !== 'number') continue
        map[t.id] = {
          id: t.id,
          title: t.title ?? '',
          url: t.url ?? '',
          favIconUrl: t.favIconUrl,
          hidden: (t as { hidden?: boolean }).hidden ?? false,
          active: t.active ?? false,
        }
      }
      setTabs(map)
      try {
        const groups = await chrome.tabGroups.query({ windowId: win.id })
        setTabGroupCount(groups.length)
      } catch {
        setTabGroupCount(0)
      }
    } catch (e) {
      onError(e)
    }
  }, [onError])

  const refreshPrefs = useCallback(async () => {
    const next = await sendMessage({ type: 'getUIPrefs' })
    applyFontSize(next.fontSize)
    setPrefs(next)
  }, [])

  const clearError = useCallback(() => setError(undefined), [])

  return {
    windowId,
    store,
    tabs,
    prefs,
    tabGroupCount,
    error,
    refresh,
    refreshPrefs,
    onError,
    clearError,
  }
}
