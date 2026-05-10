// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReconcileSweep } from './useReconcileSweep'
import * as messaging from '../../shared/messaging'

describe('useReconcileSweep', () => {
  const refresh = vi.fn().mockResolvedValue(undefined)
  const refreshPrefs = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(messaging, 'sendMessage').mockResolvedValue({ dropped: 0 } as any)
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    })
  })

  it('triggers sweep on mount', async () => {
    renderHook(() => useReconcileSweep(refresh, refreshPrefs))

    expect(messaging.sendMessage).toHaveBeenCalledWith({ type: 'reconcile' })
    expect(refreshPrefs).toHaveBeenCalled()

    // dropped = 0, so refresh should not be called
    await waitFor(() => {
      expect(refresh).not.toHaveBeenCalled()
    })
  })

  it('calls refresh if dropped > 0', async () => {
    vi.spyOn(messaging, 'sendMessage').mockResolvedValue({ dropped: 1 } as any)

    renderHook(() => useReconcileSweep(refresh, refreshPrefs))

    await waitFor(() => {
      expect(refresh).toHaveBeenCalled()
    })
  })

  it('triggers sweep on visibilitychange to visible', async () => {
    const { unmount } = renderHook(() => useReconcileSweep(refresh, refreshPrefs))

    expect(messaging.sendMessage).toHaveBeenCalledTimes(1)
    expect(refreshPrefs).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()

    // Change visibility to hidden and trigger event
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(messaging.sendMessage).not.toHaveBeenCalled()

    // Change visibility to visible and trigger event
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(messaging.sendMessage).toHaveBeenCalledWith({ type: 'reconcile' })
    expect(refreshPrefs).toHaveBeenCalledTimes(1)
  })

  it('cleans up event listener on unmount', async () => {
    const { unmount } = renderHook(() => useReconcileSweep(refresh, refreshPrefs))
    vi.clearAllMocks()

    unmount()

    document.dispatchEvent(new Event('visibilitychange'))

    expect(messaging.sendMessage).not.toHaveBeenCalled()
  })
})
