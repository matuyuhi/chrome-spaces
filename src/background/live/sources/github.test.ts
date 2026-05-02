import { describe, it, expect, vi } from 'vitest'
import { buildQuery, parseItem, fetchPullRequests, GitHubError } from './github'

describe('buildQuery', () => {
  it('builds review-requested query with @me default', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'review-requested' })).toBe(
      'is:pr is:open review-requested:@me',
    )
  })

  it('builds assigned query with explicit user', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'assigned', user: 'octocat' })).toBe(
      'is:pr is:open assignee:octocat',
    )
  })

  it('builds authored query', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'authored' })).toBe(
      'is:pr is:open author:@me',
    )
  })

  it('passes custom query verbatim', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'custom', query: 'org:foo bar' })).toBe(
      'org:foo bar',
    )
  })

  it('treats blank user as @me', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'assigned', user: '   ' })).toBe(
      'is:pr is:open assignee:@me',
    )
  })
})

describe('parseItem', () => {
  it('extracts repo and number from URL', () => {
    const ref = parseItem({
      html_url: 'https://github.com/octo/repo/pull/42',
      title: 'Fix bug',
      number: 42,
      state: 'open',
      draft: false,
      updated_at: '2026-01-01T00:00:00Z',
    })
    expect(ref).toEqual({
      externalId: 'octo/repo#42',
      url: 'https://github.com/octo/repo/pull/42',
      title: 'Fix bug',
      number: 42,
      repo: 'octo/repo',
      state: 'open',
      isDraft: false,
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('falls back to non-draft when draft is missing', () => {
    const ref = parseItem({
      html_url: 'https://github.com/a/b/pull/1',
      title: 't',
      number: 1,
      state: 'open',
      updated_at: '2026-01-01T00:00:00Z',
    })
    expect(ref.isDraft).toBe(false)
  })

  it('throws on a non-PR URL', () => {
    expect(() =>
      parseItem({
        html_url: 'https://github.com/a/b/issues/1',
        title: 't',
        number: 1,
        state: 'open',
        updated_at: '',
      }),
    ).toThrow()
  })
})

describe('fetchPullRequests', () => {
  it('calls the search/issues endpoint with the right headers and query', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              html_url: 'https://github.com/x/y/pull/9',
              title: 'PR',
              number: 9,
              state: 'open',
              draft: false,
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        }),
        { status: 200 },
      ),
    )
    const result = await fetchPullRequests(
      { type: 'github-prs', preset: 'review-requested' },
      'ghp_test',
      fetchSpy,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.externalId).toBe('x/y#9')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('api.github.com/search/issues')
    expect(call[0]).toContain(encodeURIComponent('is:pr is:open review-requested:@me'))
    const headers = call[1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer ghp_test')
  })

  it('throws GitHubError on non-OK responses', async () => {
    const fetchSpy = vi.fn(async () => new Response('bad token', { status: 401 }))
    await expect(
      fetchPullRequests({ type: 'github-prs', preset: 'assigned' }, 'bad', fetchSpy),
    ).rejects.toBeInstanceOf(GitHubError)
  })
})
