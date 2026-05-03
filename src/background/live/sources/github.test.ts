import { describe, it, expect, vi } from 'vitest'
import { buildQuery, parseItem, fetchSearchResults, GitHubError } from './github'

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

  it('appends a bare repo filter as org:', () => {
    expect(
      buildQuery({ type: 'github-prs', preset: 'assigned', repoFilter: 'acme' }),
    ).toBe('is:pr is:open assignee:@me org:acme')
  })

  it('uses an explicit qualifier verbatim', () => {
    expect(
      buildQuery({ type: 'github-prs', preset: 'authored', repoFilter: 'user:octocat' }),
    ).toBe('is:pr is:open author:@me user:octocat')
    expect(
      buildQuery({
        type: 'github-issues',
        preset: 'assigned',
        repoFilter: 'repo:foo/bar',
      }),
    ).toBe('is:issue is:open assignee:@me repo:foo/bar')
  })

  it('treats * and empty filter as no filter', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'assigned', repoFilter: '*' })).toBe(
      'is:pr is:open assignee:@me',
    )
    expect(buildQuery({ type: 'github-prs', preset: 'assigned', repoFilter: '   ' })).toBe(
      'is:pr is:open assignee:@me',
    )
  })

  it('negates with ! or - prefix', () => {
    expect(buildQuery({ type: 'github-prs', preset: 'assigned', repoFilter: '!sb' })).toBe(
      'is:pr is:open assignee:@me -org:sb',
    )
    expect(
      buildQuery({ type: 'github-prs', preset: 'assigned', repoFilter: '-org:sb' }),
    ).toBe('is:pr is:open assignee:@me -org:sb')
    expect(
      buildQuery({
        type: 'github-issues',
        preset: 'mentioned',
        repoFilter: '!user:bot',
      }),
    ).toBe('is:issue is:open mentions:@me -user:bot')
    expect(
      buildQuery({
        type: 'github-prs',
        preset: 'authored',
        repoFilter: '!repo:foo/bar',
      }),
    ).toBe('is:pr is:open author:@me -repo:foo/bar')
  })

  it('does not touch a custom preset (its query is verbatim)', () => {
    // Custom preset has no repoFilter field by design; the user just
    // writes the full query. Confirm the union narrows correctly.
    expect(
      buildQuery({ type: 'github-prs', preset: 'custom', query: 'is:pr label:bug' }),
    ).toBe('is:pr label:bug')
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

  it('parses an issue URL', () => {
    const ref = parseItem({
      html_url: 'https://github.com/a/b/issues/7',
      title: 't',
      number: 7,
      state: 'open',
      updated_at: '2026-01-01T00:00:00Z',
    })
    expect(ref.externalId).toBe('a/b#7')
    expect(ref.repo).toBe('a/b')
  })

  it('throws on a URL that is neither pull nor issue', () => {
    expect(() =>
      parseItem({
        html_url: 'https://github.com/a/b/discussions/1',
        title: 't',
        number: 1,
        state: 'open',
        updated_at: '',
      }),
    ).toThrow()
  })
})

describe('buildQuery (issues)', () => {
  it('builds an assigned issues query with @me default', () => {
    expect(buildQuery({ type: 'github-issues', preset: 'assigned' })).toBe(
      'is:issue is:open assignee:@me',
    )
  })

  it('builds a mentioned issues query for an explicit user', () => {
    expect(
      buildQuery({ type: 'github-issues', preset: 'mentioned', user: 'octocat' }),
    ).toBe('is:issue is:open mentions:octocat')
  })

  it('passes a custom issues query verbatim', () => {
    expect(
      buildQuery({ type: 'github-issues', preset: 'custom', query: 'label:bug' }),
    ).toBe('label:bug')
  })
})

describe('fetchSearchResults', () => {
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
        { status: 200, headers: { ETag: 'W/"abc123"' } },
      ),
    )
    const result = await fetchSearchResults(
      { type: 'github-prs', preset: 'review-requested' },
      'ghp_test',
      { fetch: fetchSpy },
    )
    expect(result.notModified).toBe(false)
    if (result.notModified) throw new Error('expected fresh result')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.externalId).toBe('x/y#9')
    expect(result.etag).toBe('W/"abc123"')
    expect(fetchSpy).toHaveBeenCalledOnce()
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('api.github.com/search/issues')
    expect(call[0]).toContain(encodeURIComponent('is:pr is:open review-requested:@me'))
    const headers = call[1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer ghp_test')
    expect(headers['If-None-Match']).toBeUndefined()
  })

  it('sends If-None-Match when an etag is supplied and reports notModified on 304', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 304 }))
    const result = await fetchSearchResults(
      { type: 'github-prs', preset: 'authored' },
      'ghp_test',
      { etag: 'W/"abc123"', fetch: fetchSpy },
    )
    expect(result).toEqual({ notModified: true, etag: 'W/"abc123"' })
    const headers = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Record<string, string>
    expect(headers['If-None-Match']).toBe('W/"abc123"')
  })

  it('uses a custom apiBaseUrl for GHES', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({ total_count: 0, incomplete_results: false, items: [] }),
        { status: 200 },
      ),
    )
    await fetchSearchResults(
      { type: 'github-prs', preset: 'authored' },
      'ghp_test',
      { fetch: fetchSpy, apiBaseUrl: 'https://ghe.example.com/api/v3/' },
    )
    const url = (fetchSpy.mock.calls[0] as unknown as [string])[0]
    expect(url.startsWith('https://ghe.example.com/api/v3/search/issues?')).toBe(true)
  })

  it('throws GitHubError on non-OK responses', async () => {
    const fetchSpy = vi.fn(async () => new Response('bad token', { status: 401 }))
    await expect(
      fetchSearchResults(
        { type: 'github-prs', preset: 'assigned' },
        'bad',
        { fetch: fetchSpy },
      ),
    ).rejects.toBeInstanceOf(GitHubError)
  })
})
