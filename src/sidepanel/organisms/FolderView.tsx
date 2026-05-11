import styled from '@emotion/styled'
import { useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type Folder } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { useEditMode } from '../hooks/useEditMode'
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

// Hover-to-reveal driven by static class names instead of an emotion
// component selector — same Storybook-runner constraint as CloseButton /
// TabRow. The grid-template-rows: 0fr → 1fr trick is the "animate to
// height: auto" pattern that's been the standard for years; no modern
// CSS features (@starting-style, interpolate-size, allow-discrete) needed.
const FolderBox = styled.div<{ isDragging?: boolean }>`
  display: flex;
  flex-direction: column;
  opacity: ${(p) => (p.isDragging ? 0.4 : 1)};

  /* Show this folder's own add-row when hovered/focused, but suppress
     it while a nested folder-box is the actual target — otherwise
     hovering a deep child also lights up every ancestor's "+ Folder"
     affordance. */
  &:hover:not(:has(.folder-box:hover)) > .items > .add-row,
  &:focus-within:not(:has(.folder-box:focus-within)) > .items > .add-row {
    grid-template-rows: 1fr;
    opacity: 1;
  }
`

const Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`

const AddRow = styled.div`
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 160ms ease-out,
    opacity 140ms ease-out;
`

const AddRowInner = styled.div`
  min-height: 0;
  overflow: hidden;
  display: flex;
  gap: 12px;
  padding: 4px 0 6px;
`

interface Props {
  folder: Folder
  depth: number
  isRoot?: boolean
}

interface FolderHeaderRowProps {
  folder: Folder
  depth: number
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  isLive: boolean
  liveError?: string
  isDropInto: boolean
  acceptsInto: boolean
  handleAddFolder: () => Promise<void>
}

function FolderHeaderRow({
  folder,
  depth,
  collapsed,
  setCollapsed,
  isLive,
  liveError,
  isDropInto,
  acceptsInto,
  handleAddFolder,
}: FolderHeaderRowProps) {
  const ctx = useAppCtx()
  const edit = useEditMode(folder.name)
  const [syncing, setSyncing] = useState(false)
  const menuId = `folder:${folder.id}`

  return (
    <FolderHeaderBox
      isDropInto={isDropInto}
      isLive={isLive}
      style={{ paddingLeft: depth * 12 }}
      draggable
      onDoubleClick={async (e) => {
        // Skip when the dblclick lands on an interactive control
        // (toggle / sync / menu button or the rename input).
        if ((e.target as HTMLElement).closest('button, input')) return
        if (isLive) return
        e.stopPropagation()
        try {
          const tab = await chrome.tabs.create({
            windowId: ctx.windowId,
            active: true,
          })
          if (typeof tab.id === 'number') {
            await sendMessage({
              type: 'addTabsToFolder',
              folderId: folder.id,
              tabIds: [tab.id],
            })
            await ctx.refresh()
          }
        } catch (err) {
          ctx.onError(err)
        }
      }}
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
      {edit.isEditing ? (
        <NameInput
          small
          autoFocus
          value={edit.draft}
          onChange={(e) => edit.setDraft(e.target.value)}
          onBlur={async () => {
            edit.stop()
            if (edit.draft.trim() && edit.draft !== folder.name) {
              try {
                await sendMessage({
                  type: 'renameFolder',
                  folderId: folder.id,
                  name: edit.draft.trim(),
                })
                await ctx.refresh()
              } catch (e) {
                ctx.onError(e)
              }
            }
          }}
          onKeyDown={edit.handleKeyDown}
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
            edit.start()
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
          onAddFolder={() => {
            ctx.setOpenMenu(undefined)
            void handleAddFolder()
          }}
          onAddLive={() => {
            ctx.setOpenMenu(undefined)
            ctx.onCreateLive(folder.id)
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
  )
}

export function FolderView({ folder, depth, isRoot }: Props) {
  const ctx = useAppCtx()
  const [collapsed, setCollapsed] = useState(folder.collapsed && !isRoot)

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

  const showAddRow = !isLive && (isRoot || ctx.prefs.showAddRowsInNestedFolders)

  const handleAddFolder = async () => {
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
  }

  return (
    <FolderBox className="folder-box" isDragging={isDraggingThis}>
      {!isRoot && (
        <FolderHeaderRow
          folder={folder}
          depth={depth}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          isLive={isLive}
          liveError={liveError}
          isDropInto={isDropInto}
          acceptsInto={acceptsInto}
          handleAddFolder={handleAddFolder}
        />
      )}

      {!collapsed && (
        <Items className="items">
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
          {showAddRow && (
            <AddRow className="add-row">
              <AddRowInner style={{ paddingLeft: (depth + 1) * 12 }}>
                <LinkButton onClick={() => void handleAddFolder()}>
                  + Folder
                </LinkButton>
                <LinkButton onClick={() => ctx.onCreateLive(folder.id)}>
                  + Live folder
                </LinkButton>
              </AddRowInner>
            </AddRow>
          )}
        </Items>
      )}
    </FolderBox>
  )
}
