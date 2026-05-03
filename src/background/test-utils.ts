import { vi } from 'vitest'

interface MockArea {
  get: (keys?: string | string[] | Record<string, unknown> | null) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
  remove: (keys: string | string[]) => Promise<void>
  clear: () => Promise<void>
}

function makeArea(backing: Record<string, unknown>): MockArea {
  return {
    get: vi.fn(async (keys) => {
      if (keys == null) return { ...backing }
      const requested =
        typeof keys === 'string'
          ? [keys]
          : Array.isArray(keys)
            ? keys
            : Object.keys(keys)
      const result: Record<string, unknown> = {}
      for (const k of requested) {
        if (k in backing) result[k] = backing[k]
      }
      return result
    }),
    set: vi.fn(async (items) => {
      Object.assign(backing, items)
    }),
    remove: vi.fn(async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys]
      for (const k of list) delete backing[k]
    }),
    clear: vi.fn(async () => {
      for (const k of Object.keys(backing)) delete backing[k]
    }),
  }
}

interface FakeTab {
  id: number
  windowId: number
  groupId: number
  active: boolean
  url?: string
}

interface FakeGroup {
  id: number
  windowId: number
  title?: string
  color?: string
  collapsed: boolean
}

export interface ChromeMock {
  sync: Record<string, unknown>
  local: Record<string, unknown>
  tabs: Map<number, FakeTab>
  groups: Map<number, FakeGroup>
  alarms: Map<string, { name: string; periodInMinutes?: number }>
  contextMenuItems: Map<string, { id: string; title: string }>
}

export function setupChromeMock(): ChromeMock {
  const sync: Record<string, unknown> = {}
  const local: Record<string, unknown> = {}
  const tabs = new Map<number, FakeTab>()
  const groups = new Map<number, FakeGroup>()
  let nextTabId = 1
  let nextGroupId = 1

  const tabsApi = {
    create: vi.fn(async (props: chrome.tabs.CreateProperties) => {
      const id = nextTabId++
      const tab: FakeTab = {
        id,
        windowId: props.windowId ?? 1,
        groupId: -1,
        active: props.active ?? false,
        url: props.url,
      }
      tabs.set(id, tab)
      return tab as unknown as chrome.tabs.Tab
    }),
    group: vi.fn(
      async (opts: {
        tabIds: number[]
        groupId?: number
        createProperties?: { windowId?: number }
      }) => {
        let gid: number
        if (typeof opts.groupId === 'number') {
          gid = opts.groupId
          if (!groups.has(gid)) throw new Error(`No group ${gid}`)
        } else {
          gid = nextGroupId++
          const wId = opts.createProperties?.windowId ?? 1
          groups.set(gid, { id: gid, windowId: wId, collapsed: false })
        }
        for (const tid of opts.tabIds) {
          const t = tabs.get(tid)
          if (t) t.groupId = gid
        }
        return gid
      },
    ),
    query: vi.fn(async (q: chrome.tabs.QueryInfo) => {
      const result: FakeTab[] = []
      for (const t of tabs.values()) {
        if (q.groupId !== undefined && t.groupId !== q.groupId) continue
        if (q.windowId !== undefined && t.windowId !== q.windowId) continue
        if (q.active !== undefined && t.active !== q.active) continue
        result.push(t)
      }
      return result as unknown as chrome.tabs.Tab[]
    }),
    update: vi.fn(async (id: number, props: chrome.tabs.UpdateProperties) => {
      const t = tabs.get(id)
      if (!t) throw new Error(`No tab ${id}`)
      if (props.active === true) {
        for (const other of tabs.values()) if (other.windowId === t.windowId) other.active = false
        t.active = true
      }
      if (typeof props.url === 'string') t.url = props.url
      return t as unknown as chrome.tabs.Tab
    }),
    get: vi.fn(async (id: number) => {
      const t = tabs.get(id)
      if (!t) throw new Error(`No tab ${id}`)
      return t as unknown as chrome.tabs.Tab
    }),
    remove: vi.fn(async (ids: number | number[]) => {
      const list = Array.isArray(ids) ? ids : [ids]
      for (const id of list) tabs.delete(id)
    }),
  }

  const tabGroupsApi = {
    TAB_GROUP_ID_NONE: -1,
    update: vi.fn(async (id: number, changes: chrome.tabGroups.UpdateProperties) => {
      const g = groups.get(id)
      if (!g) throw new Error(`No group ${id}`)
      if (changes.title !== undefined) g.title = changes.title
      if (changes.color !== undefined) g.color = changes.color
      if (changes.collapsed !== undefined) g.collapsed = changes.collapsed
      return g as unknown as chrome.tabGroups.TabGroup
    }),
    query: vi.fn(async (q: chrome.tabGroups.QueryInfo) => {
      const result: FakeGroup[] = []
      for (const g of groups.values()) {
        if (q.windowId !== undefined && g.windowId !== q.windowId) continue
        result.push(g)
      }
      return result as unknown as chrome.tabGroups.TabGroup[]
    }),
    remove: (id: number) => groups.delete(id),
  }

  const alarmsBacking = new Map<string, { name: string; periodInMinutes?: number }>()
  const alarmsApi = {
    create: vi.fn(async (name: string, info: { periodInMinutes?: number }) => {
      alarmsBacking.set(name, { name, periodInMinutes: info.periodInMinutes })
    }),
    clear: vi.fn(async (name: string) => alarmsBacking.delete(name)),
    clearAll: vi.fn(async () => {
      const had = alarmsBacking.size > 0
      alarmsBacking.clear()
      return had
    }),
    getAll: vi.fn(async () => [...alarmsBacking.values()]),
  }

  const contextMenuItems = new Map<string, { id: string; title: string }>()
  const contextMenusApi = {
    create: vi.fn((opts: { id?: string; title?: string }) => {
      const id = opts.id ?? `auto-${contextMenuItems.size}`
      contextMenuItems.set(id, { id, title: opts.title ?? '' })
      return id
    }),
    removeAll: vi.fn(async () => {
      contextMenuItems.clear()
    }),
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      sync: makeArea(sync),
      local: makeArea(local),
    },
    tabs: tabsApi,
    tabGroups: tabGroupsApi,
    alarms: alarmsApi,
    contextMenus: contextMenusApi,
  }

  return { sync, local, tabs, groups, alarms: alarmsBacking, contextMenuItems }
}
