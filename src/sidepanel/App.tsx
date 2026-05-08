import styled from '@emotion/styled'
import { useEffect, useMemo, useState } from 'react'
import { sendMessage } from '../shared/messaging'
import { type FolderId } from '../shared/types'
import { AppCtxProvider, type AppCtx } from './AppContext'
import { COLORS, applyFontSize } from './theme'
import { useDragDropController } from './hooks/useDragDropController'
import { useMenuController } from './hooks/useMenuController'
import { useStoreData } from './hooks/useStoreData'
import { PanelHeader } from './organisms/Header'
import { ErrorBanner } from './organisms/ErrorBanner'
import { OrphanBanner } from './organisms/OrphanBanner'
import { SpaceTabsList } from './organisms/SpaceTabsList'
import { SpaceContent } from './organisms/SpaceContent'
import {
  LiveFolderForm,
  type LiveFolderFormResult,
} from './organisms/LiveFolderForm'
import { CommandBar } from './organisms/CommandBar'
import { GlobalStyles } from './globalStyles'

type View =
  | { kind: 'list' }
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
  const data = useStoreData()
  const {
    windowId,
    store,
    tabs,
    prefs,
    tabGroupCount,
    error,
    refresh,
    refreshPrefs,
    onError,
    clearError,
  } = data

  const menu = useMenuController()
  const dnd = useDragDropController({ windowId, refresh, onError })

  const [view, setView] = useState<View>({ kind: 'list' })
  const [commandBarOpen, setCommandBarOpen] = useState(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Throttled reconcile in the SW (30s). Triggered on mount and whenever
  // the panel regains visibility, since MV3 SWs can miss tab-close events
  // while suspended and leave zombie tab refs in the store. Also refresh
  // UI prefs on visibility — the options tab is a separate document and
  // any change there only reaches us once the user returns.
  useEffect(() => {
    const sweep = () => {
      void sendMessage({ type: 'reconcile' }).then((res) => {
        if (res.dropped > 0) void refresh()
      })
      void refreshPrefs()
    }
    sweep()
    const onVisible = () => {
      if (document.visibilityState === 'visible') sweep()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh, refreshPrefs])

  useEffect(() => {
    void sendMessage({ type: 'getUIPrefs' }).then((next) => {
      applyFontSize(next.fontSize)
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
      const tag = (e.target as HTMLElement | null)?.tagName
      const inEditor = tag === 'INPUT' || tag === 'TEXTAREA'
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        if (inEditor) return
        e.preventDefault()
        setCommandBarOpen(true)
        return
      }
      // ⌘Z / Ctrl+Z undoes the last destructive op (close-tab,
      // delete-folder, delete-space, move-item) for this window.
      // Skip when typing — native input undo wins there.
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (inEditor) return
        if (windowId === undefined) return
        e.preventDefault()
        void sendMessage({ type: 'undo', windowId }).then((res) => {
          if (res.ok) void refresh()
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [windowId, refresh])

  // Horizontal swipe (2-finger trackpad or horizontal wheel) to switch spaces.
  // Only active when the main list view is visible.
  useEffect(() => {
    if (view.kind !== 'list') return
    if (!store || windowId === undefined) return

    let lastFiredAt = 0

    const onWheel = (e: WheelEvent) => {
      // Ignore vertical scrolls — only act when horizontal movement dominates.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      // Minimum threshold to avoid tiny accidental drifts.
      if (Math.abs(e.deltaX) <= 40) return
      // Ignore when the user is typing in an input.
      if ((e.target as Element | null)?.closest('input, textarea')) return
      // Throttle: one switch per 400 ms (absorbs trackpad inertia).
      const now = Date.now()
      if (now - lastFiredAt < 400) return
      lastFiredAt = now

      const orderedSpaces = Object.values(store.spaces)
        .filter((s) => s.windowId === windowId)
        .sort((a, b) => a.order - b.order)
      if (orderedSpaces.length <= 1) return

      const activeSpaceId = store.activeSpaceByWindow[windowId]
      const currentIdx = orderedSpaces.findIndex((s) => s.id === activeSpaceId)
      if (currentIdx === -1) return

      // deltaX > 0 → swipe left → next space; deltaX < 0 → swipe right → prev space.
      const nextIdx = e.deltaX > 0 ? currentIdx + 1 : currentIdx - 1
      // Clamp: no wrap-around at edges.
      if (nextIdx < 0 || nextIdx >= orderedSpaces.length) return

      const targetSpace = orderedSpaces[nextIdx]
      if (!targetSpace) return

      void sendMessage({ type: 'switchTo', spaceId: targetSpace.id, windowId }).then(
        () => refresh(),
      )
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [view.kind, store, windowId, refresh])

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

  const { openMenu, setOpenMenu } = menu
  const { drag, setDrag, dropPos, setDropPos, finalizeDrop } = dnd

  const ctxValue = useMemo<AppCtx | undefined>(() => {
    if (!store || windowId === undefined) return undefined
    return {
      store,
      windowId,
      tabs,
      prefs,
      refresh,
      onError,
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
  }, [
    store,
    windowId,
    tabs,
    prefs,
    refresh,
    onError,
    openMenu,
    setOpenMenu,
    drag,
    setDrag,
    dropPos,
    setDropPos,
    finalizeDrop,
  ])

  if (!store || windowId === undefined || !ctxValue) {
    return (
      <>
        <GlobalStyles />
        <Loading>Loading…</Loading>
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
                onError(e)
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
                onError(e)
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
              onError(e)
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
              onError(e)
            }
          }}
          onOpenSettings={() => chrome.runtime.openOptionsPage()}
        />

        {error && (
          <ErrorBanner
            message={error}
            onDismiss={() => {
              clearError()
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
              onError(e)
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
              onError(e)
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
