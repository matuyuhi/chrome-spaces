import { chromium, type BrowserContext, type Worker } from 'playwright'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist')

export interface ExtensionContext {
  context: BrowserContext
  extensionId: string
  userDataDir: string
  close: () => Promise<void>
}

// Launch a fresh Chromium with the unpacked extension at dist/ loaded.
//
// Notes:
//  - We use launchPersistentContext: extensions can't be loaded via
//    launch() / launchTemporaryProfile in Playwright.
//  - --headless=new is the only headless mode that supports extensions
//    (stable in Chromium 109+). The legacy --headless silently disables
//    extensions and the side panel API.
//  - The service worker registration is async; we await waitForEvent
//    or grab the existing one if it already started.
export async function launchExtension(): Promise<ExtensionContext> {
  await fs.access(path.join(EXTENSION_PATH, 'manifest.json')).catch(() => {
    throw new Error(
      `dist/manifest.json missing — run \`bun run build\` before E2E tests. Looked at: ${EXTENSION_PATH}`,
    )
  })

  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spaces-e2e-'))
  // Extensions still require headed Chromium on the bundled Playwright
  // build. CI runs under xvfb-run; locally you'll see the window pop up.
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
    timeout: 30_000,
  })

  let worker: Worker | undefined = context.serviceWorkers()[0]
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 15_000 })
  }
  const match = worker.url().match(/^chrome-extension:\/\/([a-z]{32})\//)
  if (!match) throw new Error(`Could not parse extension id from: ${worker.url()}`)
  const extensionId = match[1]!

  const close = async () => {
    await context.close()
    await fs.rm(userDataDir, { recursive: true, force: true })
  }

  return { context, extensionId, userDataDir, close }
}

export function sidePanelUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/sidepanel/index.html`
}
