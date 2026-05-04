import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: '@storybook/react-vite',
  // vite.config.ts wires @crxjs/vite-plugin for the extension build.
  // Storybook re-uses that config and trips its handleHotUpdate
  // (`Cannot read properties of undefined (reading 'background')`)
  // because the manifest pipeline isn't alive in this context. Strip
  // every `crx:*` sub-plugin so HMR is a vanilla Vite flow.
  viteFinal: async (config) => {
    if (config.plugins) {
      config.plugins = config.plugins.filter((p) => {
        if (!p || typeof p !== 'object' || !('name' in p)) return true
        const name = (p as { name?: string }).name
        return !name?.startsWith('crx:') && name !== 'crx'
      })
    }
    return config
  },
}
export default config
