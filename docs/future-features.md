# Future Features

Things we've decided to defer rather than build now. Each entry should
explain *why* it's deferred and *what* it would take so the next person
(or future-you) can pick it up cleanly.

## Boosts (per-domain CSS / JS injection)

Arc-style "Boosts": rewrite a site's CSS or inject a small JS snippet
on a per-domain basis (hide YouTube comments, inject a custom font,
etc.). Deferred because it sits on a noticeably broader permission
surface than anything Spaces currently uses, and the value is unclear
relative to the cost.

### What it would take

- **Permissions**: `scripting` + dynamic content scripts via
  `chrome.scripting.registerContentScripts`. Origins targeted at
  runtime via `optional_host_permissions: ['*://*/*']` plus a per-Boost
  `chrome.permissions.request({ origins: ['https://example.com/*'] })`
  flow (mirrors how the GHES base URL and RSS feed origins are granted
  today).
- **Storage**: a new `boosts: Boost[]` slice on `SpaceStore` (or a
  separate top-level key — Boosts are global, not Space-scoped). Each
  `Boost` carries an origin pattern, a CSS payload, and/or a JS
  payload, plus an enabled flag.
- **Background**: on bootstrap, walk Boosts and call
  `chrome.scripting.registerContentScripts(...)` (idempotent — pass an
  `id` per Boost so re-registration replaces). Re-register on Boost
  CRUD.
- **UI**: new Settings sub-page "Boosts" with a list, an "Add Boost"
  form (origin pattern, CSS textarea, JS textarea), enable/disable
  toggle, delete. CodeMirror is overkill — a `<textarea>` with a
  monospace font is fine for v1.
- **Safety net**: explicit warnings in the UI that JS injection runs
  with the page's context and any Boost can break sites. No remote
  fetch — only locally-saved snippets execute.

### Why not now

1. The `scripting` permission is the largest single bump in install
   warning, and we'd be adding it for a feature most users won't use.
   Better to wait until there's a clear request signal.
2. Implementing Boosts well needs a small CSS/JS editor with at least
   syntax highlighting, plus debounced live preview, plus a "this
   Boost broke; disable it" recovery path. That's a couple of days of
   work, not an evening.
3. Existing tooling (Stylus, custom user CSS, devtools snippets)
   already covers most personal use cases for power users.

If we ship this later, reuse the runtime permission flow from the GHES
URL save and the RSS feed save in `LiveFolderForm` — the pattern is
identical (collect URL → request origin → persist).

## Web Store publish

The repo's CLAUDE.md explicitly notes the project ships as an unpacked
install only ("No Web Store release"). If we ever change our minds:

- Add a `key` field to the manifest so the extension ID is stable.
- Provide store assets (128 / 48 / 16 icons, screenshots, promo tile).
- Switch from "Allow merge commits" + "Allow rebase merging" repo
  settings to whatever the release flow needs (the existing
  `release.yml` is geared toward GitHub Releases, not the Web Store
  upload pipeline).
- Re-evaluate `optional_host_permissions: ['https://*/*']` — review
  reviewers may push back on the wide host scope; we'd need to tighten
  or justify it.
