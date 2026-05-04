import { sendMessage } from '../../shared/messaging'
import { type FolderId, type ItemRef, type ManagedTab } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { type DropPos, dropPosKey } from '../dnd'
import { TabMenu } from './menus'
import { FolderView } from './FolderView'
import { Minus, X } from '../atoms/icons'
import {
  CloseButton,
  Favicon,
  FaviconPlaceholder,
  PinDot,
  ResetButton,
  TabMain,
  TabRowBox,
  TabTitle,
} from '../molecules/TabRow'

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

  if (item.kind === 'live') {
    const parent = ctx.store.folders[parentFolderId]
    const managed = parent?.live?.managedTabs.find(
      (m) => m.externalId === item.externalId,
    )
    if (!managed) return null
    return (
      <LiveRow
        managed={managed}
        parentFolderId={parentFolderId}
        depth={depth}
      />
    )
  }

  const tab = ctx.tabs[item.tabId]
  const tabRecord = ctx.store.tabs[item.tabId]
  const isPinned = !!tabRecord?.baseUrl
  const tabMenuId = `tab:${item.tabId}`
  const resetTargetUrl = tabRecord?.baseUrl
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

  return (
    <TabRowBox
      isActive={tab?.active}
      isDragging={isDragging}
      dropAbove={isDropAbove}
      dropBelow={isDropBelow}
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
      <TabMain
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
          <Favicon src={tab.favIconUrl} alt="" />
        ) : (
          <FaviconPlaceholder aria-hidden />
        )}
        <TabTitle active={tab?.active}>
          {isPinned && <PinDot aria-label="Pinned" />}
          {tab?.title || tab?.url || '(missing tab — click × to remove)'}
        </TabTitle>
      </TabMain>
      {hasResetTarget && (
        <ResetButton
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
        </ResetButton>
      )}
      <CloseButton
        className="close-btn"
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
      </CloseButton>
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
    </TabRowBox>
  )
}

interface LiveRowProps {
  managed: ManagedTab
  parentFolderId: FolderId
  depth: number
}

function LiveRow({ managed, parentFolderId, depth }: LiveRowProps) {
  const ctx = useAppCtx()
  const tabId = managed.tabId
  const tab = typeof tabId === 'number' ? ctx.tabs[tabId] : undefined
  const isMaterialized = !!tab
  // Show "reset" only when the user has navigated away from the live URL.
  const showReset =
    isMaterialized && typeof tab?.url === 'string' && tab.url !== managed.url

  const titleText = tab?.title || managed.title || managed.url

  const click = async () => {
    try {
      if (isMaterialized && typeof tabId === 'number') {
        await sendMessage({ type: 'activateTab', tabId })
      } else {
        await sendMessage({
          type: 'materializeLiveTab',
          folderId: parentFolderId,
          externalId: managed.externalId,
        })
        await ctx.refresh()
      }
    } catch (e) {
      ctx.onError(e)
    }
  }

  return (
    <TabRowBox
      isActive={tab?.active}
      style={{ paddingLeft: depth * 12 }}
    >
      <TabMain onClick={click} title={managed.url}>
        {tab?.favIconUrl ? (
          <Favicon src={tab.favIconUrl} alt="" />
        ) : (
          <FaviconPlaceholder aria-hidden />
        )}
        <TabTitle active={tab?.active}>{titleText}</TabTitle>
      </TabMain>
      {showReset && typeof tabId === 'number' && (
        <ResetButton
          title={`Jump back to ${managed.url}`}
          onClick={async (e) => {
            e.stopPropagation()
            try {
              await sendMessage({ type: 'resetTab', tabId })
            } catch (err) {
              ctx.onError(err)
            }
          }}
          aria-label="Reset to base URL"
        >
          <Minus size={14} />
        </ResetButton>
      )}
      {isMaterialized && typeof tabId === 'number' && (
        <CloseButton
          className="close-btn"
          title="Close (returns to link state)"
          onClick={async (e) => {
            e.stopPropagation()
            try {
              await sendMessage({ type: 'closeTab', tabId })
              await ctx.refresh()
            } catch (err) {
              ctx.onError(err)
            }
          }}
          aria-label="Close tab"
        >
          <X size={14} />
        </CloseButton>
      )}
    </TabRowBox>
  )
}
