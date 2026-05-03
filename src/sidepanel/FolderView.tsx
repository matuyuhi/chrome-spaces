import { useState } from 'react'
import { sendMessage } from '../shared/messaging'
import { type Folder } from '../shared/types'
import { useAppCtx } from './AppContext'
import { type DropPos, dropPosKey, itemKey } from './dnd'
import { FolderMenu } from './menus'
import { ItemRow } from './ItemRow'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  LiveGraph,
  MoreHorizontal,
  RefreshCw,
} from './icons'

interface Props {
  folder: Folder
  depth: number
  isRoot?: boolean
}

export function FolderView({ folder, depth, isRoot }: Props) {
  const ctx = useAppCtx()
  const [collapsed, setCollapsed] = useState(folder.collapsed && !isRoot)
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(folder.name)
  const [syncing, setSyncing] = useState(false)
  const menuId = `folder:${folder.id}`

  const liveError = folder.live?.lastSyncError
  const isLive = !!folder.live

  const isDropInto =
    ctx.dropPos?.kind === 'into-folder' && ctx.dropPos.folderId === folder.id
  const isDraggingThis =
    ctx.drag?.kind === 'item' &&
    ctx.drag.item.kind === 'folder' &&
    ctx.drag.item.folderId === folder.id
  // Cannot drop a folder into itself / a Live folder.
  const acceptsInto =
    ctx.drag?.kind === 'item' &&
    !isLive &&
    !(
      ctx.drag.item.kind === 'folder' && ctx.drag.item.folderId === folder.id
    )

  return (
    <div className={`folder ${isDraggingThis ? 'is-dragging' : ''}`}>
      {!isRoot && (
        <div
          className={[
            'folder-header',
            isDropInto && 'is-drop-into',
            isLive && 'is-live',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ paddingLeft: depth * 12 }}
          draggable
          onDragStart={(e) => {
            e.stopPropagation()
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', folder.id)
            ctx.setDrag({
              kind: 'item',
              item: { kind: 'folder', folderId: folder.id },
            })
          }}
          onDragEnd={() => {
            ctx.setDrag(undefined)
            ctx.setDropPos(undefined)
          }}
          onDragOver={
            acceptsInto
              ? (e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  const next: DropPos = { kind: 'into-folder', folderId: folder.id }
                  if (!ctx.dropPos || dropPosKey(ctx.dropPos) !== dropPosKey(next)) {
                    ctx.setDropPos(next)
                  }
                }
              : undefined
          }
          onDrop={
            acceptsInto
              ? (e) => {
                  e.preventDefault()
                  void ctx.finalizeDrop()
                }
              : undefined
          }
        >
          <button
            className="folder-toggle icon-btn"
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
                ctx.onError(e)
              }
            }}
            aria-label={collapsed ? 'Expand folder' : 'Collapse folder'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
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
                    await ctx.refresh()
                  } catch (e) {
                    ctx.onError(e)
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
              {isLive && (
                <span
                  className={`live-graph-wrap ${liveError ? 'has-error' : ''}`}
                  title={liveError ?? 'Live folder'}
                >
                  <LiveGraph size={20} />
                </span>
              )}
              {folder.emoji ? `${folder.emoji} ` : null}
              {folder.name}
              {isLive && liveError && (
                <span className="live-error" title={liveError}>
                  <AlertTriangle size={12} />
                </span>
              )}
            </span>
          )}
          {isLive && (
            <button
              className={`icon-btn sync-btn ${syncing ? 'is-syncing' : ''}`}
              title={liveError ?? 'Sync now'}
              disabled={syncing}
              onClick={async () => {
                if (syncing) return
                setSyncing(true)
                try {
                  await sendMessage({ type: 'syncLiveFolder', folderId: folder.id })
                  await ctx.refresh()
                } catch (e) {
                  ctx.onError(e)
                } finally {
                  // Hold the spin a bit so a snappy network response still
                  // gives visible feedback, then let go.
                  setTimeout(() => setSyncing(false), 350)
                }
              }}
              aria-label="Sync"
            >
              <RefreshCw size={14} className="sync-icon" />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              ctx.setOpenMenu(ctx.openMenu === menuId ? undefined : menuId)
            }}
            aria-label="Folder menu"
          >
            <MoreHorizontal size={14} />
          </button>
          {ctx.openMenu === menuId && (
            <FolderMenu
              folder={folder}
              onClose={() => ctx.setOpenMenu(undefined)}
              onRename={() => {
                setDraftName(folder.name)
                setEditingName(true)
                ctx.setOpenMenu(undefined)
              }}
              onEmoji={async (emoji) => {
                try {
                  await sendMessage({
                    type: 'setFolderEmoji',
                    folderId: folder.id,
                    emoji,
                  })
                  await ctx.refresh()
                } catch (e) {
                  ctx.onError(e)
                }
              }}
              onEditLive={() => {
                ctx.setOpenMenu(undefined)
                ctx.onEditLive(folder.id)
              }}
              onDelete={async (closeTabs) => {
                try {
                  await sendMessage({
                    type: 'deleteFolder',
                    folderId: folder.id,
                    closeTabs,
                  })
                  ctx.setOpenMenu(undefined)
                  await ctx.refresh()
                } catch (e) {
                  ctx.onError(e)
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
              depth={depth + 1}
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
                    await ctx.refresh()
                  } catch (e) {
                    ctx.onError(e)
                  }
                }}
              >
                + Folder
              </button>
              <button className="btn-link" onClick={() => ctx.onCreateLive(folder.id)}>
                + Live folder
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
