import type { Meta, StoryObj } from '@storybook/react-vite'
import { DEFAULT_UI_PREFS } from '../../shared/messaging'
import { MockProvider, makeFixture } from '../storybook/MockAppCtx'
import { FolderView } from './FolderView'

const meta: Meta<typeof FolderView> = {
  title: 'organisms/FolderView',
  component: FolderView,
}
export default meta

type Story = StoryObj<typeof FolderView>

export const Root: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const root = store.folders.r1!
    return (
      <MockProvider overrides={{ store, tabs }}>
        <FolderView folder={root} depth={0} isRoot />
      </MockProvider>
    )
  },
}

export const PlainFolder: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const sub = store.folders.sub1!
    return (
      <MockProvider overrides={{ store, tabs }}>
        <FolderView folder={sub} depth={0} />
      </MockProvider>
    )
  },
}

export const LiveFolder: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const live = store.folders.live1!
    return (
      <MockProvider overrides={{ store, tabs }}>
        <FolderView folder={live} depth={0} />
      </MockProvider>
    )
  },
}

export const LiveFolderWithError: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const live = {
      ...store.folders.live1!,
      live: {
        ...store.folders.live1!.live!,
        lastSyncError: 'GitHub 401: Bad credentials',
      },
    }
    const next = {
      ...store,
      folders: { ...store.folders, [live.id]: live },
    }
    return (
      <MockProvider overrides={{ store: next, tabs }}>
        <FolderView folder={live} depth={0} />
      </MockProvider>
    )
  },
}

export const Collapsed: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const folder = { ...store.folders.sub1!, collapsed: true }
    return (
      <MockProvider overrides={{ store, tabs }}>
        <FolderView folder={folder} depth={0} />
      </MockProvider>
    )
  },
}

// Default pref: hover the nested "Notes" sub-folder header — the
// "+ Folder / + Live folder" row should NOT appear inside it. Only
// the root row at the bottom of the Space gets the affordance.
export const NestedAddRowsHidden: Story = {
  name: 'Nested add-rows (default off)',
  render: () => {
    const { store, tabs } = makeFixture()
    const root = store.folders.r1!
    return (
      <MockProvider
        overrides={{
          store,
          tabs,
          prefs: { ...DEFAULT_UI_PREFS, showAddRowsInNestedFolders: false },
        }}
      >
        <FolderView folder={root} depth={0} isRoot />
      </MockProvider>
    )
  },
}

// Pref flipped on: hover the "Notes" sub-folder — the "+ Folder /
// + Live folder" row should appear scoped to that nested folder.
export const NestedAddRowsShown: Story = {
  name: 'Nested add-rows (pref on)',
  render: () => {
    const { store, tabs } = makeFixture()
    const root = store.folders.r1!
    return (
      <MockProvider
        overrides={{
          store,
          tabs,
          prefs: { ...DEFAULT_UI_PREFS, showAddRowsInNestedFolders: true },
        }}
      >
        <FolderView folder={root} depth={0} isRoot />
      </MockProvider>
    )
  },
}
