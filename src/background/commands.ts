import { listSpaces, switchTo, createStaticSpace, resetTabToBase } from './space-manager'
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
    await createStaticSpace({
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
  const win = await chrome.windows.getCurrent()
  return typeof win.id === 'number' ? win.id : undefined
}
