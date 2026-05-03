import { type LiveSource } from '../../../shared/types'
import { githubAdapter } from './github'
import { rssAdapter } from './rss'
import { type FetchContext, type SearchResult, type SourceAdapter } from './types'

// Map source.type → adapter. Adding a new source here is the only spot
// the sync engine cares about.
const adapters: Record<LiveSource['type'], SourceAdapter> = {
  'github-prs': githubAdapter as SourceAdapter,
  'github-issues': githubAdapter as SourceAdapter,
  rss: rssAdapter as SourceAdapter,
}

export async function dispatchFetch(
  source: LiveSource,
  ctx: FetchContext,
): Promise<SearchResult> {
  const adapter = adapters[source.type]
  if (!adapter)
    throw new Error(`No adapter for live source type: ${(source as { type: string }).type}`)
  return adapter.fetch(source, ctx)
}

export type { FetchContext, SearchResult, SourceAdapter } from './types'
export { SourceError } from './types'
