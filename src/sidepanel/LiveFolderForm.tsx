import { useState, type FormEvent } from 'react'
import { type LiveSource } from '../shared/types'

type FlatPreset =
  | 'pr-review-requested'
  | 'pr-assigned'
  | 'pr-authored'
  | 'pr-custom'
  | 'issue-assigned'
  | 'issue-authored'
  | 'issue-mentioned'
  | 'issue-custom'

const PR_PRESETS: { value: FlatPreset; label: string }[] = [
  { value: 'pr-review-requested', label: 'Review requested' },
  { value: 'pr-assigned', label: 'Assigned to me' },
  { value: 'pr-authored', label: 'Authored by me' },
  { value: 'pr-custom', label: 'Custom search query' },
]

const ISSUE_PRESETS: { value: FlatPreset; label: string }[] = [
  { value: 'issue-assigned', label: 'Assigned to me' },
  { value: 'issue-authored', label: 'Authored by me' },
  { value: 'issue-mentioned', label: 'Mentioning me' },
  { value: 'issue-custom', label: 'Custom search query' },
]

function presetToSource(
  preset: FlatPreset,
  user: string,
  customQuery: string,
  repoFilter: string,
): LiveSource | undefined {
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
  }
}

function sourceToPreset(source: LiveSource | undefined): FlatPreset {
  if (!source) return 'pr-review-requested'
  if (source.type === 'github-prs') {
    return source.preset === 'custom' ? 'pr-custom' : (`pr-${source.preset}` as FlatPreset)
  }
  return source.preset === 'custom' ? 'issue-custom' : (`issue-${source.preset}` as FlatPreset)
}

function defaultCustomQueryFor(preset: FlatPreset): string {
  return preset === 'issue-custom' ? 'is:issue is:open ' : 'is:pr is:open '
}

function placeholderQueryFor(preset: FlatPreset): string {
  return preset === 'issue-custom'
    ? 'is:issue is:open label:bug org:foo'
    : 'is:pr is:open org:foo'
}

export interface LiveFolderFormResult {
  name: string
  source: LiveSource
  refreshIntervalMin: number
}

interface Props {
  mode: 'create' | 'edit'
  initial?: { name: string; source: LiveSource; refreshIntervalMin: number }
  onSubmit: (input: LiveFolderFormResult) => void | Promise<void>
  onCancel: () => void
}

export function LiveFolderForm({ mode, initial, onSubmit, onCancel }: Props) {
  const initialPreset = sourceToPreset(initial?.source)
  const [name, setName] = useState(initial?.name ?? 'Reviews')
  const [preset, setPreset] = useState<FlatPreset>(initialPreset)
  const [user, setUser] = useState(
    initial && 'user' in initial.source ? (initial.source.user ?? '') : '',
  )
  const [repoFilter, setRepoFilter] = useState(
    initial && 'repoFilter' in initial.source ? (initial.source.repoFilter ?? '') : '',
  )
  const [customQuery, setCustomQuery] = useState(
    initial && initial.source.preset === 'custom'
      ? initial.source.query
      : defaultCustomQueryFor(initialPreset),
  )
  const [interval, setIntervalMin] = useState(initial?.refreshIntervalMin ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const isEdit = mode === 'edit'
  const isCustom = preset === 'pr-custom' || preset === 'issue-custom'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    const source = presetToSource(preset, user, customQuery, repoFilter)
    if (!source) return
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), source, refreshIntervalMin: interval })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePresetChange = (next: FlatPreset) => {
    if (preset === next) return
    const wasCustom = preset === 'pr-custom' || preset === 'issue-custom'
    const willBeCustom = next === 'pr-custom' || next === 'issue-custom'
    if (
      willBeCustom &&
      (!wasCustom || customQuery.trim() === defaultCustomQueryFor(preset).trim())
    ) {
      setCustomQuery(defaultCustomQueryFor(next))
    }
    setPreset(next)
  }

  return (
    <form className="live-form" onSubmit={handleSubmit}>
      <header className="form-header">
        <button type="button" className="btn-link" onClick={onCancel}>
          ← Back
        </button>
        <h2>{isEdit ? 'Edit Live Folder' : 'New Live Folder'}</h2>
      </header>

      {!isEdit && (
        <label className="field">
          <span>Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
          />
        </label>
      )}

      <label className="field">
        <span>Source</span>
        <select
          value={preset}
          onChange={(e) => handlePresetChange(e.target.value as FlatPreset)}
        >
          <optgroup label="Pull requests">
            {PR_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Issues">
            {ISSUE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      {!isCustom && (
        <label className="field">
          <span>User (default: @me)</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="@me"
          />
        </label>
      )}

      {!isCustom && (
        <label className="field">
          <span>Filter (empty/* = all; ! to exclude)</span>
          <input
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            placeholder="acme  !sb  org:foo  user:bar  repo:a/b"
          />
        </label>
      )}

      {isCustom && (
        <label className="field">
          <span>GitHub search query</span>
          <input
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder={placeholderQueryFor(preset)}
          />
        </label>
      )}

      <label className="field">
        <span>Refresh interval (min; 0 = manual only)</span>
        <input
          type="number"
          min={0}
          max={60}
          value={interval}
          onChange={(e) =>
            setIntervalMin(Math.max(0, Math.min(60, Number(e.target.value) || 0)))
          }
        />
      </label>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create Live Folder'}
        </button>
      </div>
    </form>
  )
}
