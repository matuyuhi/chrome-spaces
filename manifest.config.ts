import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'Spaces',
  version: '0.1.0',
  description: 'Arc-like workspace switcher: Tab Group based Spaces with GitHub PR live folders',
  permissions: ['tabs', 'tabGroups', 'storage', 'alarms', 'contextMenus'],
  host_permissions: ['https://api.github.com/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Spaces',
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
  },
})
