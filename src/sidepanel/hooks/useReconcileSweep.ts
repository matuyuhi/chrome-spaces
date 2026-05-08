import { useEffect } from 'react'
import { sendMessage } from '../../shared/messaging'

// Throttled reconcile in the SW (30s). Triggered on mount and whenever
// the panel regains visibility, since MV3 SWs can miss tab-close events
// while suspended and leave zombie tab refs in the store. Also refresh
// UI prefs on visibility — the options tab is a separate document and
// any change there only reaches us once the user returns.
export function useReconcileSweep(
  refresh: () => Promise<void>,
  refreshPrefs: () => Promise<void>,
): void {
  useEffect(() => {
    const sweep = () => {
      void sendMessage({ type: 'reconcile' }).then((res) => {
        if (res.dropped > 0) void refresh()
      })
      void refreshPrefs()
    }
    sweep()
    const onVisible = () => {
      if (document.visibilityState === 'visible') sweep()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh, refreshPrefs])
}
