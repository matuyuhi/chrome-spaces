# Spaces

Arc-like Chrome extension. Built on top of Chrome's native Tab Groups + the
`chrome://flags/#vertical-tabs` UI, this extension layers Arc-style **Spaces**
and **Live Folders (GitHub PRs)** on top.

- **Spaces**: a 1:1 wrapper around a Tab Group. Switching a Space collapses
  every other group in the window and expands the target — no tabs are lost,
  the switch is instantaneous.
- **Live Folders**: a Space whose tabs are auto-populated from a query
  (currently GitHub PRs). Closed/merged PRs are removed on refresh; new ones
  are added.

## Install (unpacked)

```bash
git clone … && cd chrome-ext
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` directory

(Optional but recommended) Enable Chrome's vertical tab strip:

1. Open `chrome://flags/#vertical-tabs`
2. Set to **Enabled**, restart Chrome

## Keyboard shortcuts

Chrome only auto-binds 4 extension shortcuts at install time, and most of the
natural choices (⌘1–9) clash with Chrome's built-in tab navigation. So this
extension ships with **no default bindings**. After installing, open
`chrome://extensions/shortcuts` and bind whatever you like, e.g.:

| Command           | Suggested binding |
| ----------------- | ----------------- |
| Switch to Space 1 | ⌃⌥1               |
| Switch to Space 2 | ⌃⌥2               |
| …                 | …                 |
| Switch to Space 9 | ⌃⌥9               |
| Create new Space  | ⌃⌥N               |

The extension popup also has a **Configure shortcuts →** link that opens this
page directly.

## GitHub Live Folders

Live Folders auto-populate a Space with PR tabs from GitHub.

### 1. Generate a Personal Access Token

1. Go to <https://github.com/settings/tokens?type=beta> (fine-grained PAT)
2. Scope it to the repos you care about
3. Required permissions:
   - **Repository access**: the repos whose PRs you want to see
   - **Pull requests**: read
   - **Metadata**: read (auto-required)

Classic tokens also work — `repo` (private) or `public_repo` (public only) is
enough.

### 2. Save the token in the extension

1. Open the popup → click **⚙ Settings**
2. Paste the PAT, click **Save token**

The token lives only in `chrome.storage.local` on this device — it is **never**
synced via `chrome.storage.sync`, never sent anywhere except api.github.com.

### 3. Create a Live Folder

Popup → **+ Live Folder** → pick a preset and a refresh interval:

| Preset             | Equivalent GitHub search                     |
| ------------------ | -------------------------------------------- |
| Review requested   | `is:pr is:open review-requested:@me`         |
| Assigned to me     | `is:pr is:open assignee:@me`                 |
| Authored by me     | `is:pr is:open author:@me`                   |
| Custom             | (your own search query, free-form)           |

The folder syncs immediately, then again every N minutes (default 5). Closed
or merged PRs are removed on the next sync; newly opened ones are added.

If a sync fails (e.g., bad token, rate limited), the row gets a ⚠ badge and
the popup row's `⋯` menu shows the error. The next scheduled sync will retry.

## Architecture, briefly

- `src/background/` — MV3 service worker
  - `space-manager.ts` — Space CRUD, switch logic
  - `storage.ts` — `chrome.storage.sync` wrapper (metadata)
  - `secret-storage.ts` — `chrome.storage.local` wrapper (token only)
  - `handlers.ts` — `chrome.tabs` / `chrome.tabGroups` event sync
  - `commands.ts` — keyboard shortcut dispatch
  - `reconcile.ts` — startup-time integrity (mark unmounted, optional adopt)
  - `live/sync-engine.ts` — pull source → diff → apply → persist
  - `live/diff.ts` — pure list-diff
  - `live/alarms.ts` — `chrome.alarms` wiring per Live Space
  - `live/sources/github.ts` — GitHub Search API client
- `src/popup/` — React popup UI
- `src/shared/types.ts` — shared types

## Limitations

- **Same browser profile**: all Spaces share cookies/login state. The
  extension does not (and cannot, from a Chrome extension API standpoint)
  isolate per-Space profiles. If you need a separate Google/etc account, use
  Chrome's native profile picker.
- **One window per `windowId`**: a Tab Group is window-bound. Each Chrome
  window has its own Spaces.
- **Manual shortcut binding**: see above.

## Development

```bash
npm test         # vitest run
npm run test:watch
npm run build    # tsc + vite build → dist/
npm run dev      # vite dev (HMR for popup; SW reloads via crxjs)
```

There is no Web Store release. This is for local unpacked install only.
