import { type Folder, type Space, type SpaceColor } from '../shared/types'
import { COLORS, COLOR_HEX } from './theme'
import { EmojiInput } from './EmojiInput'

export function SpaceMenu({
  space,
  onClose,
  onRename,
  onColor,
  onEmoji,
  onDelete,
}: {
  space: Space
  onClose: () => void
  onRename: () => void
  onColor: (color: SpaceColor) => void
  onEmoji: (emoji: string | undefined) => void
  onDelete: (closeTabs: boolean) => void
}) {
  return (
    <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
      <button onClick={onRename}>Rename</button>
      <div className="menu-section">Icon</div>
      <EmojiInput initial={space.emoji} onChange={onEmoji} />
      <div className="menu-section">Color</div>
      <div className="color-grid">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`color-swatch ${c === space.color ? 'is-current' : ''}`}
            style={{ background: COLOR_HEX[c] }}
            onClick={() => onColor(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
      <div className="menu-divider" />
      <button className="danger" onClick={() => onDelete(false)}>
        Delete (keep tabs)
      </button>
      <button className="danger" onClick={() => onDelete(true)}>
        Delete + close tabs
      </button>
      <div className="menu-divider" />
      <button onClick={onClose}>Close menu</button>
    </div>
  )
}

export function FolderMenu({
  folder,
  onClose,
  onRename,
  onEmoji,
  onEditLive,
  onDelete,
}: {
  folder: Folder
  onClose: () => void
  onRename: () => void
  onEmoji: (emoji: string | undefined) => void
  onEditLive: () => void
  onDelete: (closeTabs: boolean) => void
}) {
  return (
    <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
      <button onClick={onRename}>Rename</button>
      {folder.live && <button onClick={onEditLive}>Edit live config</button>}
      <div className="menu-section">Icon</div>
      <EmojiInput initial={folder.emoji} onChange={onEmoji} />
      <div className="menu-divider" />
      <button className="danger" onClick={() => onDelete(false)}>
        Delete (keep tabs)
      </button>
      <button className="danger" onClick={() => onDelete(true)}>
        Delete + close tabs
      </button>
      <div className="menu-divider" />
      <button onClick={onClose}>Close menu</button>
    </div>
  )
}

export function TabMenu({
  canReset,
  canPin,
  canUnpin,
  onClose,
  onPin,
  onUnpin,
  onReset,
  onCloseTab,
}: {
  canReset: boolean
  canPin: boolean
  canUnpin: boolean
  onClose: () => void
  onPin: () => void
  onUnpin: () => void
  onReset: () => void
  onCloseTab: () => void
}) {
  return (
    <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
      {canReset && <button onClick={onReset}>Reset to base URL</button>}
      {canPin && <button onClick={onPin}>Pin to current URL</button>}
      {canUnpin && <button onClick={onUnpin}>Unpin</button>}
      <div className="menu-divider" />
      <button className="danger" onClick={onCloseTab}>
        Close tab
      </button>
      <div className="menu-divider" />
      <button onClick={onClose}>Close menu</button>
    </div>
  )
}
