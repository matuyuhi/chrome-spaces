import { useCallback, useEffect, useState } from 'react'
import { sendMessage } from '../shared/messaging'
import {
  type FolderId,
  type SpaceStore,
} from '../shared/types'
import { LiveFolderForm, type LiveFolderFormResult } from './LiveFolderForm'
import { SettingsPanel } from './SettingsPanel'
import { SpaceTab } from './SpaceTab'
import { SpaceContent } from './SpaceContent'
import { SpaceMenu } from './menus'
import { AppCtxProvider, type AppCtx } from './AppContext'
import { type DragState, type DropPos, type TabInfo, dropPosKey } from './dnd'
import { COLORS, applyFontSize } from './theme'
import { Download, Plus, Settings as SettingsIcon } from './icons'

type View =
  | { kind: 'list' }
  | { kind: 'settings' }
  | { kind: 'live-create'; parentFolderId: FolderId }
  | { kind: 'live-edit'; folderId: FolderId }

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
  // Tracks which side the pill's context menu should anchor to. Without
  // this, a left-anchored menu opens off-screen for pills near the right
  // edge of the panel, and vice-versa.
  const [pillMenuAlign, setPillMenuAlign] = useState<'left' | 'right'>('left')

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
          active: t.active ?? false,
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
        const ordered = (await sendMessage({ type: 'getStore' })).spaces
        const inWindow = Object.values(ordered)
          .filter((sp) => sp.windowId === windowId)
          .sort((a, b) => a.order - b.order)
        const sourceIdx = inWindow.findIndex((sp) => sp.id === dragSnap.spaceId)
        const targetIdx = inWindow.findIndex(
          (sp) => sp.id === target.targetSpaceId,
        )
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
            return // mismatched
        }
        await sendMessage({
          type: 'moveItem',
          item: dragSnap.item,
          toFolderId,
          toIndex,
        })
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
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) => {
      applyFontSize(prefs.fontSize)
    })
  }, [])

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

  // Close any open menu on outside click. The native click that *opened*
  // the menu would otherwise fire this listener too (React's synthetic
  // bubble runs first, then native bubble reaches document) and close it
  // immediately, so the listener is registered one task tick later.
  // Clicks inside the menu itself are also ignored.
  useEffect(() => {
    if (!openMenu) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest('.menu')) return
      setOpenMenu(undefined)
    }
    const t = window.setTimeout(
      () => document.addEventListener('click', onDocClick),
      0,
    )
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDocClick)
    }
  }, [openMenu])

  if (!store || windowId === undefined) {
    return <div className="loading">Loading…</div>
  }

  const handleError = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e))

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
                .catch((err) =>
                  console.error('[Spaces] post-create sync', err),
                )
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
                .catch((err) =>
                  console.error('[Spaces] post-edit sync', err),
                )
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

  // Tabs in this window that aren't claimed by any folder anywhere. Common
  // sources: tabs created while the SW was suspended, or leftovers from a
  // deleteSpace({ closeTabs: false }). Hidden tabs are also excluded so we
  // don't surface tabs that another Space's switch hid.
  const claimedTabIds = new Set<number>()
  for (const f of Object.values(store.folders)) {
    for (const it of f.items) if (it.kind === 'tab') claimedTabIds.add(it.tabId)
  }
  const orphanTabIds: number[] = []
  for (const id of Object.keys(tabs).map(Number)) {
    const t = tabs[id]
    if (!t || t.hidden) continue
    if (!claimedTabIds.has(id)) orphanTabIds.push(id)
  }

  const ctxValue: AppCtx = {
    store,
    windowId,
    tabs,
    refresh,
    onError: handleError,
    openMenu,
    setOpenMenu,
    drag,
    setDrag,
    dropPos,
    setDropPos,
    finalizeDrop,
    onCreateLive: (parentFolderId) =>
      setView({ kind: 'live-create', parentFolderId }),
    onEditLive: (folderId) => setView({ kind: 'live-edit', folderId }),
  }

  return (
    <AppCtxProvider value={ctxValue}>
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
                    await sendMessage({
                      type: 'importChromeTabGroups',
                      windowId,
                    })
                    await refresh()
                  } catch (e) {
                    handleError(e)
                  }
                }}
              >
                <Download size={14} />
                <span className="btn-icon-count">{tabGroupCount}</span>
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
              aria-label="New Space"
            >
              <Plus size={14} />
            </button>
            <button
              className="btn-icon"
              title="Settings"
              onClick={() => setView({ kind: 'settings' })}
              aria-label="Settings"
            >
              <SettingsIcon size={14} />
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

        {orphanTabIds.length > 0 && (
          <div className="orphan-banner">
            <span className="orphan-count">
              {orphanTabIds.length} tab{orphanTabIds.length === 1 ? '' : 's'} not in any Space
            </span>
            {active && (
              <button
                className="btn-link"
                title={`Add ${orphanTabIds.length} tab(s) to "${active.name}"`}
                onClick={async () => {
                  try {
                    await sendMessage({
                      type: 'addTabsToFolder',
                      folderId: active.rootFolderId,
                      tabIds: orphanTabIds,
                    })
                    await refresh()
                  } catch (e) {
                    handleError(e)
                  }
                }}
              >
                → current Space
              </button>
            )}
            <button
              className="btn-link"
              title={`Create a new Space holding these ${orphanTabIds.length} tab(s)`}
              onClick={async () => {
                try {
                  await sendMessage({
                    type: 'createSpace',
                    payload: {
                      name: `Space ${spaces.length + 1}`,
                      color: COLORS[spaces.length % COLORS.length]!,
                      windowId,
                      initialTabIds: orphanTabIds,
                    },
                  })
                  await refresh()
                } catch (e) {
                  handleError(e)
                }
              }}
            >
              → new Space
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
            const pillMenuId = `spacepill:${sp.id}`
            const isOpen = openMenu === pillMenuId
            return (
              <div
                key={sp.id}
                className={`space-tab-wrap menu-align-${isOpen ? pillMenuAlign : 'left'}`}
              >
                <SpaceTab
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
                      await sendMessage({
                        type: 'switchTo',
                        spaceId: sp.id,
                        windowId,
                      })
                      await refresh()
                    } catch (e) {
                      handleError(e)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (openMenu === pillMenuId) {
                      setOpenMenu(undefined)
                      return
                    }
                    const rect = e.currentTarget.getBoundingClientRect()
                    const panelWidth = document.documentElement.clientWidth
                    setPillMenuAlign(
                      rect.left + rect.width / 2 > panelWidth / 2 ? 'right' : 'left',
                    )
                    setOpenMenu(pillMenuId)
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
                            const before =
                              e.clientX - rect.left < rect.width / 2
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
                            !dropPos ||
                            dropPosKey(dropPos) !== dropPosKey(next)
                          ) {
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
                {openMenu === pillMenuId && (
                  <SpaceMenu
                    space={sp}
                    onClose={() => setOpenMenu(undefined)}
                    onRename={async () => {
                      const name = prompt('New Space name?', sp.name)
                      setOpenMenu(undefined)
                      if (!name?.trim() || name === sp.name) return
                      try {
                        await sendMessage({
                          type: 'renameSpace',
                          spaceId: sp.id,
                          name: name.trim(),
                        })
                        await refresh()
                      } catch (e) {
                        handleError(e)
                      }
                    }}
                    onColor={async (color) => {
                      try {
                        await sendMessage({
                          type: 'setSpaceColor',
                          spaceId: sp.id,
                          color,
                        })
                        await refresh()
                      } catch (e) {
                        handleError(e)
                      }
                    }}
                    onEmoji={async (emoji) => {
                      try {
                        await sendMessage({
                          type: 'setSpaceEmoji',
                          spaceId: sp.id,
                          emoji,
                        })
                        await refresh()
                      } catch (e) {
                        handleError(e)
                      }
                    }}
                    onDelete={async (closeTabs) => {
                      setOpenMenu(undefined)
                      try {
                        await sendMessage({
                          type: 'deleteSpace',
                          spaceId: sp.id,
                          closeTabs,
                        })
                        await refresh()
                      } catch (e) {
                        handleError(e)
                      }
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {!active ? (
          <p className="empty">No spaces yet — click + to create one.</p>
        ) : (
          <SpaceContent space={active} />
        )}
      </div>
    </AppCtxProvider>
  )
}
