# Spaces

Arc-style sidebar for Chrome. Vertical tab list, nested folders per Space,
and GitHub PR / Issue **Live folders** that auto-populate from a query.

This extension runs entirely on its own model — Chrome Tab Groups are not
used at all. Switching a Space hides every other window-tab via
`chrome.tabs.hide` and shows the target Space's tabs, so the strip mirrors
the Side Panel's view.

<img width="1200" alt="image" src="https://github.com/user-attachments/assets/6f5f0f90-808a-498b-b012-aefde535ca67" />


## Install (unpacked)

```bash
git clone …
cd chrome-spaces
npm install     # installs deps; engine pinned via .node-version (24.15.0)
npm run build   # → dist/
```

In Chrome:

1. Open `chrome://extensions`
2. Toggle **Developer mode**
3. **Load unpacked** → select `dist/`
4. Click the **Spaces** icon in the toolbar — the Side Panel opens
5. (Recommended) Hide Chrome's tab strip with
   `chrome://flags/#vertical-tabs` → Enabled, restart

## Concepts

- **Space**: a named container, scoped to one window. Has color, optional
  emoji, and a tree of folders / tabs.
- **Folder**: an ordered list of items (tabs or sub-folders) inside a
  Space. Foldable. Optional Live config (see below).
- **Live folder**: a folder whose tabs are managed by a `LiveSource` (a
  GitHub PR or Issue search query). Add/remove tabs follow the search
  result on each sync.
- **Pinned tab (snap-back)**: any tab can be assigned a base URL via
  right-click → "Pin to current URL". Right-click → "Reset to base URL"
  navigates the tab back even after you've drilled deeper.

## Side Panel

- **+** in the header creates a new empty Space.
- **⇩N** appears when N Chrome Tab Groups exist in this window;
  clicking imports them as Spaces.
- **⚙** opens settings (GitHub PAT).
- **Space pills** at the top: click to switch (other Spaces' tabs hide
  in the strip), drag to reorder, drag a tab onto a pill to move it
  into that Space.
- **Space ⋯ menu**: rename, color, emoji, delete (with or without
  closing tabs).
- **Folder ⋯ menu**: rename, emoji, delete, edit Live config.
- **+ Folder / + Live folder** at the bottom of any non-Live folder.
- **Drag-and-drop**: tabs and folders. Live folders refuse drops (their
  contents are owned by the sync engine).
- **Tab right-click**: pin / reset / close.

## GitHub Live folders

1. Generate a Personal Access Token. Fine-grained PAT with
   "Repository → Pull requests: read" + "Metadata: read" works for PRs;
   add "Issues: read" if you want Issue folders. Classic `repo` /
   `public_repo` also works.
2. Side Panel → **⚙** → paste the token. Stored only in
   `chrome.storage.local` on this device.
3. Inside any Space, click **+ Live folder** at the bottom of the root
   folder (or a sub-folder). Pick:
   - **Source**: PR or Issue + preset (review-requested / assigned /
     authored / mentioned / custom search)
   - **User**: defaults to `@me`
   - **Filter**: empty / `*` = all repos. A bare `acme` becomes
     `org:acme`. `org:foo`, `user:bar`, `repo:a/b` are taken verbatim.
     `!sb` (or `-org:sb`) excludes that org.
   - **Refresh interval**: minutes; **0 = manual only**

A Live folder shows `↻` to sync now, and a `⚠` badge if the last sync
errored (hover for the message). Right-click any tab inside a Live
folder's pages and pick "Sync this Live folder" to refresh from
anywhere on the web.

## Keyboard shortcuts

Chrome only auto-binds 4 shortcuts at install time, and the obvious
choices (⌘1–9) collide with Chrome's own tab navigation. So this
extension ships with **no defaults**. Open
`chrome://extensions/shortcuts` and bind whatever you want, e.g.:

| Command            | Suggested      |
| ------------------ | -------------- |
| switch-space-1..9  | ⌃⌥1–9          |
| new-space          | ⌃⌥N            |
| reset-current-tab  | ⌃⌥⇧R           |
| sync-current-live  | ⌃⌥⇧S           |

## Architecture

```
src/
├── background/
│   ├── index.ts            ─ SW: bootstrap + message router
│   ├── space-manager.ts    ─ all CRUD on Space / Folder / TabRecord
│   ├── handlers.ts         ─ chrome.tabs / windows event sinks
│   ├── reconcile.ts        ─ prune dead tab refs at startup
│   ├── storage.ts          ─ chrome.storage.local + v1 → v2 migration
│   ├── secret-storage.ts   ─ separate key for the GitHub PAT
│   ├── commands.ts         ─ chrome.commands dispatch
│   ├── context-menus.ts    ─ chrome.contextMenus + handler
│   └── live/
│       ├── alarms.ts       ─ per-folder sync schedule
│       ├── sync-engine.ts  ─ fetch + diff + apply
│       ├── diff.ts         ─ pure list-diff
│       └── sources/
│           └── github.ts   ─ Search API client
├── shared/
│   ├── types.ts            ─ schema v2: Space + Folder + ItemRef + …
│   └── messaging.ts        ─ typed sendMessage RPC
└── sidepanel/
    ├── index.html
    ├── main.tsx
    ├── App.tsx             ─ tree, DnD, menus, settings
    ├── LiveFolderForm.tsx
    └── sidepanel.css
```

### Switching a Space

`switchTo(spaceId, windowId)`:

1. Persist `activeSpaceByWindow[windowId] = spaceId` first so any tab
   event during the switch sees the new state.
2. Activate one of the target Space's tabs (lastActiveTabId, or the
   first known tab, or a freshly-created starter tab if the Space is
   empty). Chrome refuses to hide the active tab.
3. `chrome.tabs.show(targetTabIds)` — idempotent for tabs already
   visible.
4. `chrome.tabs.hide(everyOtherTabInWindow)`.

### Live folder ownership

A Live folder's `items` is rewritten by the sync engine on every run.
After applying the diff, the engine strips its newly-claimed tabIds
from any other folder that may have grabbed them via
`chrome.tabs.onCreated → registerTab` while the network call was in
flight. The `moveItem` operation also refuses to drop user-owned items
into a Live folder.

### Migration

Schema v1 (Tab Group based) is rewritten to v2 once on first run after
upgrade. Each old Static Space becomes a Space with the group's tabs in
its root folder; each old Live Space becomes a Space with one Live
folder in its root, carrying over the source query, managed tabs, and
sync history. The underlying Chrome Tab Groups are ungrouped.

## Development

```bash
npm test           # vitest run
npm run test:watch
npm run build      # tsc + vite build → dist/
npm run dev        # vite dev (HMR for side panel; SW reloads via crxjs)
```

Tests run in the `node` environment with a fake `globalThis.chrome`
installed by `setupChromeMock()` (see `src/background/test-utils.ts`).

There is no Web Store release. Local unpacked install only.
