import styled from '@emotion/styled'
import { useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type Space } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { COLOR_HEX, tokens } from '../theme'
import { SpaceMenu } from './menus'
import { FolderView } from './FolderView'
import { IconButton } from '../atoms/IconButton'
import { ColorDot } from '../atoms/ColorDot'
import { NameInput } from '../atoms/NameInput'
import { MoreHorizontal } from '../atoms/icons'

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  position: relative;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 2px 4px;
  position: relative;
`

const Name = styled.span`
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${tokens.fg};
`

export function SpaceContent({ space }: { space: Space }) {
  const ctx = useAppCtx()
  const root = ctx.store.folders[space.rootFolderId]
  const menuId = `space:${space.id}`
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(space.name)

  if (!root) return <p>(missing root folder)</p>

  return (
    <Body
      onDoubleClick={async (e) => {
        // Only fire when the click lands on the empty area itself, not on
        // any folder/tab row that bubbled up.
        if (e.target !== e.currentTarget) return
        try {
          await chrome.tabs.create({ windowId: ctx.windowId, active: true })
          // chrome.tabs.onCreated → registerTab will append the new tab
          // to this Space's root folder; just refresh to surface it.
          await ctx.refresh()
        } catch (err) {
          ctx.onError(err)
        }
      }}
    >
      <Header>
        <ColorDot color={COLOR_HEX[space.color]} size={4} />
        {editingName ? (
          <NameInput
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
                  await ctx.refresh()
                } catch (e) {
                  ctx.onError(e)
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
          <Name>
            {space.emoji ? `${space.emoji} ` : null}
            {space.name}
          </Name>
        )}
        <IconButton
          onClick={(e) => {
            e.stopPropagation()
            ctx.setOpenMenu(ctx.openMenu === menuId ? undefined : menuId)
          }}
          aria-label="Space menu"
        >
          <MoreHorizontal size={16} />
        </IconButton>
        {ctx.openMenu === menuId && (
          <SpaceMenu
            space={space}
            onClose={() => ctx.setOpenMenu(undefined)}
            onRename={() => {
              setDraftName(space.name)
              setEditingName(true)
              ctx.setOpenMenu(undefined)
            }}
            onColor={async (color) => {
              try {
                await sendMessage({ type: 'setSpaceColor', spaceId: space.id, color })
                await ctx.refresh()
              } catch (e) {
                ctx.onError(e)
              }
            }}
            onEmoji={async (emoji) => {
              try {
                await sendMessage({ type: 'setSpaceEmoji', spaceId: space.id, emoji })
                await ctx.refresh()
              } catch (e) {
                ctx.onError(e)
              }
            }}
            onDelete={async (closeTabs) => {
              try {
                await sendMessage({
                  type: 'deleteSpace',
                  spaceId: space.id,
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
      </Header>

      <FolderView folder={root} depth={0} isRoot />
    </Body>
  )
}
