import { useCallback, useEffect, useState } from 'react'
import {
  deleteSpace,
  getActiveSpace,
  getGitHubTokenStatus,
  listSpaces,
  renameSpace,
  reorderSpaces,
  setGitHubToken,
  setSpaceColor,
  setSpaceEmoji,
  switchTo,
  updateLiveSpace,
} from './rpc'
import { isLive, type Space, type SpaceColor, type SpaceId } from '../shared/types'
import { sendMessage } from '../shared/messaging'
import { LiveSpaceForm, type LiveSpaceFormResult } from './live-space-config'

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

type View = 'list' | 'new-live' | 'edit-live' | 'settings'

export function App() {
  const [view, setView] = useState<View>('list')
  const [editLiveId, setEditLiveId] = useState<SpaceId | undefined>()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeId, setActiveId] = useState<string | undefined>()
  const [windowId, setWindowId] = useState<number | undefined>()
  const [editingId, setEditingId] = useState<string | undefined>()
  const [menuOpenId, setMenuOpenId] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [dragId, setDragId] = useState<SpaceId | undefined>()
  const [dropTarget, setDropTarget] = useState<
    { id: SpaceId; position: 'above' | 'below' } | undefined
  >()

  const refresh = useCallback(async () => {
    const win = await chrome.windows.getCurrent()
    if (typeof win.id !== 'number') return
    setWindowId(win.id)
    setSpaces(await listSpaces(win.id))
    setActiveId((await getActiveSpace(win.id))?.id)
  }, [])

  const handleDrop = useCallback(async () => {
    if (!dragId || !dropTarget || windowId === undefined) {
      setDragId(undefined)
      setDropTarget(undefined)
      return
    }
    const sourceIdx = spaces.findIndex((s) => s.id === dragId)
    const targetIdx = spaces.findIndex((s) => s.id === dropTarget.id)
    setDragId(undefined)
    setDropTarget(undefined)
    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return
    let insertIdx = targetIdx + (dropTarget.position === 'below' ? 1 : 0)
    if (sourceIdx < insertIdx) insertIdx -= 1
    if (insertIdx === sourceIdx) return
    const next = [...spaces]
    const [moved] = next.splice(sourceIdx, 1)
    if (!moved) return
    next.splice(insertIdx, 0, moved)
    setSpaces(next)
    await reorderSpaces(
      windowId,
      next.map((s) => s.id),
    )
    await refresh()
  }, [dragId, dropTarget, spaces, windowId, refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (view === 'settings') {
    return <SettingsPanel onClose={() => setView('list')} />
  }

  if (view === 'edit-live' && editLiveId) {
    const target = spaces.find((s) => s.id === editLiveId)
    if (!target || !isLive(target)) {
      setView('list')
      setEditLiveId(undefined)
      return null
    }
    return (
      <div className="popup-root">
        <LiveSpaceForm
          mode="edit"
          defaultColor={target.color}
          initial={{
            name: target.name,
            color: target.color,
            source: target.source,
            refreshIntervalMin: target.refreshIntervalMin,
          }}
          onCancel={() => {
            setView('list')
            setEditLiveId(undefined)
          }}
          onSubmit={async (input) => {
            try {
              await updateLiveSpace(editLiveId, {
                source: input.source,
                refreshIntervalMin: input.refreshIntervalMin,
              })
              setView('list')
              setEditLiveId(undefined)
              await refresh()
              void sendMessage({ type: 'syncLive', spaceId: editLiveId }).then(() => refresh())
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e)
              console.error('[Spaces] updateLiveSpace failed', e)
              setError(`Update failed: ${message}`)
              setView('list')
              setEditLiveId(undefined)
            }
          }}
        />
      </div>
    )
  }

  if (view === 'new-live') {
    return (
      <div className="popup-root">
        <LiveSpaceForm
          defaultColor={COLORS[spaces.length % COLORS.length]!}
          onCancel={() => setView('list')}
          onSubmit={async (input: LiveSpaceFormResult) => {
            if (windowId === undefined) return
            try {
              const space = await sendMessage({
                type: 'createLive',
                payload: {
                  name: input.name,
                  color: input.color,
                  windowId,
                  source: input.source,
                  refreshIntervalMin: input.refreshIntervalMin,
                },
              })
              setView('list')
              await refresh()
              void sendMessage({ type: 'syncLive', spaceId: space.id }).then(() => refresh())
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e)
              console.error('[Spaces] createLive failed', e)
              setError(`Create failed: ${message}`)
              setView('list')
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className="popup-root">
      <header className="header">
        <h1>Spaces</h1>
        <div className="header-actions">
          <button
            className="btn-icon"
            aria-label="Settings"
            onClick={() => setView('settings')}
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="new-buttons">
        <button
          className="btn-primary"
          onClick={async () => {
            if (windowId === undefined) return
            setError(undefined)
            try {
              const created = await sendMessage({
                type: 'createStatic',
                payload: {
                  name: `Space ${spaces.length + 1}`,
                  color: COLORS[spaces.length % COLORS.length]!,
                  windowId,
                },
              })
              await refresh()
              await switchTo(created.id, windowId)
              await refresh()
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e)
              console.error('[Spaces] createStatic failed', e)
              setError(`Create failed: ${message}`)
            }
          }}
        >
          + Static
        </button>
        <button
          className="btn-secondary"
          title="Group every ungrouped tab in this window into a new Static Space."
          onClick={async () => {
            if (windowId === undefined) return
            setError(undefined)
            try {
              const created = await sendMessage({
                type: 'createStaticFromTabs',
                payload: {
                  name: `Space ${spaces.length + 1}`,
                  color: COLORS[spaces.length % COLORS.length]!,
                  windowId,
                },
              })
              await refresh()
              await switchTo(created.id, windowId)
              await refresh()
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e)
              console.error('[Spaces] createStaticFromTabs failed', e)
              setError(`Capture failed: ${message}`)
            }
          }}
        >
          + Capture
        </button>
        <button className="btn-secondary" onClick={() => setView('new-live')}>
          + Live Folder
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {spaces.length === 0 ? (
        <p className="empty">No spaces yet.</p>
      ) : (
        <ul className="space-list">
          {spaces.map((s) => (
            <SpaceRow
              key={s.id}
              space={s}
              active={s.id === activeId}
              editing={editingId === s.id}
              menuOpen={menuOpenId === s.id}
              isDragging={dragId === s.id}
              dropPosition={dropTarget?.id === s.id ? dropTarget.position : undefined}
              onDragStart={() => setDragId(s.id)}
              onDragOver={(position) => {
                if (!dragId || dragId === s.id) return
                if (dropTarget?.id !== s.id || dropTarget.position !== position) {
                  setDropTarget({ id: s.id, position })
                }
              }}
              onDragLeave={() => {
                if (dropTarget?.id === s.id) setDropTarget(undefined)
              }}
              onDrop={() => void handleDrop()}
              onDragEnd={() => {
                setDragId(undefined)
                setDropTarget(undefined)
              }}
              onSwitch={async () => {
                if (windowId === undefined || editingId) return
                await switchTo(s.id, windowId)
                await refresh()
              }}
              onStartEdit={() => {
                setEditingId(s.id)
                setMenuOpenId(undefined)
              }}
              onCommitEdit={async (name) => {
                setEditingId(undefined)
                if (name.trim() && name !== s.name) {
                  await renameSpace(s.id, name.trim())
                  await refresh()
                }
              }}
              onCancelEdit={() => setEditingId(undefined)}
              onToggleMenu={() => setMenuOpenId(menuOpenId === s.id ? undefined : s.id)}
              onColorChange={async (c) => {
                await setSpaceColor(s.id, c)
                setMenuOpenId(undefined)
                await refresh()
              }}
              onEmojiChange={async (emoji) => {
                await setSpaceEmoji(s.id, emoji)
                await refresh()
              }}
              onSyncNow={async () => {
                setMenuOpenId(undefined)
                try {
                  await sendMessage({ type: 'syncLive', spaceId: s.id })
                } catch (e) {
                  console.error('[Spaces] syncLive failed', e)
                }
                await refresh()
              }}
              onEditLive={() => {
                setMenuOpenId(undefined)
                setEditLiveId(s.id)
                setView('edit-live')
              }}
              onDelete={async (closeTabs) => {
                await deleteSpace(s.id, closeTabs)
                setMenuOpenId(undefined)
                await refresh()
              }}
            />
          ))}
        </ul>
      )}

      <footer className="footer">
        <button
          className="btn-link"
          onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Configure shortcuts →
        </button>
      </footer>
    </div>
  )
}

interface SpaceRowProps {
  space: Space
  active: boolean
  editing: boolean
  menuOpen: boolean
  isDragging: boolean
  dropPosition: 'above' | 'below' | undefined
  onDragStart: () => void
  onDragOver: (position: 'above' | 'below') => void
  onDragLeave: () => void
  onDrop: () => void
  onDragEnd: () => void
  onSwitch: () => void
  onStartEdit: () => void
  onCommitEdit: (name: string) => void
  onCancelEdit: () => void
  onToggleMenu: () => void
  onColorChange: (color: SpaceColor) => void
  onEmojiChange: (emoji: string | undefined) => void
  onSyncNow: () => void
  onEditLive: () => void
  onDelete: (closeTabs: boolean) => void
}

function SpaceRow(props: SpaceRowProps) {
  const { space, active, editing, menuOpen, isDragging, dropPosition } = props
  const [draft, setDraft] = useState(space.name)

  useEffect(() => {
    if (editing) setDraft(space.name)
  }, [editing, space.name])

  const live = isLive(space) ? space : undefined
  const errorTooltip = live?.lastSyncError ?? ''

  const className = [
    'space-row',
    active && 'is-active',
    isDragging && 'is-dragging',
    dropPosition === 'above' && 'drop-above',
    dropPosition === 'below' && 'drop-below',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li
      className={className}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        // Firefox requires data; the value is unused.
        e.dataTransfer.setData('text/plain', space.id)
        props.onDragStart()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const rect = e.currentTarget.getBoundingClientRect()
        const position = e.clientY - rect.top < rect.height / 2 ? 'above' : 'below'
        props.onDragOver(position)
      }}
      onDragLeave={props.onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        props.onDrop()
      }}
      onDragEnd={props.onDragEnd}
    >
      <button
        className="space-main"
        onClick={editing ? undefined : props.onSwitch}
        disabled={editing}
      >
        {space.emoji ? (
          <span className="space-emoji" aria-hidden>
            {space.emoji}
          </span>
        ) : (
          <span className="dot" style={{ background: COLOR_HEX[space.color] }} aria-hidden />
        )}
        {editing ? (
          <input
            className="name-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => props.onCommitEdit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onCommitEdit(draft)
              if (e.key === 'Escape') props.onCancelEdit()
            }}
          />
        ) : (
          <span className="space-name">{space.name}</span>
        )}
        {live && (
          <span className="badge" title={errorTooltip || 'Live folder'}>
            {live.lastSyncError ? '⚠' : 'live'}
          </span>
        )}
      </button>
      <button
        className="btn-menu"
        aria-label="More"
        onClick={(e) => {
          e.stopPropagation()
          props.onToggleMenu()
        }}
      >
        ⋯
      </button>
      {menuOpen && (
        <div className="menu" role="menu">
          {live && (
            <>
              <button onClick={props.onSyncNow}>Sync now</button>
              <button onClick={props.onEditLive}>Edit live folder…</button>
              {live.lastSyncError && <div className="menu-error">{live.lastSyncError}</div>}
              <div className="menu-divider" />
            </>
          )}
          <button onClick={props.onStartEdit}>Rename</button>
          <div className="menu-section">Icon</div>
          <EmojiPicker emoji={space.emoji} onChange={props.onEmojiChange} />
          <div className="menu-section">Color</div>
          <div className="color-grid">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${c === space.color ? 'is-current' : ''}`}
                style={{ background: COLOR_HEX[c] }}
                onClick={() => props.onColorChange(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="menu-divider" />
          <button className="danger" onClick={() => props.onDelete(false)}>
            Delete (keep tabs)
          </button>
          <button className="danger" onClick={() => props.onDelete(true)}>
            Delete + close tabs
          </button>
        </div>
      )}
    </li>
  )
}

interface EmojiPickerProps {
  emoji: string | undefined
  onChange: (emoji: string | undefined) => void
}

// Trim to a single grapheme so a paste of "🔥🚀" stores as "🔥".
function firstGrapheme(input: string): string {
  if (!input) return ''
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const first = segmenter.segment(input)[Symbol.iterator]().next().value
  return first?.segment ?? ''
}

function EmojiPicker({ emoji, onChange }: EmojiPickerProps) {
  const [draft, setDraft] = useState(emoji ?? '')

  useEffect(() => setDraft(emoji ?? ''), [emoji])

  const commit = (raw: string) => {
    const next = firstGrapheme(raw.trim())
    const normalized = next === '' ? undefined : next
    if (normalized !== emoji) onChange(normalized)
  }

  return (
    <div className="emoji-row">
      <input
        className="emoji-input"
        value={draft}
        placeholder="🚀"
        onChange={(e) => setDraft(firstGrapheme(e.target.value))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit((e.target as HTMLInputElement).value)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />
      {emoji && (
        <button
          type="button"
          className="btn-link"
          onClick={() => {
            setDraft('')
            onChange(undefined)
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState<boolean | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void getGitHubTokenStatus().then(({ hasToken }) => setHasToken(hasToken))
  }, [])

  const handleSave = async () => {
    await setGitHubToken(token || undefined)
    setHasToken(!!token)
    setToken('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="popup-root">
      <header className="header">
        <button className="btn-link" onClick={onClose}>
          ← Back
        </button>
        <h1>Settings</h1>
        <span />
      </header>

      <section className="settings-section">
        <h2>GitHub PAT</h2>
        <p className="muted">
          Used by Live Folders. Stored only in <code>chrome.storage.local</code> on this device.
        </p>
        <p className="muted">
          Status: {hasToken === undefined ? '…' : hasToken ? '✓ token saved' : '— no token'}
        </p>
        <input
          type="password"
          autoComplete="off"
          placeholder="ghp_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave} disabled={!token && !hasToken}>
            {token ? 'Save token' : hasToken ? 'Clear token' : 'Save'}
          </button>
          {saved && <span className="muted">Saved.</span>}
        </div>
        <p className="muted">
          Required scopes: <code>repo</code> (private PRs) or just <code>public_repo</code> (public only).
          Generate at{' '}
          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank"
            rel="noreferrer"
          >
            github.com/settings/tokens
          </a>
          .
        </p>
      </section>
    </div>
  )
}
