# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Commands

- `npm run dev` — Vite dev server with HMR (side panel auto-reloads; SW reloads via `@crxjs/vite-plugin`).
- `npm run build` — `tsc --noEmit` + `vite build` → `dist/`. Load `dist/` as an unpacked extension at `chrome://extensions/`.
- `npm test` — `vitest run` (single run). Includes Storybook stories rendered as tests via `@storybook/addon-vitest`.
- `npm run test:watch` — vitest watch.
- `npm run storybook` — Storybook 10 dev server on :6006.
- `npm run build-storybook` — currently fails on Vite 8 + rolldown beta; rely on `dev` for the time being.
- Single test file: `npx vitest run src/background/live/diff.test.ts`. Filter by name: `npx vitest run -t 'pattern'`.

Vitest runs in the `node` environment with Chrome APIs mocked. `src/background/test-utils.ts` exposes `setupChromeMock()` which installs a fake `globalThis.chrome` (`storage.local`/`sync`, `tabs`, `alarms`, `contextMenus`, `windows`) — use it in any test that touches the background module.

Pinned Node: see `.node-version`. fnm picks it up on `cd`. Vite 8 + rolldown require Node ≥ 20.19 / 22.12.

## Architecture

Manifest V3 Chrome extension built with Vite + crxjs. No Web Store release; only unpacked install. Two runtime contexts:

1. **Background service worker** (`src/background/index.ts`) — owns all state. Listens to `chrome.tabs`, `chrome.alarms`, `chrome.commands`, `chrome.contextMenus`, `chrome.windows`, and `chrome.runtime.onMessage`. Routes messages defined in `src/shared/messaging.ts`.
2. **Side Panel** (`src/sidepanel/`) — React 19 UI in the Chrome Side Panel. Talks to the SW only via `sendMessage` from `src/shared/messaging.ts`; never reads or writes `chrome.storage` directly. The popup that used to exist was deleted.

