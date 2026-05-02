# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR (popup auto-reloads; service worker reloads via `@crxjs/vite-plugin`).
- `npm run build` — `tsc --noEmit` then `vite build` → `dist/`. Load `dist/` as an unpacked extension at `chrome://extensions/`.
- `npm test` — `vitest run` (single run).
- `npm run test:watch` — vitest in watch mode.
- Run a single test file: `npx vitest run src/background/live/diff.test.ts`.
- Filter by name: `npx vitest run -t 'pattern'`.

Vitest runs in the `node` environment with Chrome APIs mocked. `src/background/test-utils.ts` exposes `setupChromeMock()` which installs a fake `globalThis.chrome` (`storage.local`/`sync`, `tabs`, `tabGroups`, `alarms`) — use it in any test that touches the background module.

## Architecture

This is a Manifest V3 Chrome extension built with Vite + crxjs. There is no Web Store release; only unpacked install. Two runtime contexts:

1. **Background service worker** (`src/background/index.ts`) — owns all state. Listens to `chrome.tabs`, `chrome.tabGroups`, `chrome.alarms`, `chrome.commands`, and `chrome.runtime.onMessage`. Responds to popup messages defined in `src/shared/messaging.ts`.
2. **Popup** (`src/popup/`) — React 18 UI. Talks to the service worker only via `sendMessage` from `src/shared/messaging.ts`; never reads/writes `chrome.storage` directly.

### Core domain model (`src/shared/types.ts`)

A **Space** is a 1:1 wrapper around a Chrome Tab Group, scoped to one `windowId`. Two kinds:

- **StaticSpace** — user-managed tabs. New tabs opened in the active window get auto-grouped into the active static space (see `handlers.ts:onTabCreated`).
- **LiveSpace** — tabs auto-populated from a `LiveSource` (currently only `github-prs`). Has a `managedTabs: ManagedTab[]` list and a periodic `chrome.alarms` schedule (`refreshIntervalMin`). New tabs are NOT auto-grouped into live spaces.

`SpaceStore` (persisted at `chrome.storage.local['spaceStore']`) holds `spaces` (by id) and `activeSpaceByWindow` (per-window active space). `SecretStore` (`chrome.storage.local`, separate key) holds the GitHub PAT — kept out of `chrome.storage.sync` deliberately so it is never device-synced.

When a Tab Group is removed in the UI but the Space record remains, `groupId` is set to `TAB_GROUP_ID_NONE` (`-1`); reconciliation rather than deletion is the convention. All code that writes to `chrome.tabGroups` must check for `TAB_GROUP_ID_NONE` and skip.

### Switching spaces (`space-manager.ts:switchTo`)

The active space is persisted **before** any `chrome.tabGroups.update` calls. This ordering is critical: when we collapse other groups, `chrome.tabGroups.onUpdated` fires and `handlers.ts:onTabGroupUpdated` would otherwise see a stale `activeSpaceByWindow` and recursively call `switchTo`, burning through `chrome.storage` write quota. Don't reorder these writes.

### In-flight tab creation (`inflight.ts`)

When the extension itself creates a "starter" tab (in `createStaticSpace` / `createLiveSpace`), there is a race window between `chrome.tabs.create` and `chrome.tabs.group` where `onTabCreated` would auto-group the tab into the previously-active space. Two guards:

- `pauseAutoGrouping()` / `resumeAutoGrouping()` — counter wrapping the create+group sequence.
- `markStarterTab(tabId)` / `unmarkStarterTab(tabId)` — backup `Set` for racy events that don't observe the counter.

`onTabCreated` consults both before auto-grouping. Always use this pattern when creating tabs from the extension itself.

### Live folders (`background/live/`)

Pipeline: `alarm fires → handleAlarm → syncLiveSpace → fetchItems (GitHub) → diff(managedTabs, items) → applyDiff (create/remove tabs, persist managedTabs)`.

- `diff.ts` is pure list-diff (`toAdd` / `toRemove` / `toKeep` keyed by `externalId`). Keep it free of Chrome API dependencies; tested in isolation.
- `sync-engine.ts` writes `lastSyncAt` and `lastSyncError` on every run (success or failure). Errors don't throw out of `syncLiveSpace`.
- `alarms.ts` keeps `chrome.alarms` in sync with the set of LiveSpaces; `reconcileAlarms()` runs on `onInstalled` / `onStartup`. Alarm names are namespaced as `live-space:<spaceId>`.
- `sources/github.ts` — GitHub Search API client. Throws `GitHubError(status, message)` for non-2xx; `sync-engine` formats this for the popup row's error badge.
- A LiveSpace is created with a "seed" `starterTabId` to anchor the empty Tab Group; it is closed by `applyDiff` once `managedTabs.length > 0`.

### Reconciliation (`reconcile.ts`)

Runs on `onInstalled` (with `adoptExistingGroups: true`) and `onStartup` (without). For each persisted Space whose `groupId` no longer exists, sets `groupId = TAB_GROUP_ID_NONE`. On install only, also adopts any unclaimed Tab Groups as new StaticSpaces — this is what makes "install on a browser that already has Tab Groups" Just Work.

### Keyboard commands

Declared in `manifest.config.ts` (`switch-space-1`..`9`, `new-space`); dispatched in `commands.ts:handleCommand`. Indexes are 1-based and resolve against `listSpaces(windowId)` ordered by `order`. Chrome only auto-binds the first 4 commands at install time, and the manifest intentionally ships **no `suggested_key`** because ⌘1–9 collides with Chrome's tab navigation — users bind their own at `chrome://extensions/shortcuts`.

## Conventions

- All persistence goes through `loadStore` / `updateStore` in `storage.ts` (background) or `secret-storage.ts` (token only). Don't call `chrome.storage` directly elsewhere.
- All chrome.* event handlers in `index.ts` wrap async work in `void (async () => { ... })()` — the `chrome.runtime.onMessage` listener returns `true` to keep the response channel open for async `sendResponse`.
- Wrap `chrome.tabGroups.update` in try/catch (or use `safeTabGroupUpdate`) — groups can be removed by the user mid-update; reconcile cleans up later.
- `chrome.storage.local` (not `.sync`) is used everywhere because Tab Groups themselves are not device-synced and `.sync`'s per-minute write quota is easy to hit during rapid space switching.
