import styled from '@emotion/styled'
import { useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type Folder } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { type DropPos, dropPosKey, itemKey } from '../dnd'
import { FolderMenu } from './menus'
import { ItemRow } from './ItemRow'
import { IconButton } from '../atoms/IconButton'
import { LinkButton } from '../atoms/Button'
import { NameInput } from '../atoms/NameInput'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from '../atoms/icons'
import {
  FolderHeaderBox,
  FolderName,
  LiveErrorBadge,
} from '../molecules/FolderHeader'
import { RunCat } from '../molecules/RunCat'
import { SyncButton } from '../molecules/SyncButton'

// Hover-to-reveal driven by a static .add-row class instead of an
// emotion component selector — same Storybook-runner constraint as
// CloseButton / TabRow.
const FolderBox = styled.div<{ isDragging?: boolean }>`
  display: flex;
  flex-direction: column;
  opacity: ${(p) => (p.isDragging ? 0.4 : 1)};

  &:hover .add-row {
    opacity: 1;
  }
`

const Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`

const AddRow = styled.div`
  display: flex;
  gap: 12px;
  padding: 4px 0 6px;
  opacity: 0;
  transition: opacity 80ms ease;
`

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
  const acceptsInto =
    ctx.drag?.kind === 'item' &&
    !isLive &&
    !(ctx.drag.item.kind === 'folder' && ctx.drag.item.folderId === folder.id)

  return (
    <FolderBox isDragging={isDraggingThis}>
      {!isRoot && (
        <FolderHeaderBox
          isDropInto={isDropInto}
          isLive={isLive}
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
          <IconButton
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
          </IconButton>
          {editingName ? (
            <NameInput
              small
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
            <FolderName>
              {isLive && (
                <RunCat
                  size={24}
                  hasError={!!liveError}
                  title={liveError ?? 'Live folder'}
                />
              )}
              {folder.emoji ? `${folder.emoji} ` : null}
              {folder.name}
              {isLive && liveError && (
                <LiveErrorBadge title={liveError}>
                  <AlertTriangle size={12} />
                </LiveErrorBadge>
              )}
            </FolderName>
          )}
          {isLive && (
            <SyncButton
              syncing={syncing}
              title={liveError ?? 'Sync now'}
              onClick={async () => {
                if (syncing) return
                setSyncing(true)
                try {
                  await sendMessage({ type: 'syncLiveFolder', folderId: folder.id })
                  await ctx.refresh()
                } catch (e) {
                  ctx.onError(e)
                } finally {
                  setTimeout(() => setSyncing(false), 350)
                }
              }}
            />
          )}
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              ctx.setOpenMenu(ctx.openMenu === menuId ? undefined : menuId)
            }}
            aria-label="Folder menu"
          >
            <MoreHorizontal size={14} />
          </IconButton>
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
        </FolderHeaderBox>
      )}

      {!collapsed && (
        <Items>
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
            <AddRow className="add-row" style={{ paddingLeft: (depth + 1) * 12 }}>
              <LinkButton
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
              </LinkButton>
              <LinkButton onClick={() => ctx.onCreateLive(folder.id)}>
                + Live folder
              </LinkButton>
            </AddRow>
          )}
        </Items>
      )}
    </FolderBox>
  )
}
