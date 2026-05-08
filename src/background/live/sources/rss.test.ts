import { describe, it, expect, vi } from 'vitest'
import { parseFeed, rssAdapter, isRestrictedUrl } from './rss'

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example</title>
    <link>https://example.com/</link>
    <item>
      <title>First post</title>
      <link>https://example.com/posts/1</link>
      <guid>post-1</guid>
      <pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title><![CDATA[Second &amp; third]]></title>
      <link>https://example.com/posts/2</link>
      <guid isPermaLink="false">post-2</guid>
      <pubDate>Tue, 02 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <entry>
    <title>Hello</title>
    <link href="https://example.com/atom/1" rel="alternate"/>
    <id>tag:example.com,2026:1</id>
    <updated>2026-01-01T00:00:00Z</updated>
  </entry>
  <entry>
    <title>World</title>
    <link rel="self" href="https://example.com/atom/2/self"/>
    <link href="https://example.com/atom/2"/>
    <id>tag:example.com,2026:2</id>
    <updated>2026-01-02T00:00:00Z</updated>
  </entry>
</feed>`

describe('parseFeed', () => {
  it('parses RSS items including CDATA and entities', () => {
    const items = parseFeed(RSS_FIXTURE, 'https://example.com/feed.xml')
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      url: 'https://example.com/posts/1',
      externalId: 'https://example.com/feed.xml#post-1',
      title: 'First post',
    })
    expect(items[1]?.title).toBe('Second & third')
  })

  it('parses Atom entries and prefers rel="alternate" links', () => {
    const items = parseFeed(ATOM_FIXTURE, 'https://example.com/atom.xml')
    expect(items).toHaveLength(2)
    expect(items[0]?.url).toBe('https://example.com/atom/1')
    // The second entry has rel="self" first then a bare href; we should
    // pick the bare one (not the rel="self") since rel="alternate" wasn't
    // explicit but the bare-href is the standard fallback.
    expect(items[1]?.url).toBe('https://example.com/atom/2')
  })

  it('returns an empty list for malformed input', () => {
    expect(parseFeed('<not xml', 'https://example.com/feed.xml')).toEqual([])
  })
})

describe('isRestrictedUrl', () => {
  it('identifies restricted URLs correctly', () => {
    expect(isRestrictedUrl('http://localhost/feed')).toBe(true)
    expect(isRestrictedUrl('http://127.0.0.1/feed')).toBe(true)
    expect(isRestrictedUrl('http://10.0.0.1/feed')).toBe(true)
    expect(isRestrictedUrl('http://192.168.1.1/feed')).toBe(true)
    expect(isRestrictedUrl('http://172.16.0.1/feed')).toBe(true)
    expect(isRestrictedUrl('http://172.31.0.1/feed')).toBe(true)
    expect(isRestrictedUrl('http://169.254.169.254/latest/meta-data')).toBe(true)
    expect(isRestrictedUrl('http://metadata.google.internal/computeMetadata/v1/')).toBe(true)
    expect(isRestrictedUrl('http://[::1]/feed')).toBe(true)
    expect(isRestrictedUrl('ftp://example.com/feed')).toBe(true)
    expect(isRestrictedUrl('invalid-url')).toBe(true)
  })

  it('allows safe external URLs', () => {
    expect(isRestrictedUrl('https://example.com/feed')).toBe(false)
    expect(isRestrictedUrl('http://example.org/feed.xml')).toBe(false)
    // 172 outside private range
    expect(isRestrictedUrl('http://172.15.0.1/feed')).toBe(false)
    expect(isRestrictedUrl('http://172.32.0.1/feed')).toBe(false)

    // Test for false positives where domain name starts with restricted numbers
    expect(isRestrictedUrl('http://10.example.com/feed')).toBe(false)
    expect(isRestrictedUrl('http://127.example.com/feed')).toBe(false)
  })
})

describe('rssAdapter', () => {
  it('fetches and parses a feed, capturing the etag', async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(RSS_FIXTURE, {
        status: 200,
        headers: { ETag: 'W/"feed-v1"' },
      }),
    )
    const result = await rssAdapter.fetch(
      { type: 'rss', url: 'https://example.com/feed.xml' },
      { fetch: fetchSpy as unknown as typeof fetch },
    )
    expect(result.notModified).toBe(false)
    if (result.notModified) throw new Error('expected fresh result')
    expect(result.items).toHaveLength(2)
    expect(result.etag).toBe('W/"feed-v1"')
  })

  it('returns notModified on 304 and echoes the supplied etag', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 304 }))
    const result = await rssAdapter.fetch(
      { type: 'rss', url: 'https://example.com/feed.xml' },
      { etag: 'W/"feed-v1"', fetch: fetchSpy as unknown as typeof fetch },
    )
    expect(result).toEqual({ notModified: true, etag: 'W/"feed-v1"' })
    const headers = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Record<string, string>
    expect(headers['If-None-Match']).toBe('W/"feed-v1"')
  })

  it('throws a SourceError for restricted URLs', async () => {
    const fetchSpy = vi.fn()
    await expect(
      rssAdapter.fetch(
        { type: 'rss', url: 'http://localhost/rss' },
        { fetch: fetchSpy as unknown as typeof fetch },
      )
    ).rejects.toThrowError(/Restricted URL/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
