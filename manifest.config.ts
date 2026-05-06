import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

export default defineManifest({
  manifest_version: 3,
  name: 'Spaces',
  version: pkg.version,
  description: 'Arc-like sidebar for Chrome: Spaces, nested folders, GitHub Live folders.',
  icons: {
    16: 'img/icon_16.png',
    32: 'img/icon_32.png',
    48: 'img/icon_48.png',
    64: 'img/icon_64.png',
    128: 'img/icon_128.png',
  },
  permissions: ['tabs', 'tabGroups', 'storage', 'alarms', 'contextMenus', 'sidePanel'],
  host_permissions: ['https://api.github.com/*', 'https://github.com/login/*'],
  // GHES base URLs are entered at runtime; we ask for the specific origin
  // via chrome.permissions.request when the user saves a custom base URL.
  optional_host_permissions: ['https://*/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  action: {
    default_title: 'Spaces',
    default_icon: {
      16: 'img/icon_16.png',
      32: 'img/icon_32.png',
      48: 'img/icon_48.png',
    },
  },
  commands: {
    'switch-space-1': { description: 'Switch to Space 1' },
    'switch-space-2': { description: 'Switch to Space 2' },
    'switch-space-3': { description: 'Switch to Space 3' },
    'switch-space-4': { description: 'Switch to Space 4' },
    'switch-space-5': { description: 'Switch to Space 5' },
    'switch-space-6': { description: 'Switch to Space 6' },
    'switch-space-7': { description: 'Switch to Space 7' },
    'switch-space-8': { description: 'Switch to Space 8' },
    'switch-space-9': { description: 'Switch to Space 9' },
    'new-space': { description: 'Create new Space' },
    'reset-current-tab': { description: 'Reset current tab to its base URL' },
    'sync-current-live': { description: 'Sync the Live folder of the current tab' },
    'open-command-bar': { description: 'Open the Spaces command bar (search tabs across spaces)' },
  },
})
