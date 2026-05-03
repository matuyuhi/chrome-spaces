import { type LiveSource } from '../../../shared/types'
import { getGitHubApiBaseUrl, getGitHubToken } from '../../secret-storage'
import {
  type FetchContext,
  type LiveItem,
  type SearchResult,
  type SourceAdapter,
  SourceError,
} from './types'

// GitHub-specific extras kept on every item (preserved for future UI
// like draft badges); LiveItem only requires externalId + url.
export interface ItemRef extends LiveItem {
  title: string
  number: number
  repo: string
  state: string
  isDraft: boolean
  updatedAt: string
}

// GitHub-specific error subclass — kept so error formatting can still
// distinguish GitHub HTTP failures from other adapters.
export class GitHubError extends SourceError {
  constructor(status: number, message: string) {
    super(status, message)
    this.name = 'GitHubError'
  }
}

// Re-export so callers can keep importing SearchResult from this module.
export type { SearchResult } from './types'

interface SearchIssueItem {
  html_url: string
  title: string
  number: number
  state: string
  draft?: boolean
  updated_at: string
}

interface SearchResponse {
  items: SearchIssueItem[]
  total_count: number
  incomplete_results: boolean
}

const ITEM_URL_RE = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:pull|issues)\/(\d+)$/

export function buildQuery(source: LiveSource): string {
  if (source.type === 'github-prs') {
    if (source.preset === 'custom') return source.query
    const userSpec = source.user?.trim() || '@me'
    const base = (() => {
      switch (source.preset) {
        case 'review-requested':
          return `is:pr is:open review-requested:${userSpec}`
        case 'assigned':
          return `is:pr is:open assignee:${userSpec}`
        case 'authored':
          return `is:pr is:open author:${userSpec}`
      }
    })()
    return appendRepoFilter(base, source.repoFilter)
  }
  if (source.type === 'github-issues') {
    if (source.preset === 'custom') return source.query
    const userSpec = source.user?.trim() || '@me'
    const base = (() => {
      switch (source.preset) {
        case 'assigned':
          return `is:issue is:open assignee:${userSpec}`
        case 'authored':
          return `is:issue is:open author:${userSpec}`
        case 'mentioned':
          return `is:issue is:open mentions:${userSpec}`
      }
    })()
    return appendRepoFilter(base, source.repoFilter)
  }
  throw new Error(`Unsupported source type: ${(source as { type: string }).type}`)
}

function appendRepoFilter(base: string, repoFilter: string | undefined): string {
  const trimmed = repoFilter?.trim()
  if (!trimmed || trimmed === '*') return base
  // GitHub search uses `-` for negation. Accept `!` as a friendlier shorthand.
  const negated = trimmed.startsWith('!') || trimmed.startsWith('-')
  const value = negated ? trimmed.slice(1).trim() : trimmed
  if (!value) return base
  // Already a qualifier (org:foo, user:foo, repo:foo/bar) — use verbatim.
  const qualifier = value.includes(':') ? value : `org:${value}`
  return `${base} ${negated ? '-' : ''}${qualifier}`
}

export function parseItem(item: SearchIssueItem): ItemRef {
  const match = ITEM_URL_RE.exec(item.html_url)
  if (!match) throw new Error(`Unrecognized GitHub URL: ${item.html_url}`)
  const repo = match[1]!
  return {
    externalId: `${repo}#${item.number}`,
    url: item.html_url,
    title: item.title,
    number: item.number,
    repo,
    state: item.state,
    isDraft: item.draft ?? false,
    updatedAt: item.updated_at,
  }
}

export interface FetchOptions {
  etag?: string
  fetch?: typeof fetch
  // Defaults to https://api.github.com. For GHES set the instance's
  // REST root (e.g., https://ghe.example.com/api/v3).
  apiBaseUrl?: string
}

const DEFAULT_API_BASE = 'https://api.github.com'

export async function fetchSearchResults(
  source: LiveSource,
  token: string,
  options: FetchOptions = {},
): Promise<SearchResult> {
  const fetchImpl = options.fetch ?? fetch
  const base = (options.apiBaseUrl ?? DEFAULT_API_BASE).replace(/\/+$/, '')
  const query = buildQuery(source)
  const url = `${base}/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=50`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (options.etag) headers['If-None-Match'] = options.etag

  const res = await fetchImpl(url, { headers })

  if (res.status === 304) {
    return { notModified: true, etag: options.etag! }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GitHubError(res.status, `GitHub API ${res.status}: ${body || res.statusText}`)
  }

  const data = (await res.json()) as SearchResponse
  const etag = res.headers.get('ETag') ?? undefined
  return { notModified: false, items: data.items.map(parseItem), etag }
}

export const githubAdapter: SourceAdapter<
  Extract<LiveSource, { type: 'github-prs' | 'github-issues' }>
> = {
  async fetch(source, ctx: FetchContext): Promise<SearchResult> {
    const token = await getGitHubToken()
    if (!token)
      throw new Error(
        'GitHub token not configured. Open Spaces side panel → Settings → paste a PAT.',
      )
    const apiBaseUrl = await getGitHubApiBaseUrl()
    return fetchSearchResults(source, token, {
      etag: ctx.etag,
      fetch: ctx.fetch,
      apiBaseUrl,
    })
  },
}
