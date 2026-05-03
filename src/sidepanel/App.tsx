import styled from '@emotion/styled'
import { useCallback, useEffect, useState } from 'react'
import { sendMessage } from '../shared/messaging'
import {
  type FolderId,
  type SpaceStore,
} from '../shared/types'
import { AppCtxProvider, type AppCtx } from './AppContext'
import { type DragState, type DropPos, type TabInfo } from './dnd'
import { COLORS, applyFontSize } from './theme'
import { PanelHeader } from './organisms/Header'
import { ErrorBanner } from './organisms/ErrorBanner'
import { OrphanBanner } from './organisms/OrphanBanner'
import { SpaceTabsList } from './organisms/SpaceTabsList'
import { SpaceContent } from './organisms/SpaceContent'
import {
  LiveFolderForm,
  type LiveFolderFormResult,
} from './organisms/LiveFolderForm'
import { SettingsPanel } from './organisms/SettingsPanel'
import { CommandBar } from './organisms/CommandBar'
import { GlobalStyles } from './globalStyles'

type View =
  | { kind: 'list' }
  | { kind: 'settings' }
  | { kind: 'live-create'; parentFolderId: FolderId }
  | { kind: 'live-edit'; folderId: FolderId }

const Root = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 6px;
`

const Empty = styled.p`
  color: var(--subtle);
  text-align: center;
  font-size: 12px;
  padding: 24px 0;
`

const Loading = styled.div`
  padding: 16px;
  color: var(--muted);
`

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
  const [commandBarOpen, setCommandBarOpen] = useState(false)

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
            return
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K opens the command bar; ignore when typing in inputs.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setCommandBarOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (windowId === undefined) return
    const listener = (msg: unknown): boolean => {
      const m = msg as { type?: string; windowId?: number }
      if (m?.type === 'openCommandBar' && m.windowId === windowId) {
        setCommandBarOpen(true)
      }
      return false
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [windowId])

  useEffect(() => {
    if (!openMenu) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest('[role="menu"]')) return
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
    return (
      <>
        <GlobalStyles />
        <Loading>Loading…</Loading>
      </>
    )
  }

  const handleError = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e))

  if (view.kind === 'settings') {
    return (
      <>
        <GlobalStyles />
        <Root>
          <SettingsPanel onClose={() => setView({ kind: 'list' })} />
        </Root>
      </>
    )
  }

  if (view.kind === 'live-create') {
    return (
      <>
        <GlobalStyles />
        <Root>
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
        </Root>
      </>
    )
  }

  if (view.kind === 'live-edit') {
    const folder = store.folders[view.folderId]
    if (!folder || !folder.live) {
      setView({ kind: 'list' })
      return null
    }
    return (
      <>
        <GlobalStyles />
        <Root>
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
        </Root>
      </>
    )
  }

  const spaces = Object.values(store.spaces)
    .filter((s) => s.windowId === windowId)
    .sort((a, b) => a.order - b.order)
  const activeId = store.activeSpaceByWindow[windowId]
  const active = spaces.find((s) => s.id === activeId) ?? spaces[0]

  // Tabs in this window not claimed by any folder anywhere — surface in
  // the orphan banner so the user can adopt them.
  const claimedTabIds = new Set<number>()
  for (const f of Object.values(store.folders)) {
    for (const it of f.items) if (it.kind === 'tab') claimedTabIds.add(it.tabId)
    if (f.live) {
      for (const m of f.live.managedTabs) {
        if (typeof m.tabId === 'number') claimedTabIds.add(m.tabId)
      }
    }
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
      <GlobalStyles />
      <Root>
        <PanelHeader
          tabGroupCount={tabGroupCount}
          onImportTabGroups={async () => {
            try {
              await sendMessage({ type: 'importChromeTabGroups', windowId })
              await refresh()
            } catch (e) {
              handleError(e)
            }
          }}
          onNewSpace={async () => {
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
          onOpenSettings={() => setView({ kind: 'settings' })}
        />

        {error && (
          <ErrorBanner
            message={error}
            onDismiss={() => {
              setError(undefined)
              void refresh()
            }}
          />
        )}

        <OrphanBanner
          count={orphanTabIds.length}
          spaceName={active?.name}
          onAddToCurrent={async () => {
            if (!active) return
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
          onCreateNewSpace={async () => {
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
        />

        <SpaceTabsList spaces={spaces} active={active} windowId={windowId} />

        {!active ? (
          <Empty>No spaces yet — click + to create one.</Empty>
        ) : (
          <SpaceContent space={active} />
        )}
      </Root>
      {commandBarOpen && (
        <CommandBar onClose={() => setCommandBarOpen(false)} />
      )}
    </AppCtxProvider>
  )
}
