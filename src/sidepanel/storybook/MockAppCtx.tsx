import { useState } from 'react'
import { type SpaceStore } from '../../shared/types'
import { AppCtxProvider, type AppCtx } from '../AppContext'
import { type DragState, type DropPos, type TabInfo } from '../dnd'

const EMPTY: SpaceStore = {
  spaces: {},
  folders: {},
  tabs: {},
  activeSpaceByWindow: {},
  schemaVersion: 3,
}

interface Overrides {
  store?: SpaceStore
  tabs?: Record<number, TabInfo>
  windowId?: number
}

export function MockProvider({
  children,
  overrides = {},
}: {
  children: React.ReactNode
  overrides?: Overrides
}) {
  const [openMenu, setOpenMenu] = useState<string | undefined>()
  const [drag, setDrag] = useState<DragState | undefined>()
  const [dropPos, setDropPos] = useState<DropPos | undefined>()

  const ctx: AppCtx = {
    store: overrides.store ?? EMPTY,
    windowId: overrides.windowId ?? 1,
    tabs: overrides.tabs ?? {},
    refresh: async () => {
      /* no-op in stories */
    },
    onError: (e) => console.error('[story]', e),
    openMenu,
    setOpenMenu,
    drag,
    setDrag,
    dropPos,
    setDropPos,
    finalizeDrop: async () => {
      setDrag(undefined)
      setDropPos(undefined)
    },
    onCreateLive: (parentFolderId) =>
      console.log('[story] create live in', parentFolderId),
    onEditLive: (folderId) => console.log('[story] edit live', folderId),
  }

  return <AppCtxProvider value={ctx}>{children}</AppCtxProvider>
}

// Convenience: build a SpaceStore + tabs map with a sensible shape.
export function makeFixture(): { store: SpaceStore; tabs: Record<number, TabInfo> } {
  const store: SpaceStore = {
    schemaVersion: 3,
    spaces: {
      sp1: {
        id: 'sp1',
        name: 'Reviews',
        color: 'blue',
        windowId: 1,
        order: 0,
        rootFolderId: 'r1',
        createdAt: 0,
        lastAccessedAt: 0,
      },
      sp2: {
        id: 'sp2',
        name: 'Personal',
        color: 'green',
        emoji: '🌱',
        windowId: 1,
        order: 1,
        rootFolderId: 'r2',
        createdAt: 0,
        lastAccessedAt: 0,
      },
    },
    folders: {
      r1: {
        id: 'r1',
        name: 'Reviews root',
        collapsed: false,
        items: [
          { kind: 'tab', tabId: 100 },
          { kind: 'folder', folderId: 'live1' },
          { kind: 'folder', folderId: 'sub1' },
        ],
      },
      live1: {
        id: 'live1',
        name: 'PRs assigned',
        collapsed: false,
        items: [
          { kind: 'live', externalId: 'a/b#1' },
          { kind: 'live', externalId: 'a/b#2' },
          { kind: 'live', externalId: 'a/c#9' },
        ],
        live: {
          source: { type: 'github-prs', preset: 'assigned' },
          refreshIntervalMin: 0,
          managedTabs: [
            {
              externalId: 'a/b#1',
              url: 'https://github.com/a/b/pull/1',
              title: 'Bump axios from 1.13.6 to 1.16.0 by dependabot',
              tabId: 200,
              addedAt: 0,
            },
            {
              externalId: 'a/b#2',
              url: 'https://github.com/a/b/pull/2',
              title: 'Add Sentry SDK',
              addedAt: 0,
            },
            {
              externalId: 'a/c#9',
              url: 'https://github.com/a/c/pull/9',
              title: 'Refactor live engine to use folder ids',
              addedAt: 0,
            },
          ],
        },
      },
      sub1: {
        id: 'sub1',
        name: 'Notes',
        emoji: '📝',
        collapsed: false,
        items: [{ kind: 'tab', tabId: 101 }],
      },
      r2: {
        id: 'r2',
        name: 'Personal root',
        collapsed: false,
        items: [{ kind: 'tab', tabId: 300 }],
      },
    },
    tabs: {
      100: { tabId: 100, windowId: 1, baseUrl: 'https://example.com/home' },
      101: { tabId: 101, windowId: 1 },
      200: { tabId: 200, windowId: 1 },
      201: { tabId: 201, windowId: 1 },
      202: { tabId: 202, windowId: 1 },
      300: { tabId: 300, windowId: 1 },
    },
    activeSpaceByWindow: { 1: 'sp1' },
  }

  const tabs: Record<number, TabInfo> = {
    100: {
      id: 100,
      title: 'Hacker News',
      url: 'https://news.ycombinator.com/',
      hidden: false,
      active: true,
    },
    101: {
      id: 101,
      title: 'Daily standup notes',
      url: 'https://notion.so/...',
      hidden: false,
      active: false,
    },
    200: {
      id: 200,
      title: 'Bump axios from 1.13.6 to 1.16.0 by dependabot · a/b#1',
      url: 'https://github.com/a/b/pull/1',
      favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
      hidden: false,
      active: false,
    },
    201: {
      id: 201,
      title: 'Add Sentry SDK · a/b#2',
      url: 'https://github.com/a/b/pull/2',
      favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
      hidden: false,
      active: false,
    },
    202: {
      id: 202,
      title: 'Refactor live engine to use folder ids · a/c#9',
      url: 'https://github.com/a/c/pull/9',
      favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
      hidden: false,
      active: false,
    },
    300: {
      id: 300,
      title: 'Inbox',
      url: 'https://mail.google.com/',
      hidden: false,
      active: false,
    },
  }

  return { store, tabs }
}
