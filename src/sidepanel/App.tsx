import { useCallback, useEffect, useState } from 'react'
import { sendMessage } from '../shared/messaging'
import {
  type Folder,
  type FolderId,
  type ItemRef,
  type Space,
  type SpaceColor,
  type SpaceId,
  type SpaceStore,
} from '../shared/types'
import { LiveFolderForm, type LiveFolderFormResult } from './LiveFolderForm'

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

interface TabInfo {
  id: number
  title: string
  url: string
  favIconUrl?: string
  hidden: boolean
}

type View =
  | { kind: 'list' }
  | { kind: 'settings' }
  | { kind: 'live-create'; parentFolderId: FolderId }
  | { kind: 'live-edit'; folderId: FolderId }

type DropPos =
  | { kind: 'before-item'; folderId: FolderId; index: number }
  | { kind: 'after-item'; folderId: FolderId; index: number }
  | { kind: 'into-folder'; folderId: FolderId }
  | { kind: 'into-space'; spaceId: SpaceId; folderId: FolderId }
  | { kind: 'reorder-space'; targetSpaceId: SpaceId; position: 'before' | 'after' }

type DragState =
  | { kind: 'item'; item: ItemRef }
  | { kind: 'space'; spaceId: SpaceId }

function dropPosKey(p: DropPos): string {
  switch (p.kind) {
    case 'before-item':
    case 'after-item':
      return `${p.kind}:${p.folderId}:${p.index}`
    case 'into-folder':
      return `into-folder:${p.folderId}`
    case 'into-space':
      return `into-space:${p.spaceId}`
    case 'reorder-space':
      return `reorder-space:${p.targetSpaceId}:${p.position}`
  }
}

