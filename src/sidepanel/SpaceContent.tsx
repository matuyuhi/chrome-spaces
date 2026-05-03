import { useState } from 'react'
import { sendMessage } from '../shared/messaging'
import { type Space } from '../shared/types'
import { useAppCtx } from './AppContext'
import { COLOR_HEX } from './theme'
import { SpaceMenu } from './menus'
import { FolderView } from './FolderView'
import { MoreHorizontal } from './icons'

export function SpaceContent({ space }: { space: Space }) {
  const ctx = useAppCtx()
  const root = ctx.store.folders[space.rootFolderId]
  const menuId = `space:${space.id}`
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(space.name)

  if (!root) return <p className="empty">(missing root folder)</p>

  return (
    <div className="space-body">
      <div className="space-header">
        <span
          className="dot-small"
          style={{ background: COLOR_HEX[space.color] }}
        />
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
          <span className="space-header-name">
            {space.emoji ? `${space.emoji} ` : null}
            {space.name}
          </span>
        )}
        <button
          className="icon-btn"
          onClick={(e) => {
            e.stopPropagation()
            ctx.setOpenMenu(ctx.openMenu === menuId ? undefined : menuId)
          }}
          aria-label="Space menu"
        >
          <MoreHorizontal size={16} />
        </button>
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
      </div>

      <FolderView folder={root} depth={0} isRoot />
    </div>
  )
}
