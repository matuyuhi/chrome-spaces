import { type LiveSource } from '../../../shared/types'

export interface ItemRef {
  externalId: string
  url: string
  title: string
  number: number
  repo: string
  state: string
  isDraft: boolean
  updatedAt: string
}

export class GitHubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

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

export async function fetchSearchResults(
  source: LiveSource,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ItemRef[]> {
  const query = buildQuery(source)
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=50`

  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GitHubError(res.status, `GitHub API ${res.status}: ${body || res.statusText}`)
  }

  const data = (await res.json()) as SearchResponse
  return data.items.map(parseItem)
}
