import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

export default defineManifest({
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_manifest_name__',
  version: pkg.version,
  description: '__MSG_manifest_description__',
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
    default_title: '__MSG_action_title__',
    default_icon: {
      16: 'img/icon_16.png',
      32: 'img/icon_32.png',
      48: 'img/icon_48.png',
    },
  },
  commands: {
    'switch-space-1': { description: '__MSG_cmd_switchSpace1_description__' },
    'switch-space-2': { description: '__MSG_cmd_switchSpace2_description__' },
    'switch-space-3': { description: '__MSG_cmd_switchSpace3_description__' },
    'switch-space-4': { description: '__MSG_cmd_switchSpace4_description__' },
    'switch-space-5': { description: '__MSG_cmd_switchSpace5_description__' },
    'switch-space-6': { description: '__MSG_cmd_switchSpace6_description__' },
    'switch-space-7': { description: '__MSG_cmd_switchSpace7_description__' },
    'switch-space-8': { description: '__MSG_cmd_switchSpace8_description__' },
    'switch-space-9': { description: '__MSG_cmd_switchSpace9_description__' },
    'new-space': { description: '__MSG_cmd_newSpace_description__' },
    'reset-current-tab': { description: '__MSG_cmd_resetCurrentTab_description__' },
    'sync-current-live': { description: '__MSG_cmd_syncCurrentLive_description__' },
    'open-command-bar': { description: '__MSG_cmd_openCommandBar_description__' },
  },
})
