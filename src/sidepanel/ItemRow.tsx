import { sendMessage } from '../shared/messaging'
import { type FolderId, type ItemRef } from '../shared/types'
import { useAppCtx } from './AppContext'
import { type DropPos, dropPosKey } from './dnd'
import { TabMenu } from './menus'
import { FolderView } from './FolderView'
import { Minus, X } from './icons'

interface Props {
  item: ItemRef
  parentFolderId: FolderId
  parentIsLive: boolean
  indexInParent: number
  depth: number
}

export function ItemRow({
  item,
  parentFolderId,
  parentIsLive,
  indexInParent,
  depth,
}: Props) {
  const ctx = useAppCtx()
  if (item.kind === 'folder') {
    const f = ctx.store.folders[item.folderId]
    if (!f) return null
    return <FolderView folder={f} depth={depth} />
  }

  const tab = ctx.tabs[item.tabId]
  const tabRecord = ctx.store.tabs[item.tabId]
  const isPinned = !!tabRecord?.baseUrl
  const tabMenuId = `tab:${item.tabId}`
  // Resolve the URL the − button would jump back to. Live folders always
  // have a base (managedTab.url, treated as canonical and preferred over
  // any user-set baseUrl), so the button is shown for every Live tab.
  // Manually-pinned tabs use their stored baseUrl.
  const resetTargetUrl = (() => {
    if (parentIsLive) {
      for (const f of Object.values(ctx.store.folders)) {
        const m = f.live?.managedTabs.find((mt) => mt.tabId === item.tabId)
        if (m) return m.url
      }
    }
    return tabRecord?.baseUrl
  })()
  const hasResetTarget = !!resetTargetUrl

  const isDragging =
    ctx.drag?.kind === 'item' &&
    ctx.drag.item.kind === 'tab' &&
    ctx.drag.item.tabId === item.tabId
  const isDropAbove =
    ctx.dropPos?.kind === 'before-item' &&
    ctx.dropPos.folderId === parentFolderId &&
    ctx.dropPos.index === indexInParent
  const isDropBelow =
    ctx.dropPos?.kind === 'after-item' &&
    ctx.dropPos.folderId === parentFolderId &&
    ctx.dropPos.index === indexInParent

  const className = [
    'tab-row',
    tab?.active && 'is-active',
    isDragging && 'is-dragging',
    isDropAbove && 'drop-above',
    isDropBelow && 'drop-below',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      style={{ paddingLeft: depth * 12 }}
      // Tabs inside a Live folder cannot be reordered or moved out — the
      // sync engine owns their placement.
      draggable={!parentIsLive}
      onDragStart={
        !parentIsLive
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(item.tabId))
              ctx.setDrag({
                kind: 'item',
                item: { kind: 'tab', tabId: item.tabId },
              })
            }
          : undefined
      }
      onDragOver={
        ctx.drag?.kind === 'item' && !parentIsLive
          ? (e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              const rect = e.currentTarget.getBoundingClientRect()
              const above = e.clientY - rect.top < rect.height / 2
              const next: DropPos = above
                ? { kind: 'before-item', folderId: parentFolderId, index: indexInParent }
                : { kind: 'after-item', folderId: parentFolderId, index: indexInParent }
              if (!ctx.dropPos || dropPosKey(ctx.dropPos) !== dropPosKey(next)) {
                ctx.setDropPos(next)
              }
            }
          : undefined
      }
      onDrop={
        ctx.drag?.kind === 'item' && !parentIsLive
          ? (e) => {
              e.preventDefault()
              void ctx.finalizeDrop()
            }
          : undefined
      }
      onDragEnd={() => {
        ctx.setDrag(undefined)
        ctx.setDropPos(undefined)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        ctx.setOpenMenu(ctx.openMenu === tabMenuId ? undefined : tabMenuId)
      }}
    >
      <button
        className="tab-main"
        onClick={async () => {
          try {
            await sendMessage({ type: 'activateTab', tabId: item.tabId })
          } catch (e) {
            ctx.onError(e)
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
          {tab?.title || tab?.url || `(tab ${item.tabId})`}
        </span>
      </button>
      {hasResetTarget && (
        <button
          className="tab-reset icon-btn"
          title={`Jump back to ${resetTargetUrl}`}
          onClick={async (e) => {
            e.stopPropagation()
            try {
              await sendMessage({ type: 'resetTab', tabId: item.tabId })
            } catch (err) {
              ctx.onError(err)
            }
          }}
          aria-label="Reset to base URL"
        >
          <Minus size={14} />
        </button>
      )}
      <button
        className="tab-close icon-btn"
        title="Close"
        onClick={async () => {
          try {
            await sendMessage({ type: 'closeTab', tabId: item.tabId })
            await ctx.refresh()
          } catch (e) {
            ctx.onError(e)
          }
        }}
        aria-label="Close tab"
      >
        <X size={14} />
      </button>
      {ctx.openMenu === tabMenuId && (
        <TabMenu
          canReset={hasResetTarget}
          canPin={!parentIsLive && !isPinned}
          canUnpin={!parentIsLive && isPinned}
          onClose={() => ctx.setOpenMenu(undefined)}
          onPin={async () => {
            const url = tab?.url
            if (!url) return
            try {
              await sendMessage({ type: 'pinTab', tabId: item.tabId, baseUrl: url })
              ctx.setOpenMenu(undefined)
              await ctx.refresh()
            } catch (e) {
              ctx.onError(e)
            }
          }}
          onUnpin={async () => {
            try {
              await sendMessage({ type: 'unpinTab', tabId: item.tabId })
              ctx.setOpenMenu(undefined)
              await ctx.refresh()
            } catch (e) {
              ctx.onError(e)
            }
          }}
          onReset={async () => {
            try {
              await sendMessage({ type: 'resetTab', tabId: item.tabId })
              ctx.setOpenMenu(undefined)
            } catch (e) {
              ctx.onError(e)
            }
          }}
          onCloseTab={async () => {
            try {
              await sendMessage({ type: 'closeTab', tabId: item.tabId })
              ctx.setOpenMenu(undefined)
              await ctx.refresh()
            } catch (e) {
              ctx.onError(e)
            }
          }}
        />
      )}
    </div>
  )
}
