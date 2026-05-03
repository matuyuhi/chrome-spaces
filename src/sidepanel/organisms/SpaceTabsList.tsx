import styled from '@emotion/styled'
import { useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type Space, type SpaceColor } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { type DropPos, dropPosKey } from '../dnd'
import { SpaceTab } from '../molecules/SpaceTab'
import { SpaceMenu } from './menus'

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const Wrap = styled.div<{ menuAlign?: 'left' | 'right' }>`
  position: relative;
  display: inline-flex;

  ${(p) =>
    p.menuAlign === 'left' &&
    `
    > .menu, > [role="menu"] { left: 0; right: auto; }
  `}
  ${(p) =>
    p.menuAlign === 'right' &&
    `
    > .menu, > [role="menu"] { right: 0; left: auto; }
  `}
`

interface Props {
  spaces: Space[]
  active: Space | undefined
  windowId: number
}

// The horizontal Space pill bar at the top of the side panel. Owns:
// - click to switch
// - right-click to open SpaceMenu (rename / color / emoji / delete)
// - drag to reorder (kind: 'space' DragState)
// - drop target for tab drops (kind: 'item' DragState → into-space)
export function SpaceTabsList({ spaces, active, windowId }: Props) {
  const ctx = useAppCtx()
  // Anchor side picked at open time so the menu doesn't overflow whichever
  // edge the pill happens to sit near.
  const [pillMenuAlign, setPillMenuAlign] = useState<'left' | 'right'>('left')

  return (
    <Bar>
      {spaces.map((sp) => {
        const isDragSource = ctx.drag?.kind === 'space' && ctx.drag.spaceId === sp.id
        const reorderHere =
          ctx.drag?.kind === 'space' &&
          !isDragSource &&
          ctx.dropPos?.kind === 'reorder-space' &&
          ctx.dropPos.targetSpaceId === sp.id
            ? ctx.dropPos.position
            : undefined
        const pillMenuId = `spacepill:${sp.id}`
        const isOpen = ctx.openMenu === pillMenuId

        return (
          <Wrap key={sp.id} menuAlign={isOpen ? pillMenuAlign : 'left'}>
            <SpaceTab
              space={sp}
              active={sp.id === active?.id}
              isDragging={isDragSource}
              isItemDropTarget={
                ctx.drag?.kind === 'item' &&
                ctx.dropPos?.kind === 'into-space' &&
                ctx.dropPos.spaceId === sp.id
              }
              reorderEdge={reorderHere}
              onClick={async () => {
                try {
                  await sendMessage({
                    type: 'switchTo',
                    spaceId: sp.id,
                    windowId,
                  })
                  await ctx.refresh()
                } catch (e) {
                  ctx.onError(e)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (ctx.openMenu === pillMenuId) {
                  ctx.setOpenMenu(undefined)
                  return
                }
                const rect = e.currentTarget.getBoundingClientRect()
                const panelWidth = document.documentElement.clientWidth
                setPillMenuAlign(
                  rect.left + rect.width / 2 > panelWidth / 2 ? 'right' : 'left',
                )
                ctx.setOpenMenu(pillMenuId)
              }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', sp.id)
                ctx.setDrag({ kind: 'space', spaceId: sp.id })
              }}
              onDragEnd={() => {
                ctx.setDrag(undefined)
                ctx.setDropPos(undefined)
              }}
              onDragOver={
                ctx.drag
                  ? (e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      let next: DropPos
                      if (ctx.drag!.kind === 'space') {
                        if (ctx.drag!.spaceId === sp.id) return
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
                      if (
                        !ctx.dropPos ||
                        dropPosKey(ctx.dropPos) !== dropPosKey(next)
                      ) {
                        ctx.setDropPos(next)
                      }
                    }
                  : undefined
              }
              onDrop={
                ctx.drag
                  ? (e) => {
                      e.preventDefault()
                      void ctx.finalizeDrop()
                    }
                  : undefined
              }
            />
            {isOpen && (
              <SpaceMenu
                space={sp}
                onClose={() => ctx.setOpenMenu(undefined)}
                onRename={async () => {
                  const name = prompt('New Space name?', sp.name)
                  ctx.setOpenMenu(undefined)
                  if (!name?.trim() || name === sp.name) return
                  try {
                    await sendMessage({
                      type: 'renameSpace',
                      spaceId: sp.id,
                      name: name.trim(),
                    })
                    await ctx.refresh()
                  } catch (e) {
                    ctx.onError(e)
                  }
                }}
                onColor={async (color: SpaceColor) => {
                  try {
                    await sendMessage({
                      type: 'setSpaceColor',
                      spaceId: sp.id,
                      color,
                    })
                    await ctx.refresh()
                  } catch (e) {
                    ctx.onError(e)
                  }
                }}
                onEmoji={async (emoji) => {
                  try {
                    await sendMessage({
                      type: 'setSpaceEmoji',
                      spaceId: sp.id,
                      emoji,
                    })
                    await ctx.refresh()
                  } catch (e) {
                    ctx.onError(e)
                  }
                }}
                onDelete={async (closeTabs) => {
                  ctx.setOpenMenu(undefined)
                  try {
                    await sendMessage({
                      type: 'deleteSpace',
                      spaceId: sp.id,
                      closeTabs,
                    })
                    await ctx.refresh()
                  } catch (e) {
                    ctx.onError(e)
                  }
                }}
              />
            )}
          </Wrap>
        )
      })}
    </Bar>
  )
}
