import { type LiveSource } from '../../../shared/types'

// What a fetched live item exposes to the sync engine. Only `externalId`
// and `url` are load-bearing — the rest is metadata adapters can populate
// for future UI.
export interface LiveItem {
  externalId: string
  url: string
  title?: string
  updatedAt?: string
}

export type SearchResult =
  | { notModified: false; items: LiveItem[]; etag?: string }
  | { notModified: true; etag: string }

export interface FetchContext {
  // Last ETag we stored for this Live folder, if any. Adapters can use it
  // for conditional requests (return notModified on 304).
  etag?: string
  // Allow tests to inject a mock fetch.
  fetch: typeof fetch
}

export interface SourceAdapter<S extends LiveSource = LiveSource> {
  // Conditional fetch: returns notModified if upstream hasn't changed
  // since the supplied etag, otherwise the fresh item list.
  fetch(source: S, ctx: FetchContext): Promise<SearchResult>
}

export class SourceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'SourceError'
  }
}