The toolbar action opens the Side Panel via `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.

### Domain model — schema v2 (`src/shared/types.ts`)

A **Space** is a named container scoped to one `windowId`. It owns a tree of folders rooted at `rootFolderId`. **Chrome Tab Groups are not used** — `chrome.tabGroups` only appears in the v1→v2 migration to ungroup legacy data.

```
Space      → id, name, color, emoji?, windowId, order, rootFolderId, lastActiveTabId?
Folder     → id, name, emoji?, color?, collapsed, items[], live?
ItemRef    → { kind: 'tab'; tabId } | { kind: 'folder'; folderId }
TabRecord  → { tabId, windowId, baseUrl? }   // baseUrl = Arc-style snap-back
LiveConfig → source, refreshIntervalMin (0 = manual), managedTabs[], starterTabId?, lastSyncAt?, lastSyncError?
```

`SpaceStore` (persisted at `chrome.storage.local['spaceStore']`):
- `spaces: Record<SpaceId, Space>`
- `folders: Record<FolderId, Folder>`
- `tabs: Record<number, TabRecord>`
- `activeSpaceByWindow: Record<number, SpaceId>`
- `schemaVersion`

`SecretStore` (separate key) holds the GitHub PAT — kept out of `chrome.storage.sync` so it is never device-synced.

### v1 → v2 migration (`storage.ts:migrateIfNeeded`)

Runs once at SW bootstrap. Each old StaticSpace becomes a v2 Space with the group's tabs in its root folder. Each old LiveSpace becomes a Space with one Live folder under its root, carrying source/managedTabs/sync history. Underlying Chrome Tab Groups are ungrouped. Idempotent via `schemaVersion` check.

### Switching a Space (`space-manager.ts:switchTo`)

1. **Persist `activeSpaceByWindow[windowId] = spaceId` first.** Any tab event firing during the switch must see the new state, not the old one.
2. Activate one of the target Space's tabs (lastActiveTabId, then first known tab, then a freshly-created starter tab if the Space is empty). Chrome refuses to hide the active tab — this step has to come before hiding others.
3. `chrome.tabs.show(targetTabIds)` — idempotent for already-visible tabs.
4. `chrome.tabs.hide(everyOtherTabInWindow)`.

`chrome.tabs.show / hide` aren't in current `@types/chrome`; cast to `(api as { show; hide })` at call sites.

### Live folders (`background/live/`)

Pipeline: `alarm fires → handleAlarm → syncLiveFolder(folderId) → fetchSearchResults (GitHub) → diff(managedTabs, items) → applyDiff (create/remove tabs, persist managedTabs)`.

- `diff.ts` — pure list-diff (`toAdd` / `toRemove` / `toKeep` keyed by `externalId`). No Chrome API. Tested in isolation.
- `sync-engine.ts:syncLiveFolder` — writes `lastSyncAt` and `lastSyncError` on every run. Errors don't throw out of the function. **Validates `chrome.windows.get(windowId)` before fetching** so a closed window's alarm doesn't spam the console.
- `alarms.ts` — `chrome.alarms` keyed by FolderId (`live-folder:<folderId>`). `refreshIntervalMin = 0` means manual-only — `scheduleSync` then *clears* the alarm. `reconcileAlarms()` runs at bootstrap and skips folders with `< 1` interval.
- `sources/github.ts` — Search API client. Throws `GitHubError(status, message)`. `repoFilter` accepts a bare org name (`acme` → `org:acme`), an explicit qualifier (`org:foo` / `user:bar` / `repo:a/b`), or a `!`-prefixed exclusion (`!sb` → `-org:sb`).

**Newcomer trap:** `applyDiff` ends by stripping the live folder's tabIds from every *other* folder's items list. Chrome's `onCreated → handlers.registerTab` runs concurrently with the sync's create + write, and can append the new tab to whatever Space is currently active before our store write lands. The strip enforces "Live folder owns these tabIds, exclusively."

(The v1 codebase had a separate `inflight.ts` with `pauseAutoGrouping` / `markStarterTab` to avoid the previous Tab-Group-based auto-router. Both are gone in v2 — there is no per-tab auto-grouping to fight, only the `registerTab` race above.)

### Window lifecycle

- `chrome.windows.onRemoved` clears `activeSpaceByWindow[windowId]` only. **Do not delete Spaces** — every window fires `onRemoved` during Chrome shutdown, so deleting would wipe the user's whole setup on every restart.
- Bootstrap calls `reattachOrphanSpaces()` to rehome any Space whose stored `windowId` no longer matches a live window (Chrome assigns fresh windowIds even with session restore). TabRecords get the same treatment.

### Tab record bookkeeping (`handlers.ts`)

- `onTabCreated → registerTab` — creates a TabRecord and appends to the active Space's root folder if the tabId isn't already in any folder.
- `onTabRemoved → dropTab` — removes from `tabs`, every folder's items, and any folder.live.managedTabs.
- `onTabActivated → setLastActiveTab` — only writes when value changes (rapid tab switching otherwise burns the storage write quota).
- `onTabAttached` — re-register so the tab's `windowId` reflects the move.

### Reconciliation (`reconcile.ts`)

`reconcile()` at bootstrap drops tab refs / TabRecord entries for tabs that no longer exist (the SW can be suspended while tabs are closed).

### Keyboard commands

Declared in `manifest.config.ts`:
- `switch-space-1..9`
- `new-space`
- `reset-current-tab` — calls `resetTabToBase` for the active tab
- `sync-current-live` — finds the Live folder containing the active tab and triggers `syncLiveFolder`

Dispatched in `commands.ts:handleCommand`. No `suggested_key` ships — ⌘1-9 collides with Chrome's built-in tab nav. Users bind at `chrome://extensions/shortcuts`.

### Context menus (`context-menus.ts`)

- `Sync this Live folder` — page/frame and action contexts. Looks up which Live folder owns the right-clicked tab.
- `Pin tab to current URL` / `Unpin tab` / `Reset tab to base URL` — page/frame.

`'tab'` context (right-click on a tab in the strip) is **not** accepted by `chrome.contextMenus` at runtime, despite older docs suggesting it. Don't try.

`documentUrlPatterns: ['http://*/*', 'https://*/*']` keeps these out of the side panel's own right-click menu (chrome-extension://).

## Side panel UI — atomic design

