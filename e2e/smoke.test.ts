import { afterEach, beforeEach, describe, test } from 'vitest'
import { launchExtension, sidePanelUrl, type ExtensionContext } from './helpers'

// Playwright's chromium API ships its own waiters; we rely on those rather
// than vitest's expect (which doesn't carry the playwright matchers).

describe('side panel — smoke', () => {
  let ext: ExtensionContext

  beforeEach(async () => {
    ext = await launchExtension()
  })

  afterEach(async () => {
    if (ext) {
      await ext.close()
    }
  })

  test('renders the empty state when no Spaces have been created', async () => {
    const page = await ext.context.newPage()
    await page.goto(sidePanelUrl(ext.extensionId))
    // The side panel starts loading the store via `chrome.runtime.sendMessage`,
    // which needs the SW awake. Allow up to 10s for that handshake.
    await page
      .getByText(/no spaces yet/i)
      .waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('creates a Space when the + action is clicked', async () => {
    // Need a real tab in the window so the new Space has a windowId to
    // attach to (the side panel reads chrome.windows.getCurrent).
    await ext.context.newPage()
    const panel = await ext.context.newPage()
    await panel.goto(sidePanelUrl(ext.extensionId))
    await panel
      .getByText(/no spaces yet/i)
      .waitFor({ state: 'visible', timeout: 10_000 })
    // The "new Space" affordance lives in PanelHeader as the only button
    // with a + glyph. Click it via title attribute (more stable than text).
    await panel.locator('[title*="New Space" i]').first().click()
    await panel
      .getByText(/no spaces yet/i)
      .waitFor({ state: 'hidden', timeout: 5_000 })
  })
})
