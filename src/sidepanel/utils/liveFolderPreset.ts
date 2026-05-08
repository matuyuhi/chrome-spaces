import { type LiveSource } from '../../shared/types'

export type FlatPreset =
  | 'pr-review-requested'
  | 'pr-assigned'
  | 'pr-authored'
  | 'pr-custom'
  | 'issue-assigned'
  | 'issue-authored'
  | 'issue-mentioned'
  | 'issue-custom'
  | 'rss'

export const PR_PRESETS: { value: FlatPreset; label: string }[] = [
  { value: 'pr-review-requested', label: 'Review requested' },
  { value: 'pr-assigned', label: 'Assigned to me' },
  { value: 'pr-authored', label: 'Authored by me' },
  { value: 'pr-custom', label: 'Custom search query' },
]

export const ISSUE_PRESETS: { value: FlatPreset; label: string }[] = [
  { value: 'issue-assigned', label: 'Assigned to me' },
  { value: 'issue-authored', label: 'Authored by me' },
  { value: 'issue-mentioned', label: 'Mentioning me' },
  { value: 'issue-custom', label: 'Custom search query' },
]

export const OTHER_PRESETS: { value: FlatPreset; label: string }[] = [
  { value: 'rss', label: 'RSS / Atom feed' },
]

interface PresetInputs {
  user: string
  customQuery: string
  repoFilter: string
  rssUrl: string
}

// Pure conversion from a flat preset + raw form fields to a LiveSource.
// Returns undefined when the inputs are not enough to form a valid source
// (e.g. empty custom query or empty RSS URL) — caller should treat that
// as a validation error.
export function presetToSource(
  preset: FlatPreset,
  inputs: PresetInputs,
): LiveSource | undefined {
  const { user, customQuery, repoFilter, rssUrl } = inputs
  const filter = repoFilter.trim() || undefined
  switch (preset) {
    case 'pr-review-requested':
    case 'pr-assigned':
    case 'pr-authored':
      return {
        type: 'github-prs',
        preset: preset.slice(3) as 'review-requested' | 'assigned' | 'authored',
        user: user.trim() || undefined,
        repoFilter: filter,
      }
    case 'pr-custom':
      return customQuery.trim()
        ? { type: 'github-prs', preset: 'custom', query: customQuery.trim() }
        : undefined
    case 'issue-assigned':
    case 'issue-authored':
    case 'issue-mentioned':
      return {
        type: 'github-issues',
        preset: preset.slice(6) as 'assigned' | 'authored' | 'mentioned',
        user: user.trim() || undefined,
        repoFilter: filter,
      }
    case 'issue-custom':
      return customQuery.trim()
        ? { type: 'github-issues', preset: 'custom', query: customQuery.trim() }
        : undefined
    case 'rss':
      return rssUrl.trim() ? { type: 'rss', url: rssUrl.trim() } : undefined
  }
}

export function sourceToPreset(source: LiveSource | undefined): FlatPreset {
  if (!source) return 'pr-review-requested'
  if (source.type === 'rss') return 'rss'
  if (source.type === 'github-prs') {
    return source.preset === 'custom'
      ? 'pr-custom'
      : (`pr-${source.preset}` as FlatPreset)
  }
  return source.preset === 'custom'
    ? 'issue-custom'
    : (`issue-${source.preset}` as FlatPreset)
}

export function defaultCustomQueryFor(preset: FlatPreset): string {
  return preset === 'issue-custom' ? 'is:issue is:open ' : 'is:pr is:open '
}

export function placeholderQueryFor(preset: FlatPreset): string {
  return preset === 'issue-custom'
    ? 'is:issue is:open label:bug org:foo'
    : 'is:pr is:open org:foo'
}
