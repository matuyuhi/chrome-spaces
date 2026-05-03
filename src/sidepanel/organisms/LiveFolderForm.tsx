import styled from '@emotion/styled'
import { useState, type FormEvent } from 'react'
import { type LiveSource } from '../../shared/types'
import { Field } from '../atoms/Field'
import { LinkButton, PrimaryButton, SecondaryButton } from '../atoms/Button'

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const FormHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;

  h2 {
    font-size: 13px;
    margin: 0;
    font-weight: 600;
  }
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
`

type FlatPreset =
  | 'pr-review-requested'
  | 'pr-assigned'
  | 'pr-authored'
  | 'pr-custom'
  | 'issue-assigned'
  | 'issue-authored'
  | 'issue-mentioned'
  | 'issue-custom'
  | 'rss'

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

const OTHER_PRESETS: { value: FlatPreset; label: string }[] = [
  { value: 'rss', label: 'RSS / Atom feed' },
]

function presetToSource(
  preset: FlatPreset,
  user: string,
  customQuery: string,
  repoFilter: string,
  rssUrl: string,
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
    case 'rss':
      return rssUrl.trim() ? { type: 'rss', url: rssUrl.trim() } : undefined
  }
}

function sourceToPreset(source: LiveSource | undefined): FlatPreset {
  if (!source) return 'pr-review-requested'
  if (source.type === 'rss') return 'rss'
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
    initial &&
      'preset' in initial.source &&
      initial.source.preset === 'custom'
      ? initial.source.query
      : defaultCustomQueryFor(initialPreset),
  )
  const [rssUrl, setRssUrl] = useState(
    initial && initial.source.type === 'rss' ? initial.source.url : '',
  )
  const [interval, setIntervalMin] = useState(initial?.refreshIntervalMin ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [permError, setPermError] = useState<string | undefined>()
  const isEdit = mode === 'edit'
  const isCustom = preset === 'pr-custom' || preset === 'issue-custom'
  const isRss = preset === 'rss'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setPermError(undefined)
    const source = presetToSource(preset, user, customQuery, repoFilter, rssUrl)
    if (!source) return
    if (source.type === 'rss') {
      let origin: string
      try {
        origin = new URL(source.url).origin
      } catch {
        setPermError('Enter a valid feed URL (https://…).')
        return
      }
      const granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
      if (!granted) {
        setPermError('Permission denied — Chrome refused fetch access for that origin.')
        return
      }
    }
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
    <Form onSubmit={handleSubmit}>
      <FormHeader>
        <LinkButton type="button" onClick={onCancel}>
          ← Back
        </LinkButton>
        <h2>{isEdit ? 'Edit Live Folder' : 'New Live Folder'}</h2>
      </FormHeader>

      {!isEdit && (
        <Field>
          <span>Name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
          />
        </Field>
      )}

      <Field>
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
          <optgroup label="Other">
            {OTHER_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      {!isCustom && !isRss && (
        <Field>
          <span>User (default: @me)</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="@me"
          />
        </Field>
      )}

      {!isCustom && !isRss && (
        <Field>
          <span>Filter (empty/* = all; ! to exclude)</span>
          <input
            value={repoFilter}
            onChange={(e) => setRepoFilter(e.target.value)}
            placeholder="acme  !sb  org:foo  user:bar  repo:a/b"
          />
        </Field>
      )}

      {isCustom && (
        <Field>
          <span>GitHub search query</span>
          <input
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder={placeholderQueryFor(preset)}
          />
        </Field>
      )}

      {isRss && (
        <Field>
          <span>Feed URL (RSS or Atom)</span>
          <input
            type="url"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
          />
        </Field>
      )}

      {permError && (
        <div style={{ color: 'tomato', fontSize: 12 }}>{permError}</div>
      )}

      <Field>
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
      </Field>

      <Actions>
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create Live Folder'}
        </PrimaryButton>
      </Actions>
    </Form>
  )
}
