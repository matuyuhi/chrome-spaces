import { describe, expect, it, vi } from 'vitest'
import { dispatchFetch } from './index'
import { type FetchContext } from './types'
import { type LiveSource } from '../../../shared/types'

// Mock the adapters directly to test dispatch logic without invoking the actual adapters
vi.mock('./github', () => ({
  githubAdapter: {
    fetch: vi.fn().mockResolvedValue({ notModified: false, items: [] }),
  },
}))
vi.mock('./rss', () => ({
  rssAdapter: {
    fetch: vi.fn().mockResolvedValue({ notModified: false, items: [] }),
  },
}))

import { githubAdapter } from './github'
import { rssAdapter } from './rss'

describe('dispatchFetch', () => {
  const mockCtx: FetchContext = {
    fetch: vi.fn(),
  }

  it('delegates github-prs source to githubAdapter', async () => {
    const source: LiveSource = {
      type: 'github-prs',
      preset: 'review-requested',
    }

    await dispatchFetch(source, mockCtx)
    expect(githubAdapter.fetch).toHaveBeenCalledWith(source, mockCtx)
    expect(rssAdapter.fetch).not.toHaveBeenCalled()
  })

  it('delegates github-issues source to githubAdapter', async () => {
    const source: LiveSource = {
      type: 'github-issues',
      preset: 'assigned',
    }

    vi.clearAllMocks()
    await dispatchFetch(source, mockCtx)
    expect(githubAdapter.fetch).toHaveBeenCalledWith(source, mockCtx)
    expect(rssAdapter.fetch).not.toHaveBeenCalled()
  })

  it('delegates rss source to rssAdapter', async () => {
    const source: LiveSource = {
      type: 'rss',
      url: 'https://example.com/feed.xml',
    }

    vi.clearAllMocks()
    await dispatchFetch(source, mockCtx)
    expect(rssAdapter.fetch).toHaveBeenCalledWith(source, mockCtx)
    expect(githubAdapter.fetch).not.toHaveBeenCalled()
  })

  it('throws an error for an unknown live source type', async () => {
    const invalidSource = {
      type: 'unknown-type',
    } as unknown as LiveSource

    await expect(dispatchFetch(invalidSource, mockCtx)).rejects.toThrowError(
      'No adapter for live source type: unknown-type',
    )
  })
})
