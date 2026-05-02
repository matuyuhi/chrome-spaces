import { useState, type FormEvent } from 'react'
import { type LiveSource, type SpaceColor } from '../shared/types'

const COLORS: SpaceColor[] = [
  'blue',
  'red',
  'green',
  'yellow',
  'cyan',
  'purple',
  'pink',
  'orange',
  'grey',
]

const COLOR_HEX: Record<SpaceColor, string> = {
  grey: '#9aa0a6',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#fa7b17',
}

type Preset = 'review-requested' | 'assigned' | 'authored' | 'custom'

const PRESET_LABEL: Record<Preset, string> = {
  'review-requested': 'Review requested',
  assigned: 'Assigned to me',
  authored: 'Authored by me',
  custom: 'Custom search query',
}

export interface LiveSpaceFormResult {
  name: string
  color: SpaceColor
  source: LiveSource
  refreshIntervalMin: number
}

interface Props {
  defaultColor: SpaceColor
  onSubmit: (input: LiveSpaceFormResult) => void | Promise<void>
  onCancel: () => void
}

export function LiveSpaceForm({ defaultColor, onSubmit, onCancel }: Props) {
  const [name, setName] = useState('Reviews')
  const [color, setColor] = useState<SpaceColor>(defaultColor)
  const [preset, setPreset] = useState<Preset>('review-requested')
  const [user, setUser] = useState('')
  const [customQuery, setCustomQuery] = useState('is:pr is:open ')
  const [interval, setIntervalMin] = useState(5)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return

    let source: LiveSource
    if (preset === 'custom') {
      if (!customQuery.trim()) return
      source = { type: 'github-prs', preset: 'custom', query: customQuery.trim() }
    } else {
      source = {
        type: 'github-prs',
        preset,
        user: user.trim() || undefined,
      }
    }

    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), color, source, refreshIntervalMin: interval })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="live-form" onSubmit={handleSubmit}>
      <header className="form-header">
        <button type="button" className="btn-link" onClick={onCancel}>
          ← Back
        </button>
        <h2>New GitHub Live Folder</h2>
      </header>

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

      <label className="field">
        <span>Color</span>
        <div className="color-grid">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${c === color ? 'is-current' : ''}`}
              style={{ background: COLOR_HEX[c] }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </label>

      <label className="field">
        <span>Source</span>
        <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
          {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </select>
      </label>

      {preset !== 'custom' && (
        <label className="field">
          <span>User (optional, defaults to @me)</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="@me"
          />
        </label>
      )}

      {preset === 'custom' && (
        <label className="field">
          <span>GitHub search query</span>
          <input
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="is:pr is:open org:foo"
          />
        </label>
      )}

      <label className="field">
        <span>Refresh interval (minutes)</span>
        <input
          type="number"
          min={1}
          max={60}
          value={interval}
          onChange={(e) => setIntervalMin(Math.max(1, Math.min(60, Number(e.target.value) || 5)))}
        />
      </label>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Live Folder'}
        </button>
      </div>
    </form>
  )
}
