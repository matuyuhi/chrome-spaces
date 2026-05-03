import {
  createSpace,
  listSpaces,
  resetTabToBase,
  switchTo,
  walkFolders,
} from './space-manager'
import { syncLiveFolder } from './live/sync-engine'
import { loadStore } from './storage'
import { type SpaceColor } from '../shared/types'

const SPACE_COLORS: SpaceColor[] = [
  'blue',
  'red',
  'green',
  'yellow',
  'cyan',
  'purple',
  'pink',
  'orange',
  'grey',
]

function pickNextColor(index: number): SpaceColor {
  return SPACE_COLORS[index % SPACE_COLORS.length]!
}

export async function handleCommand(command: string, windowId: number): Promise<void> {
  if (command === 'new-space') {
    const existing = await listSpaces(windowId)
    await createSpace({
      name: `Space ${existing.length + 1}`,
      color: pickNextColor(existing.length),
      windowId,
    })
    return
  }

  if (command === 'reset-current-tab') {
    const [activeTab] = await chrome.tabs.query({ windowId, active: true })
    if (typeof activeTab?.id === 'number') await resetTabToBase(activeTab.id)
    return
  }

  if (command === 'open-command-bar') {
    const sidePanelApi = chrome.sidePanel as
      | { open?: (opts: { windowId: number }) => Promise<void> }
      | undefined
    if (sidePanelApi?.open) {
      try {
        await sidePanelApi.open({ windowId })
      } catch {
        /* user gesture missing — they can open via toolbar */
      }
    }
    // Tell whichever side panel is mounted in this window to open its
    // overlay. The panel filters by windowId; messages to closed panels
    // simply have no listener and don't error.
    try {
      await chrome.runtime.sendMessage({ type: 'openCommandBar', windowId })
    } catch {
      /* no listener — panel isn't open yet, will open on next launch */
    }
    return
  }

  if (command === 'sync-current-live') {
    const [activeTab] = await chrome.tabs.query({ windowId, active: true })
    if (typeof activeTab?.id !== 'number') return
    const store = await loadStore()
    for (const sp of Object.values(store.spaces)) {
      for (const folder of walkFolders(store, sp.rootFolderId)) {
        if (folder.live?.managedTabs.some((m) => m.tabId === activeTab.id)) {
          await syncLiveFolder(folder.id)
          return
        }
      }
    }
    return
  }

  const match = command.match(/^switch-space-([1-9])$/)
  if (match) {
    const index = Number.parseInt(match[1]!, 10) - 1
    const spaces = await listSpaces(windowId)
    const target = spaces[index]
    if (target) await switchTo(target.id, windowId)
  }
}

export async function resolveWindowId(tab?: chrome.tabs.Tab): Promise<number | undefined> {
  if (typeof tab?.windowId === 'number') return tab.windowId
  try {
    const win = await chrome.windows.getCurrent()
    return typeof win.id === 'number' ? win.id : undefined
  } catch {
    return undefined
  }
}