```
src/sidepanel/
├── App.tsx                    # Page (top-level orchestrator)
├── main.tsx, index.html       # Entry
├── globalStyles.tsx           # CSS reset + :root custom properties
├── theme.ts                   # tokens, COLORS, FONT_SCALE, applyFontSize()
├── AppContext.ts              # Single Context for cross-tree state
│                              #   (refresh, openMenu, drag/drop, onCreate/EditLive)
├── dnd.ts                     # DragState / DropPos / TabInfo / dropPosKey / itemKey
├── storybook/MockAppCtx.tsx   # Story-only AppCtx provider + makeFixture()
├── atoms/                     # Standalone primitives — no AppContext
│   ├── Button (Primary/Secondary/Pill/Link)
│   ├── IconButton, ColorDot, NameInput, Field, EmojiInput
│   ├── Menu (MenuBox/Item/Section/Divider)
│   └── icons.tsx              # Lucide-style line SVG icons
├── molecules/                 # Compositions of atoms
│   ├── SpaceTab               # Header pill
│   ├── TabRow                 # styled parts of a tab row
│   ├── FolderHeader, SyncButton
│   └── RunCat                 # 5-frame mascot for live folders
└── organisms/                 # Stateful compositions, often touching AppContext
    ├── Header, ErrorBanner, OrphanBanner
    ├── SpaceTabsList          # pill bar + per-pill DnD + per-pill SpaceMenu
    ├── SpaceContent, FolderView, ItemRow
    ├── menus.tsx              # SpaceMenu, FolderMenu, TabMenu
    ├── LiveFolderForm
    └── SettingsPanel          # GitHub PAT, font size, backup
```

### Styling — emotion

All styles live with their components via `@emotion/styled`. CSS variables are declared once in `globalStyles.tsx`; the `tokens` object in `theme.ts` is just `{ fg: 'var(--fg)', accent: 'var(--accent)', … }` so dark mode swaps via `prefers-color-scheme` without re-rendering.

`tsconfig.json` sets `jsxImportSource: '@emotion/react'`. The `css` prop and `styled` work without `@emotion/babel-plugin`; **don't** add the plugin. Storybook's vitest runner doesn't run our babel chain, so emotion's **component-selector** feature (`${StyledX} & { … }`) is off-limits — use static class names instead. See the existing `.close-btn` (TabRow) and `.add-row` (FolderView) patterns.

### AppContext

`useAppCtx()` exposes:
- `store`, `windowId`, `tabs` (the full SpaceStore + Chrome tab metadata)
- `refresh()` — re-reads store + tabs (called after every mutation)
- `onError(e)` — surfaces to the side panel's ErrorBanner
- `openMenu` / `setOpenMenu` — single-string menu identifier shared across the panel; only one menu open at a time
- `drag` / `setDrag` / `dropPos` / `setDropPos` / `finalizeDrop` — DnD state
- `onCreateLive` / `onEditLive` — lift the user up to the LiveFolderForm view

Document-level outside-click closes any open menu (`App.tsx` registers a delayed listener that ignores clicks inside `[role="menu"]`).

### DnD model

Two DragState kinds: `{ kind: 'item', item: ItemRef }` for tabs/folders, `{ kind: 'space', spaceId }` for Space pill reordering. DropPos enumerates the five drop targets (before/after a tab row, into a folder, into a Space's root, reorder a pill). `finalizeDrop` dispatches based on kind: `moveItem` for items, `reorderSpaces` for pill reorder. Live folder drops and self/descendant cycles are refused at the space-manager layer (`moveItem`), not just the UI.

### Storybook

`@storybook/react-vite` framework. `.storybook/preview.tsx`:
- Wraps stories with `<GlobalStyles />` so tokens resolve.
- Stubs `window.chrome.*` so AppContext-bound organisms don't throw on click handlers.
- Two background swatches (panel light/dark).

Stories for AppContext-bound organisms use `MockProvider` + `makeFixture()` from `storybook/MockAppCtx.tsx`. Drop in `overrides` to vary state per story.

## Conventions

- All persistence goes through `loadStore` / `updateStore` in `storage.ts` (or `secret-storage.ts` for the token, `ui-prefs.ts` for the panel's font-size). Don't touch `chrome.storage` directly elsewhere.
- All `chrome.*` event handlers in `background/index.ts` wrap async work in `void (async () => { ... })()`. The `chrome.runtime.onMessage` listener returns `true` so async `sendResponse` calls don't get cut off.
- `chrome.storage.local` only — `.sync`'s per-minute write quota is easy to hit during rapid switching.
- `chrome.tabs.hide/show` aren't in our `@types/chrome` version. Cast a local `tabsApi` object to access them.
- Live folder `items` array and `managedTabs` are sync-engine-owned. `moveItem` refuses to drop user content into a Live folder; the side panel `parentIsLive` flag also disables drag handlers on Live tab rows.
- Component selectors in emotion don't survive Storybook's vitest runner — see the styling note above.
- The `RunCat` SVG (live folder mascot) is purely cosmetic; if you need to add a similar animation, animate transform / opacity, not SVG attributes.
