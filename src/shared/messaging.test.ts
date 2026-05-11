import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { sendMessage } from './messaging'

describe('sendMessage', () => {
  beforeEach(() => {
    // Setup minimal chrome mock for runtime.sendMessage
    ;(globalThis as any).chrome = {
      runtime: {
        sendMessage: vi.fn(),
      },
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves with data when response is ok', async () => {
    const mockData = { id: 'sp1', name: 'My Space' }
    ;(globalThis as any).chrome.runtime.sendMessage.mockResolvedValue({
      ok: true,
      data: mockData,
    })

    const result = await sendMessage({ type: 'getStore' } as any)
    expect(result).toEqual(mockData)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getStore' })
  })

  it('rejects with error when response is not ok', async () => {
    ;(globalThis as any).chrome.runtime.sendMessage.mockResolvedValue({
      ok: false,
      error: 'Something went wrong',
    })

    await expect(sendMessage({ type: 'getStore' } as any)).rejects.toThrow(
      'Something went wrong',
    )
  })

  it('rejects when response is undefined', async () => {
    ;(globalThis as any).chrome.runtime.sendMessage.mockResolvedValue(undefined)

    await expect(sendMessage({ type: 'getStore' } as any)).rejects.toThrow(
      'No response from background',
    )
  })
})
