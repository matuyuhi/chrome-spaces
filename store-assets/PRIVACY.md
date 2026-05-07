# Privacy Policy for Spaces

Last updated: 2026-05-08

## 1. Overview

Spaces is a Chrome extension that organizes your open tabs into named "Spaces" and folders inside the Chrome Side Panel. It also supports "Live folders" that mirror a GitHub Search query as tabs.

This policy explains exactly what data Spaces touches and where it goes. The short version: **Spaces has no server.** Everything stays on your device, except for direct requests to GitHub's API that you explicitly configure.

- Extension ID (production): `nojhdjjfobjiacnakbcmdcngpkdfebih`
- Extension ID (development): `nephboakgdhbknfgjpjcleaddkdkfceh`
- Source code: https://github.com/Matuyuhi/chrome-spaces
- Contact: bird9.yuhi@gmail.com

## 2. What data we collect

We — the developer of Spaces — collect **nothing**. We do not operate a backend, we do not run analytics, and we do not receive any of your data.

The extension itself reads and stores the following on your local device only:

- **Tab titles and URLs** of tabs in your current Chrome windows, so the Side Panel can display them.
- **Your Spaces / folders / tab references** that you create through the UI.
- **A GitHub Personal Access Token (PAT)**, only if you choose to use Live folders.
- **UI preferences** (e.g. font size).

We do **not** collect any of the following:

- Personally identifiable information (name, email address, postal address, phone number, etc.).
- Health information.
- Financial or payment information.
- Personal communications (messages, emails, chat content).
- Location data.
- User activity such as clicks, mouse movement, scroll position, or keystrokes.
- Website content (page text, images, audio, video, or in-page hyperlinks).

The only "web history"-shaped data the extension touches are the **titles and URLs of tabs you have open in Chrome**, and only because the Side Panel needs them to render a representation of those tabs. This data is never transmitted to us or to any third party.

## 3. How data is stored

All extension data is stored locally on your device using `chrome.storage.local`.

- `chrome.storage.local` is **not synced across devices**. We deliberately do not use `chrome.storage.sync`.
- Data is removed when you uninstall the extension or clear extension storage in Chrome.
- We do not use cookies, IndexedDB, or any other tracking storage.
- We do not transmit this data to any server operated by us. We do not have a server.

`chrome.alarms` is used to schedule periodic refreshes of Live folders. Alarms contain no personal data.

## 4. GitHub Personal Access Token (PAT) handling

Live folders are an optional feature. To use them, you can paste a GitHub Personal Access Token into the extension's Settings panel.

- The PAT is stored in `chrome.storage.local` under a separate key (`SecretStore`).
- The PAT is **never** written to `chrome.storage.sync`, so it is not synced across your devices by Chrome.
- The PAT is **never** sent to the developer or to any third party other than GitHub itself.
- The PAT is used only as the `Authorization` header on requests the extension makes directly from your browser to the GitHub API.
- You can remove the PAT at any time from the Settings panel, or by uninstalling the extension.

You should treat your PAT as a secret. We recommend creating a fine-grained token with the minimum scopes you need.

## 5. Third-party services

The extension makes outbound network requests to **GitHub** only, and only when you have configured a Live folder:

- `https://api.github.com/*` (GitHub's public API), and
- Any GitHub Enterprise Server URL that **you** add in Settings.

These requests:

- Are made directly from your browser to GitHub.
- Are authenticated with **your own** GitHub PAT.
- Return only data that **your** GitHub account is authorized to see.
- Are used solely to populate the contents of Live folders that you set up.

We do not proxy these requests. We do not see them. GitHub's own privacy policy applies to data you send to GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement

The extension does not contact any other third-party service. There are no analytics SDKs, no advertising SDKs, no crash reporters, and no telemetry.

## 6. Permissions explained

Each Chrome permission requested in `manifest.json` is used as follows:

- **`tabs`** — Required to read the title, URL, and window/tab IDs of tabs you have open, so the Side Panel can render them and so you can move them between Spaces. Tab data is processed locally and never leaves your device.
- **`storage`** — Required to persist your Spaces, folders, settings, and (optionally) your GitHub PAT in `chrome.storage.local` on your device.
- **`alarms`** — Required to schedule periodic refreshes of Live folders.
- **`contextMenus`** — Required to add right-click menu items such as "Sync this Live folder" and "Reset tab to base URL".
- **`sidePanel`** — Required to render the extension's UI inside Chrome's Side Panel.
- **Host permission for `https://api.github.com/*`** (and any GitHub Enterprise host you add) — Required so the extension can fetch GitHub Search API results for your Live folders, using your own PAT.

The extension does **not** request `history`, `bookmarks`, `cookies`, `webRequest`, `<all_urls>` content scripts, or any permission that would let it read the contents of arbitrary web pages.

## 7. Data sharing and selling

We do not sell, rent, trade, or share any user data. We have no user data to share, because we do not collect any.

The only outbound data flow from the extension is requests **you** initiate to **GitHub**, authenticated with **your** PAT, to fetch **your** data. That flow goes from your browser directly to GitHub, not through us.

## 8. Children's privacy

Spaces is not directed to children under 13, and we do not knowingly collect any data from anyone, regardless of age.

## 9. Changes to this policy

If this policy changes in a way that affects what the extension does with your data, we will update the "Last updated" date at the top and publish the new version in the extension's repository before releasing the corresponding extension update. Material changes will also be noted in the repository's release notes.

## 10. Contact

Questions, concerns, or requests about this policy or the extension can be sent to:

- Email: bird9.yuhi@gmail.com
- GitHub issues: https://github.com/Matuyuhi/chrome-spaces/issues
