import { describe, it, expect, beforeEach } from 'vitest'
import { _ITEM_IDS, handleContextMenuClick, installContextMenus } from './context-menus'
import { createStaticSpace } from './space-manager'
import { loadStore } from './storage'
import { setupChromeMock, type ChromeMock } from './test-utils'

describe('context-menus', () => {
  let mock: ChromeMock

  beforeEach(() => {
    mock = setupChromeMock()
  })

  it('installContextMenus registers all three items idempotently', async () => {
    await installContextMenus()
    await installContextMenus()
    expect(mock.contextMenuItems.size).toBe(3)
  })

  it('Pin click writes the tab URL into the Space record', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({
      windowId: 1,
      url: 'https://example.com/home',
    })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })

    await handleContextMenuClick(
      { menuItemId: _ITEM_IDS.ITEM_PIN } as chrome.contextMenus.OnClickData,
      tab,
    )

    const stored = (await loadStore()).spaces[space.id]
    expect(stored?.pinnedTabs?.[tab.id!]).toBe('https://example.com/home')
  })

  it('Reset click navigates the tab back to its base URL', async () => {
    const space = await createStaticSpace({ name: 'A', color: 'red', windowId: 1 })
    const tab = await chrome.tabs.create({
      windowId: 1,
      url: 'https://example.com/home',
    })
    await chrome.tabs.group({ tabIds: [tab.id!], groupId: space.groupId })

    await handleContextMenuClick(
      { menuItemId: _ITEM_IDS.ITEM_PIN } as chrome.contextMenus.OnClickData,
      tab,
    )
    await chrome.tabs.update(tab.id!, { url: 'https://example.com/page/x' })

    await handleContextMenuClick(
      { menuItemId: _ITEM_IDS.ITEM_RESET } as chrome.contextMenus.OnClickData,
      { ...tab, url: 'https://example.com/page/x' },
    )

    expect(mock.tabs.get(tab.id!)?.url).toBe('https://example.com/home')
  })
})
