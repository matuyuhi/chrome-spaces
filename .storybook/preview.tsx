import type { Preview } from '@storybook/react-vite'
import { GlobalStyles } from '../src/sidepanel/globalStyles'
import enMessages from '../public/_locales/en/messages.json'

// Stub the `chrome.*` extension APIs that components call. Inside the
// real side panel these dispatch through the SW; in Storybook the chrome
// global is undefined and any interaction would throw. The stubs return
// shapes that keep render + handlers happy without actually mutating
// anything.
if (typeof window !== 'undefined' && !(window as unknown as { chrome?: unknown }).chrome) {
  const i18nMessages = enMessages as Record<string, { message: string }>
  ;(window as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: async () => ({ ok: true, data: undefined }),
    },
    tabs: {
      query: async () => [],
      get: async () => ({}),
      update: async () => ({}),
      remove: async () => undefined,
      onCreated: { addListener: () => {}, removeListener: () => {} },
      onRemoved: { addListener: () => {}, removeListener: () => {} },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
      onActivated: { addListener: () => {}, removeListener: () => {} },
      onMoved: { addListener: () => {}, removeListener: () => {} },
    },
    windows: {
      getCurrent: async () => ({ id: 1 }),
    },
    tabGroups: {
      query: async () => [],
    },
    i18n: {
      getMessage: (key: string, subs?: string | string[]) => {
        const entry = i18nMessages[key]
        if (!entry) return ''
        const list = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs]
        return entry.message.replace(/\$(\d)/g, (_, d: string) => {
          const i = Number(d) - 1
          return i >= 0 && i < list.length ? list[i] : ''
        })
      },
    },
  }
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'panel',
      values: [
        { name: 'panel', value: '#ffffff' },
        { name: 'panel-dark', value: '#0d1117' },
      ],
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => (
      <>
        <GlobalStyles />
        <div style={{ padding: 12, maxWidth: 360 }}>
          <Story />
        </div>
      </>
    ),
  ],
}

export default preview
