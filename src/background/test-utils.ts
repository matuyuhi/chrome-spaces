import { vi } from 'vitest'
import enMessages from '../../public/_locales/en/messages.json'
import { applyI18nSubs } from '../shared/i18n'

interface MockArea {
  get: (
    keys?: string | string[] | Record<string, unknown> | null,
  ) => Promise<Record<string, unknown>>
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
  hidden: boolean
  url?: string
}

export interface ChromeMock {
  sync: Record<string, unknown>
  local: Record<string, unknown>
  tabs: Map<number, FakeTab>
  alarms: Map<string, { name: string; periodInMinutes?: number }>
  contextMenuItems: Map<string, { id: string; title: string }>
}

export function setupChromeMock(): ChromeMock {
  const sync: Record<string, unknown> = {}
  const local: Record<string, unknown> = {}
  const tabs = new Map<number, FakeTab>()
  let nextTabId = 1

  const tabsApi = {
    create: vi.fn(async (props: chrome.tabs.CreateProperties) => {
      const id = nextTabId++
      const windowId = props.windowId ?? 1
      const active = props.active ?? false
      // Mirror Chrome: a new active tab deactivates the previously
      // active tab in the same window.
      if (active) {
        for (const other of tabs.values()) {
          if (other.windowId === windowId) other.active = false
        }
      }
      const tab: FakeTab = {
        id,
        windowId,
        groupId: -1,
        active,
        hidden: false,
        url: props.url,
      }
      tabs.set(id, tab)
      return tab as unknown as chrome.tabs.Tab
    }),
    query: vi.fn(async (q: chrome.tabs.QueryInfo) => {
      const result: FakeTab[] = []
      for (const t of tabs.values()) {
        if (q.windowId !== undefined && t.windowId !== q.windowId) continue
        if (q.active !== undefined && t.active !== q.active) continue
        if (q.groupId !== undefined && t.groupId !== q.groupId) continue
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
        t.hidden = false
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
    hide: vi.fn(async (ids: number | number[]) => {
      const list = Array.isArray(ids) ? ids : [ids]
      for (const id of list) {
        const t = tabs.get(id)
        if (t && !t.active) t.hidden = true
      }
    }),
    show: vi.fn(async (ids: number | number[]) => {
      const list = Array.isArray(ids) ? ids : [ids]
      for (const id of list) {
        const t = tabs.get(id)
        if (t) t.hidden = false
      }
    }),
    ungroup: vi.fn(async (ids: number | number[]) => {
      const list = Array.isArray(ids) ? ids : [ids]
      for (const id of list) {
        const t = tabs.get(id)
        if (t) t.groupId = -1
      }
    }),
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
  }

  const alarmsBacking = new Map<string, { name: string; periodInMinutes?: number }>()
  const alarmsApi = {
    create: vi.fn(async (name: string, info: { periodInMinutes?: number }) => {
      alarmsBacking.set(name, { name, periodInMinutes: info.periodInMinutes })
    }),
    get: vi.fn(async (name: string) => alarmsBacking.get(name)),
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

  const windowsApi = {
    // Sync engine validates the windowId before creating tabs; resolve
    // for any positive id so existing tests need no change.
    get: vi.fn(async (id: number) => ({ id }) as chrome.windows.Window),
    getCurrent: vi.fn(async () => ({ id: 1 }) as chrome.windows.Window),
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  }

  const i18nMessages = enMessages as Record<string, { message: string }>
  const i18nApi = {
    getMessage: vi.fn((key: string, subs?: string | string[]) => {
      const entry = i18nMessages[key]
      if (!entry) return ''
      return applyI18nSubs(entry.message, subs)
    }),
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      sync: makeArea(sync),
      local: makeArea(local),
    },
    tabs: tabsApi,
    alarms: alarmsApi,
    contextMenus: contextMenusApi,
    windows: windowsApi,
    i18n: i18nApi,
  }

  return { sync, local, tabs, alarms: alarmsBacking, contextMenuItems }
}
