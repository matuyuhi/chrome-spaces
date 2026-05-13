import styled from '@emotion/styled'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { sendMessage } from '../shared/messaging'
import { type FolderId } from '../shared/types'
import { AppCtxProvider, type AppCtx } from './AppContext'
import { COLORS, COLOR_GRADIENT } from './theme'
import { useBackgroundMessages } from './hooks/useBackgroundMessages'
import { useDragDropController } from './hooks/useDragDropController'
import { useHorizontalSwipeSwitcher } from './hooks/useHorizontalSwipeSwitcher'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useMenuController } from './hooks/useMenuController'
import { useReconcileSweep } from './hooks/useReconcileSweep'
import { useStoreChangeListener } from './hooks/useStoreChangeListener'
import { useStoreData } from './hooks/useStoreData'
import { useTabEventListeners } from './hooks/useTabEventListeners'
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
  const openCommandBar = useCallback(() => setCommandBarOpen(true), [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useReconcileSweep(refresh, refreshPrefs)
  useTabEventListeners(refresh)
  useStoreChangeListener(refresh)
  useKeyboardShortcuts({ windowId, refresh, onOpenCommandBar: openCommandBar })
  useHorizontalSwipeSwitcher({
    enabled: view.kind === 'list',
    store,
    windowId,
    refresh,
  })
  useBackgroundMessages({ windowId, onOpenCommandBar: openCommandBar })

  // Active Space ambient tint — applied to <body> via the --space-tint
  // CSS variable so the gradient persists across live-create/edit
  // sub-views and outlives the side-panel React tree.
  //
  // We mirror the same activeId-or-spaces[0] fallback the render uses
  // (see `active` below). Otherwise a freshly created Space — which
  // doesn't call switchTo and so leaves activeSpaceByWindow untouched
  // — would render its content but skip the tint until the user
  // clicks its pill.
  const activeColor = (() => {
    if (!store || windowId === undefined) return undefined
    const windowSpaces = Object.values(store.spaces)
      .filter((s) => s.windowId === windowId)
      .sort((a, b) => a.order - b.order)
    const activeId = store.activeSpaceByWindow[windowId]
    const active = windowSpaces.find((s) => s.id === activeId) ?? windowSpaces[0]
    return active?.color
  })()
  useEffect(() => {
    const tint = activeColor ? COLOR_GRADIENT[activeColor] : ''
    if (tint) document.body.style.setProperty('--space-tint', tint)
    else document.body.style.removeProperty('--space-tint')

    // The CSS rule in globalStyles keyed off html[data-space-tint] flips
    // the palette to light-mode values when a colored tint is active, so
    // dark text reads against the bright pastel body. grey is excluded
    // by the selector; the no-tint state removes the attribute entirely.
    const root = document.documentElement
    if (activeColor) root.setAttribute('data-space-tint', activeColor)
    else root.removeAttribute('data-space-tint')
  }, [activeColor])

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