export function App() {
  const [windowId, setWindowId] = useState<number | undefined>()
  const [store, setStore] = useState<SpaceStore | undefined>()
  const [tabs, setTabs] = useState<Record<number, TabInfo>>({})
  const [error, setError] = useState<string | undefined>()
  const [tabGroupCount, setTabGroupCount] = useState(0)
  const [view, setView] = useState<View>({ kind: 'list' })
  const [openMenu, setOpenMenu] = useState<string | undefined>()
  const [drag, setDrag] = useState<DragState | undefined>()
  const [dropPos, setDropPos] = useState<DropPos | undefined>()

  const refresh = useCallback(async () => {
    try {
      const win = await chrome.windows.getCurrent()
      if (typeof win.id !== 'number') return
      setWindowId(win.id)
      const next = await sendMessage({ type: 'getStore' })
      setStore(next)
      const winTabs = await chrome.tabs.query({ windowId: win.id })
      const map: Record<number, TabInfo> = {}
      for (const t of winTabs) {
        if (typeof t.id !== 'number') continue
        map[t.id] = {
          id: t.id,
          title: t.title ?? '',
          url: t.url ?? '',
          favIconUrl: t.favIconUrl,
          hidden: (t as { hidden?: boolean }).hidden ?? false,
        }
      }
      setTabs(map)
      try {
        const groups = await chrome.tabGroups.query({ windowId: win.id })
        setTabGroupCount(groups.length)
      } catch {
        setTabGroupCount(0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const finalizeDrop = useCallback(async () => {
    if (!drag || !dropPos || windowId === undefined) {
      setDrag(undefined)
      setDropPos(undefined)
      return
    }
    const dragSnap = drag
    const target = dropPos
    setDrag(undefined)
    setDropPos(undefined)

    try {
      if (dragSnap.kind === 'space' && target.kind === 'reorder-space') {
        // Compute the new ordered list of Space ids in this window.
        const ordered = (
          await sendMessage({ type: 'getStore' })
        ).spaces
        const inWindow = Object.values(ordered)
          .filter((sp) => sp.windowId === windowId)
          .sort((a, b) => a.order - b.order)
        const sourceIdx = inWindow.findIndex((sp) => sp.id === dragSnap.spaceId)
        const targetIdx = inWindow.findIndex((sp) => sp.id === target.targetSpaceId)
        if (sourceIdx === -1 || targetIdx === -1) return
        let insertAt = targetIdx + (target.position === 'after' ? 1 : 0)
        if (sourceIdx < insertAt) insertAt -= 1
        if (insertAt === sourceIdx) return
        const next = [...inWindow]
        const [moved] = next.splice(sourceIdx, 1)
        if (!moved) return
        next.splice(insertAt, 0, moved)
        await sendMessage({
          type: 'reorderSpaces',
          windowId,
          orderedIds: next.map((sp) => sp.id),
        })
        await refresh()
        return
      }
      if (dragSnap.kind === 'item') {
        let toFolderId: FolderId
        let toIndex: number
        switch (target.kind) {
          case 'before-item':
            toFolderId = target.folderId
            toIndex = target.index
            break
          case 'after-item':
            toFolderId = target.folderId
            toIndex = target.index + 1
            break
          case 'into-folder':
          case 'into-space':
            toFolderId = target.folderId
            toIndex = Number.MAX_SAFE_INTEGER
            break
          case 'reorder-space':
            return // mismatched: item drop on space-reorder target
        }
        await sendMessage({ type: 'moveItem', item: dragSnap.item, toFolderId, toIndex })
        await refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [drag, dropPos, windowId, refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const listener = () => void refresh()
    chrome.tabs.onCreated.addListener(listener)
    chrome.tabs.onRemoved.addListener(listener)
    chrome.tabs.onUpdated.addListener(listener)
    chrome.tabs.onActivated.addListener(listener)
    chrome.tabs.onMoved.addListener(listener)
    return () => {
      chrome.tabs.onCreated.removeListener(listener)
      chrome.tabs.onRemoved.removeListener(listener)
      chrome.tabs.onUpdated.removeListener(listener)
      chrome.tabs.onActivated.removeListener(listener)
      chrome.tabs.onMoved.removeListener(listener)
    }
  }, [refresh])

  // Close any open menu/popover when clicking outside.
  useEffect(() => {
    if (!openMenu) return
    const onDocClick = () => setOpenMenu(undefined)
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [openMenu])

  if (!store || windowId === undefined) {
    return <div className="loading">Loading…</div>
  }

  const handleError = (e: unknown) => setError(e instanceof Error ? e.message : String(e))

  if (view.kind === 'settings') {
    return (
      <div className="root">
        <SettingsPanel onClose={() => setView({ kind: 'list' })} />
      </div>
    )
  }

  if (view.kind === 'live-create') {
    return (
      <div className="root">
        <LiveFolderForm
          mode="create"
          onCancel={() => setView({ kind: 'list' })}
          onSubmit={async (input: LiveFolderFormResult) => {
            try {
              const folder = await sendMessage({
                type: 'createFolder',
                payload: {
                  parentFolderId: view.parentFolderId,
                  name: input.name,
                  live: {
                    source: input.source,
                    refreshIntervalMin: input.refreshIntervalMin,
                  },
                },
              })
              setView({ kind: 'list' })
              await refresh()
              sendMessage({ type: 'syncLiveFolder', folderId: folder.id })
                .then(() => refresh())
                .catch((err) => console.error('[Spaces] post-create sync', err))
            } catch (e) {
              handleError(e)
            }
          }}
        />
      </div>
    )
  }

  if (view.kind === 'live-edit') {
    const folder = store.folders[view.folderId]
    if (!folder || !folder.live) {
      setView({ kind: 'list' })
      return null
    }
    return (
      <div className="root">
        <LiveFolderForm
          mode="edit"
          initial={{
            name: folder.name,
            source: folder.live.source,
            refreshIntervalMin: folder.live.refreshIntervalMin,
          }}
          onCancel={() => setView({ kind: 'list' })}
          onSubmit={async (input: LiveFolderFormResult) => {
            try {
              await sendMessage({
                type: 'updateLiveFolder',
                folderId: view.folderId,
                source: input.source,
                refreshIntervalMin: input.refreshIntervalMin,
              })
              setView({ kind: 'list' })
              await refresh()
              sendMessage({ type: 'syncLiveFolder', folderId: view.folderId })
                .then(() => refresh())
                .catch((err) => console.error('[Spaces] post-edit sync', err))
            } catch (e) {
              handleError(e)
            }
          }}
        />
      </div>
    )
  }

  const spaces = Object.values(store.spaces)
    .filter((s) => s.windowId === windowId)
    .sort((a, b) => a.order - b.order)
  const activeId = store.activeSpaceByWindow[windowId]
  const active = spaces.find((s) => s.id === activeId) ?? spaces[0]

  return (
    <div className="root">
      <header className="header">
        <h1>Spaces</h1>
        <div className="header-actions">
          {tabGroupCount > 0 && (
            <button
              className="btn-icon"
              title={`Convert ${tabGroupCount} Chrome Tab Group${tabGroupCount === 1 ? '' : 's'} to Space${tabGroupCount === 1 ? '' : 's'}`}
              onClick={async () => {
                try {
                  await sendMessage({ type: 'importChromeTabGroups', windowId })
                  await refresh()
                } catch (e) {
                  handleError(e)
                }
              }}
            >
              ⇩{tabGroupCount}
            </button>
          )}
          <button
            className="btn-icon"
            title="New Space"
            onClick={async () => {
              try {
                await sendMessage({
                  type: 'createSpace',
                  payload: {
                    name: `Space ${spaces.length + 1}`,
                    color: COLORS[spaces.length % COLORS.length]!,
                    windowId,
                  },
                })
                await refresh()
              } catch (e) {
                handleError(e)
              }
            }}
          >
            +
          </button>
          <button
            className="btn-icon"
            title="Settings"
            onClick={() => setView({ kind: 'settings' })}
          >
            ⚙
          </button>
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
          <button
            className="btn-link"
            onClick={() => {
              setError(undefined)
              void refresh()
            }}
          >
            dismiss
          </button>
        </div>
      )}

      <div className="space-tabs">
        {spaces.map((sp) => {
          const isDragSource = drag?.kind === 'space' && drag.spaceId === sp.id
          const reorderHere =
            drag?.kind === 'space' &&
            !isDragSource &&
            dropPos?.kind === 'reorder-space' &&
            dropPos.targetSpaceId === sp.id
              ? dropPos.position
              : undefined
          return (
            <SpaceTab
              key={sp.id}
              space={sp}
              active={sp.id === active?.id}
              isDragging={isDragSource}
              isItemDropTarget={
                drag?.kind === 'item' &&
                dropPos?.kind === 'into-space' &&
                dropPos.spaceId === sp.id
              }
              reorderEdge={reorderHere}
              onClick={async () => {
                try {
                  await sendMessage({ type: 'switchTo', spaceId: sp.id, windowId })
                  await refresh()
                } catch (e) {
                  handleError(e)
                }
              }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', sp.id)
                setDrag({ kind: 'space', spaceId: sp.id })
              }}
              onDragEnd={() => {
                setDrag(undefined)
                setDropPos(undefined)
              }}
              onDragOver={
                drag
                  ? (e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      let next: DropPos
                      if (drag.kind === 'space') {
                        if (drag.spaceId === sp.id) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const before = e.clientX - rect.left < rect.width / 2
                        next = {
                          kind: 'reorder-space',
                          targetSpaceId: sp.id,
                          position: before ? 'before' : 'after',
                        }
                      } else {
                        next = {
                          kind: 'into-space',
                          spaceId: sp.id,
                          folderId: sp.rootFolderId,
                        }
                      }
                      if (!dropPos || dropPosKey(dropPos) !== dropPosKey(next)) {
                        setDropPos(next)
                      }
                    }
                  : undefined
              }
              onDrop={
                drag
                  ? (e) => {
                      e.preventDefault()
                      void finalizeDrop()
                    }
                  : undefined
              }
            />
          )
        })}
      </div>

      {!active ? (
        <p className="empty">No spaces yet — click + to create one.</p>
      ) : (
        <SpaceContent
          space={active}
          store={store}
          tabs={tabs}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onRefresh={refresh}
          onError={handleError}
          onCreateLive={(parentFolderId) =>
            setView({ kind: 'live-create', parentFolderId })
          }
          onEditLive={(folderId) => setView({ kind: 'live-edit', folderId })}
          drag={drag}
          setDrag={setDrag}
          dropPos={dropPos}
          setDropPos={setDropPos}
          onFinalizeDrop={finalizeDrop}
        />
      )}
    </div>
  )
}

function SpaceTab({
  space,
  active,
  isDragging,
  isItemDropTarget,
  reorderEdge,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  space: Space
  active: boolean
  isDragging?: boolean
  isItemDropTarget?: boolean
  reorderEdge?: 'before' | 'after'
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}) {
  const className = [
    'space-tab',
    active && 'is-active',
    isDragging && 'is-dragging',
    isItemDropTarget && 'is-drop-target',
    reorderEdge === 'before' && 'reorder-before',
    reorderEdge === 'after' && 'reorder-after',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      className={className}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      title={space.name}
    >
      <span
        className="space-tab-dot"
        style={{ background: COLOR_HEX[space.color] }}
        aria-hidden
      />
      {space.emoji ? (
        <span className="space-tab-emoji" aria-hidden>
          {space.emoji}
        </span>
      ) : null}
      <span className="space-tab-name">{space.name}</span>
    </button>
  )
}

interface ContentProps {
  space: Space
  store: SpaceStore
  tabs: Record<number, TabInfo>
  openMenu: string | undefined
  setOpenMenu: (v: string | undefined) => void
  onRefresh: () => Promise<void>
  onError: (e: unknown) => void
  onCreateLive: (parentFolderId: FolderId) => void
  onEditLive: (folderId: FolderId) => void
  // Drag-and-drop wiring.
  drag: DragState | undefined
  setDrag: (d: DragState | undefined) => void
  dropPos: DropPos | undefined
  setDropPos: (d: DropPos | undefined) => void
  onFinalizeDrop: () => Promise<void>
}

function SpaceContent(props: ContentProps) {
  const { space, store, tabs } = props
  const root = store.folders[space.rootFolderId]
  if (!root) return <p className="empty">(missing root folder)</p>

  const menuId = `space:${space.id}`
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(space.name)

  return (
    <div className="space-body">
      <div className="space-header">
        <span className="dot-large" style={{ background: COLOR_HEX[space.color] }} />
        {editingName ? (
          <input
            className="name-input"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={async () => {
              setEditingName(false)
              if (draftName.trim() && draftName !== space.name) {
                try {
                  await sendMessage({
                    type: 'renameSpace',
                    spaceId: space.id,
                    name: draftName.trim(),
                  })
                  await props.onRefresh()
                } catch (e) {
                  props.onError(e)
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setDraftName(space.name)
                setEditingName(false)
              }
            }}
          />
        ) : (
          <span className="space-header-name">
            {space.emoji ? `${space.emoji} ` : null}
            {space.name}
          </span>
        )}
        <button
          className="btn-link"
          onClick={(e) => {
            e.stopPropagation()
            props.setOpenMenu(props.openMenu === menuId ? undefined : menuId)
          }}
        >
          ⋯
        </button>
      </div>

      {props.openMenu === menuId && (
        <SpaceMenu
          space={space}
          onClose={() => props.setOpenMenu(undefined)}
          onRename={() => {
            setDraftName(space.name)
            setEditingName(true)
            props.setOpenMenu(undefined)
          }}
          onColor={async (color) => {
            try {
              await sendMessage({ type: 'setSpaceColor', spaceId: space.id, color })
              await props.onRefresh()
            } catch (e) {
              props.onError(e)
            }
          }}
          onEmoji={async (emoji) => {
            try {
              await sendMessage({ type: 'setSpaceEmoji', spaceId: space.id, emoji })
              await props.onRefresh()
            } catch (e) {
              props.onError(e)
            }
          }}
          onDelete={async (closeTabs) => {
            try {
              await sendMessage({ type: 'deleteSpace', spaceId: space.id, closeTabs })
              props.setOpenMenu(undefined)
              await props.onRefresh()
            } catch (e) {
              props.onError(e)
            }
          }}
        />
      )}

      <FolderView
        folder={root}
        store={store}
        tabs={tabs}
        depth={0}
        isRoot
        openMenu={props.openMenu}
        setOpenMenu={props.setOpenMenu}
        onRefresh={props.onRefresh}
        onError={props.onError}
        onCreateLive={props.onCreateLive}
        onEditLive={props.onEditLive}
        drag={props.drag}
        setDrag={props.setDrag}
        dropPos={props.dropPos}
        setDropPos={props.setDropPos}
        onFinalizeDrop={props.onFinalizeDrop}
      />
    </div>
  )
}

interface FolderViewProps {
  folder: Folder
  store: SpaceStore
  tabs: Record<number, TabInfo>
  depth: number
  isRoot?: boolean
  openMenu: string | undefined
  setOpenMenu: (v: string | undefined) => void
  onRefresh: () => Promise<void>
  onError: (e: unknown) => void
  onCreateLive: (parentFolderId: FolderId) => void
  onEditLive: (folderId: FolderId) => void
  drag: DragState | undefined
  setDrag: (d: DragState | undefined) => void
  dropPos: DropPos | undefined
  setDropPos: (d: DropPos | undefined) => void
  onFinalizeDrop: () => Promise<void>
}

function FolderView(props: FolderViewProps) {
  const { folder, store, tabs, depth, isRoot } = props
  const [collapsed, setCollapsed] = useState(folder.collapsed && !isRoot)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(folder.name)
  const menuId = `folder:${folder.id}`

  const liveError = folder.live?.lastSyncError
  const isLive = !!folder.live

  const isDropInto =
    props.dropPos?.kind === 'into-folder' && props.dropPos.folderId === folder.id
  const isDraggingThis =
    props.drag?.kind === 'item' &&
    props.drag.item.kind === 'folder' &&
    props.drag.item.folderId === folder.id
  // The folder cannot accept a drop coming from itself (would create a
  // self-cycle) — guard before allowing the into-folder target.
  const acceptsInto =
    props.drag?.kind === 'item' &&
    !isLive &&
    !(
      props.drag.item.kind === 'folder' &&
      props.drag.item.folderId === folder.id
    )

  return (
    <div className={`folder ${isDraggingThis ? 'is-dragging' : ''}`}>
      {!isRoot && (
        <div
          className={`folder-header ${isDropInto ? 'is-drop-into' : ''}`}
          style={{ paddingLeft: depth * 12 }}
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', folder.id)
            props.setDrag({
              kind: 'item',
              item: { kind: 'folder', folderId: folder.id },
            })
          }}
          onDragEnd={() => {
            props.setDrag(undefined)
            props.setDropPos(undefined)
          }}
          onDragOver={
            acceptsInto
              ? (e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  const next: DropPos = { kind: 'into-folder', folderId: folder.id }
                  if (
                    !props.dropPos ||
                    dropPosKey(props.dropPos) !== dropPosKey(next)
                  ) {
                    props.setDropPos(next)
                  }
                }
              : undefined
          }
          onDrop={
            acceptsInto
              ? (e) => {
                  e.preventDefault()
                  void props.onFinalizeDrop()
                }
              : undefined
          }
        >
          <button
            className="folder-toggle"
            onClick={async () => {
              const next = !collapsed
              setCollapsed(next)
              try {
                await sendMessage({
                  type: 'setFolderCollapsed',
                  folderId: folder.id,
                  collapsed: next,
                })
              } catch (e) {
                props.onError(e)
              }
            }}
          >
            {collapsed ? '▸' : '▾'}
          </button>
          {editingName ? (
            <input
              className="name-input small"
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={async () => {
                setEditingName(false)
                if (draftName.trim() && draftName !== folder.name) {
                  try {
                    await sendMessage({
                      type: 'renameFolder',
                      folderId: folder.id,
                      name: draftName.trim(),
                    })
                    await props.onRefresh()
                  } catch (e) {
                    props.onError(e)
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') {
                  setDraftName(folder.name)
                  setEditingName(false)
                }
              }}
            />
          ) : (
            <span className="folder-name">
              {folder.emoji ? `${folder.emoji} ` : null}
              {folder.name}
              {isLive && (
                <span className={`live-badge ${liveError ? 'has-error' : ''}`} title={liveError ?? 'Live folder'}>
                  {liveError ? '⚠' : 'live'}
                </span>
              )}
            </span>
          )}
          {isLive && (
            <button
              className="btn-link"
              title={liveError ?? 'Sync now'}
              onClick={async () => {
                try {
                  await sendMessage({ type: 'syncLiveFolder', folderId: folder.id })
                  await props.onRefresh()
                } catch (e) {
                  props.onError(e)
                }
              }}
            >
              ↻
            </button>
          )}
          <button
            className="btn-link"
            onClick={(e) => {
              e.stopPropagation()
              props.setOpenMenu(props.openMenu === menuId ? undefined : menuId)
            }}
          >
            ⋯
          </button>
          {props.openMenu === menuId && (
            <FolderMenu
              folder={folder}
              onClose={() => props.setOpenMenu(undefined)}
              onRename={() => {
                setDraftName(folder.name)
                setEditingName(true)
                props.setOpenMenu(undefined)
              }}
              onEmoji={async (emoji) => {
                try {
                  await sendMessage({
                    type: 'setFolderEmoji',
                    folderId: folder.id,
                    emoji,
                  })
                  await props.onRefresh()
                } catch (e) {
                  props.onError(e)
                }
              }}
              onEditLive={() => {
                props.setOpenMenu(undefined)
                props.onEditLive(folder.id)
              }}
              onDelete={async (closeTabs) => {
                try {
                  await sendMessage({
                    type: 'deleteFolder',
                    folderId: folder.id,
                    closeTabs,
                  })
                  props.setOpenMenu(undefined)
                  await props.onRefresh()
                } catch (e) {
                  props.onError(e)
                }
              }}
            />
          )}
        </div>
      )}

      {!collapsed && (
        <div className="folder-items">
          {folder.items.map((it, idx) => (
            <ItemRow
              key={itemKey(it, idx)}
              item={it}
              parentFolderId={folder.id}
              parentIsLive={isLive}
              indexInParent={idx}
              store={store}
              tabs={tabs}
              depth={depth + 1}
              openMenu={props.openMenu}
              setOpenMenu={props.setOpenMenu}
              onRefresh={props.onRefresh}
              onError={props.onError}
              onCreateLive={props.onCreateLive}
              onEditLive={props.onEditLive}
              drag={props.drag}
              setDrag={props.setDrag}
              dropPos={props.dropPos}
              setDropPos={props.setDropPos}
              onFinalizeDrop={props.onFinalizeDrop}
            />
          ))}
          {!isLive && (
            <div className="folder-add" style={{ paddingLeft: (depth + 1) * 12 }}>
              <button
                className="btn-link"
                onClick={async () => {
                  const name = prompt('Folder name?')
                  if (!name?.trim()) return
                  try {
                    await sendMessage({
                      type: 'createFolder',
                      payload: {
                        parentFolderId: folder.id,
                        name: name.trim(),
                      },
                    })
                    await props.onRefresh()
                  } catch (e) {
                    props.onError(e)
                  }
                }}
              >
                + Folder
              </button>
              <button
                className="btn-link"
                onClick={() => props.onCreateLive(folder.id)}
              >
                + Live folder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function itemKey(it: ItemRef, idx: number): string {
  return it.kind === 'tab' ? `t:${it.tabId}` : `f:${it.folderId}:${idx}`
}

type ItemRowProps = Omit<FolderViewProps, 'folder' | 'isRoot'> & {
  item: ItemRef
  parentFolderId: FolderId
  parentIsLive: boolean
  indexInParent: number
}

function ItemRow(props: ItemRowProps) {
  const { item, store, tabs, depth, parentFolderId, parentIsLive, indexInParent } = props
  if (item.kind === 'folder') {
    const f = store.folders[item.folderId]
    if (!f) return null
    return (
      <FolderView
        folder={f}
        store={store}
        tabs={tabs}
        depth={depth}
        openMenu={props.openMenu}
        setOpenMenu={props.setOpenMenu}
        onRefresh={props.onRefresh}
        onError={props.onError}
        onCreateLive={props.onCreateLive}
        onEditLive={props.onEditLive}
        drag={props.drag}
        setDrag={props.setDrag}
        dropPos={props.dropPos}
        setDropPos={props.setDropPos}
        onFinalizeDrop={props.onFinalizeDrop}
      />
    )
  }
  const tab = tabs[item.tabId]
  const tabRecord = store.tabs[item.tabId]
  const isPinned = !!tabRecord?.baseUrl
  const tabMenuId = `tab:${item.tabId}`
  const isDragging =
    props.drag?.kind === 'item' &&
    props.drag.item.kind === 'tab' &&
    props.drag.item.tabId === item.tabId
  const isDropAbove =
    props.dropPos?.kind === 'before-item' &&
    props.dropPos.folderId === parentFolderId &&
    props.dropPos.index === indexInParent
  const isDropBelow =
    props.dropPos?.kind === 'after-item' &&
    props.dropPos.folderId === parentFolderId &&
    props.dropPos.index === indexInParent
  return (
    <div
      className={[
        'tab-row',
        isDragging && 'is-dragging',
        isDropAbove && 'drop-above',
        isDropBelow && 'drop-below',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: depth * 12 }}
      // Tabs inside a Live folder cannot be reordered or moved out — the
      // sync engine owns their placement.
      draggable={!parentIsLive}
      onDragStart={
        !parentIsLive
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(item.tabId))
              props.setDrag({
                kind: 'item',
                item: { kind: 'tab', tabId: item.tabId },
              })
            }
          : undefined
      }
      onDragOver={
        props.drag?.kind === 'item' && !parentIsLive
          ? (e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const rect = e.currentTarget.getBoundingClientRect()
              const above = e.clientY - rect.top < rect.height / 2
              const next: DropPos = above
                ? { kind: 'before-item', folderId: parentFolderId, index: indexInParent }
                : { kind: 'after-item', folderId: parentFolderId, index: indexInParent }
              if (
                !props.dropPos ||
                dropPosKey(props.dropPos) !== dropPosKey(next)
              ) {
                props.setDropPos(next)
              }
            }
          : undefined
      }
      onDrop={
        props.drag?.kind === 'item' && !parentIsLive
          ? (e) => {
              e.preventDefault()
              void props.onFinalizeDrop()
            }
          : undefined
      }
      onDragEnd={() => {
        props.setDrag(undefined)
        props.setDropPos(undefined)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        props.setOpenMenu(props.openMenu === tabMenuId ? undefined : tabMenuId)
      }}
    >
      <button
        className="tab-main"
        onClick={async () => {
          try {
            await sendMessage({ type: 'activateTab', tabId: item.tabId })
          } catch (e) {
            props.onError(e)
          }
        }}
        title={tab?.url ?? ''}
      >
        {tab?.favIconUrl ? (
          <img className="favicon" src={tab.favIconUrl} alt="" />
        ) : (
          <span className="favicon-placeholder" aria-hidden />
        )}
        <span className="tab-title">
          {isPinned && <span className="pin-indicator" aria-label="Pinned">·</span>}
          {tab?.title || tab?.url || `(tab ${item.tabId})`}
        </span>
      </button>
      <button
        className="tab-close"
        title="Close"
        onClick={async () => {
          try {
            await sendMessage({ type: 'closeTab', tabId: item.tabId })
            await props.onRefresh()
          } catch (e) {
            props.onError(e)
          }
        }}
      >
        ×
      </button>
      {props.openMenu === tabMenuId && (
        <TabMenu
          isPinned={isPinned}
          onClose={() => props.setOpenMenu(undefined)}
          onPin={async () => {
            const url = tab?.url
            if (!url) return
            try {
              await sendMessage({ type: 'pinTab', tabId: item.tabId, baseUrl: url })
              props.setOpenMenu(undefined)
              await props.onRefresh()
            } catch (e) {
              props.onError(e)
            }
          }}
          onUnpin={async () => {
            try {
              await sendMessage({ type: 'unpinTab', tabId: item.tabId })
              props.setOpenMenu(undefined)
              await props.onRefresh()
            } catch (e) {
              props.onError(e)
            }
          }}
          onReset={async () => {
            try {
              await sendMessage({ type: 'resetTab', tabId: item.tabId })
              props.setOpenMenu(undefined)
            } catch (e) {
              props.onError(e)
            }
          }}
          onCloseTab={async () => {
            try {
              await sendMessage({ type: 'closeTab', tabId: item.tabId })
              props.setOpenMenu(undefined)
              await props.onRefresh()
            } catch (e) {
              props.onError(e)
            }
          }}
        />
      )}
    </div>
  )
}

function TabMenu({
  isPinned,
  onClose,
  onPin,
  onUnpin,
  onReset,
  onCloseTab,
}: {
  isPinned: boolean
  onClose: () => void
  onPin: () => void
  onUnpin: () => void
  onReset: () => void
  onCloseTab: () => void
}) {
  return (
    <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
      {isPinned ? (
        <>
          <button onClick={onReset}>Reset to base URL</button>
          <button onClick={onUnpin}>Unpin</button>
        </>
      ) : (
        <button onClick={onPin}>Pin to current URL</button>
      )}
      <div className="menu-divider" />
      <button className="danger" onClick={onCloseTab}>
        Close tab
      </button>
      <div className="menu-divider" />
      <button onClick={onClose}>Close menu</button>
    </div>
  )
}

// ---- Menus ---------------------------------------------------------------

function SpaceMenu({
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

function FolderMenu({
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

function firstGrapheme(input: string): string {
  if (!input) return ''
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const first = seg.segment(input)[Symbol.iterator]().next().value
  return first?.segment ?? ''
}

function EmojiInput({
  initial,
  onChange,
}: {
  initial: string | undefined
  onChange: (emoji: string | undefined) => void
}) {
  const [value, setValue] = useState(initial ?? '')
  useEffect(() => setValue(initial ?? ''), [initial])
  return (
    <div className="emoji-row">
      <input
        className="emoji-input"
        value={value}
        placeholder="🚀"
        onChange={(e) => setValue(firstGrapheme(e.target.value))}
        onBlur={(e) => {
          const v = firstGrapheme(e.target.value.trim())
          onChange(v === '' ? undefined : v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {initial && (
        <button
          className="btn-link"
          onClick={() => {
            setValue('')
            onChange(undefined)
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}

// ---- Settings panel ------------------------------------------------------

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState<boolean | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void sendMessage({ type: 'getGitHubToken' }).then(({ hasToken }) =>
      setHasToken(hasToken),
    )
  }, [])

  const handleSave = async () => {
    await sendMessage({ type: 'setGitHubToken', token: token || undefined })
    setHasToken(!!token)
    setToken('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <>
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
          Required scopes: <code>repo</code> (private PRs/issues) or <code>public_repo</code>.
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
    </>
  )
}
