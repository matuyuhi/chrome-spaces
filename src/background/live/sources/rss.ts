import { type LiveSource } from '../../../shared/types'
import {
  type LiveItem,
  type SearchResult,
  type SourceAdapter,
  SourceError,
} from './types'

// Minimal RSS 2.0 / Atom 1.0 reader. Service workers don't reliably
// have DOMParser across Chrome versions, and we only need a handful of
// fields per <item>/<entry>, so we lift them with regex.

const ITEM_RE = /<item\b[\s\S]*?<\/item>/gi
const ENTRY_RE = /<entry\b[\s\S]*?<\/entry>/gi

// Greedy-but-bounded extractor for a single child element by tag name.
// Handles plain text, CDATA, and self-closing tags with a `href` attribute
// (Atom links use this form: <link href="..." />).
function pickTag(block: string, tag: string): string | undefined {
  const cdataRe = new RegExp(`<${tag}\\b[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i')
  const cdata = cdataRe.exec(block)
  if (cdata) return decodeEntities(cdata[1]?.trim() ?? '')
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(block)
  if (m) return decodeEntities(m[1]?.trim() ?? '')
  return undefined
}

function pickAtomLink(block: string): string | undefined {
  // Prefer rel="alternate"; otherwise the first <link href>.
  const all = block.matchAll(/<link\b([^>]*?)\/?>/gi)
  let fallback: string | undefined
  for (const m of all) {
    const attrs = m[1] ?? ''
    const href = /\bhref\s*=\s*"([^"]+)"/i.exec(attrs)?.[1]
    if (!href) continue
    const rel = /\brel\s*=\s*"([^"]+)"/i.exec(attrs)?.[1]
    if (!rel || rel === 'alternate') return decodeEntities(href)
    if (!fallback) fallback = decodeEntities(href)
  }
  return fallback
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

export function parseFeed(xml: string, sourceUrl: string): LiveItem[] {
  const items: LiveItem[] = []
  const isAtom = /<feed\b[^>]*xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/i.test(xml)
    || /<entry\b/i.test(xml)
  const re = isAtom ? ENTRY_RE : ITEM_RE
  for (const match of xml.matchAll(re)) {
    const block = match[0]
    const link = isAtom ? pickAtomLink(block) : pickTag(block, 'link')
    if (!link) continue
    const guid = isAtom
      ? pickTag(block, 'id') ?? link
      : pickTag(block, 'guid') ?? link
    const title = isAtom ? pickTag(block, 'title') : pickTag(block, 'title')
    const updatedAt = isAtom
      ? pickTag(block, 'updated') ?? pickTag(block, 'published')
      : pickTag(block, 'pubDate') ?? pickTag(block, 'dc:date')
    items.push({
      externalId: `${sourceUrl}#${guid}`,
      url: link,
      title,
      updatedAt,
    })
  }
  return items
}

export const rssAdapter: SourceAdapter<Extract<LiveSource, { type: 'rss' }>> = {
  async fetch(source, ctx): Promise<SearchResult> {
    const headers: Record<string, string> = {
      Accept: 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    }
    if (ctx.etag) headers['If-None-Match'] = ctx.etag

    const res = await ctx.fetch(source.url, { headers })
    if (res.status === 304) return { notModified: true, etag: ctx.etag! }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new SourceError(res.status, `RSS ${res.status}: ${body.slice(0, 200) || res.statusText}`)
    }
    const xml = await res.text()
    const etag = res.headers.get('ETag') ?? undefined
    return { notModified: false, items: parseFeed(xml, source.url), etag }
  },
}
