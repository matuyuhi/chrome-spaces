import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockProvider, makeFixture } from '../storybook/MockAppCtx'
import { ItemRow } from './ItemRow'

const meta: Meta<typeof ItemRow> = {
  title: 'organisms/ItemRow',
  component: ItemRow,
}
export default meta

type Story = StoryObj<typeof ItemRow>

export const TabRow: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    return (
      <MockProvider overrides={{ store, tabs }}>
        <ItemRow
          item={{ kind: 'tab', tabId: 100 }}
          parentFolderId="r1"
          parentIsLive={false}
          indexInParent={0}
          depth={0}
        />
      </MockProvider>
    )
  },
}

export const PinnedTab: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    // tabId 100 has baseUrl in the fixture → shows the − button
    return (
      <MockProvider overrides={{ store, tabs }}>
        <ItemRow
          item={{ kind: 'tab', tabId: 100 }}
          parentFolderId="r1"
          parentIsLive={false}
          indexInParent={0}
          depth={0}
        />
      </MockProvider>
    )
  },
}

export const LiveTab: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    return (
      <MockProvider overrides={{ store, tabs }}>
        <ItemRow
          item={{ kind: 'tab', tabId: 200 }}
          parentFolderId="live1"
          parentIsLive={true}
          indexInParent={0}
          depth={1}
        />
      </MockProvider>
    )
  },
}

export const ActiveTab: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    return (
      <MockProvider overrides={{ store, tabs }}>
        <ItemRow
          item={{ kind: 'tab', tabId: 100 }}
          parentFolderId="r1"
          parentIsLive={false}
          indexInParent={0}
          depth={0}
        />
      </MockProvider>
    )
  },
}

export const SubFolderRow: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    return (
      <MockProvider overrides={{ store, tabs }}>
        <ItemRow
          item={{ kind: 'folder', folderId: 'sub1' }}
          parentFolderId="r1"
          parentIsLive={false}
          indexInParent={1}
          depth={0}
        />
      </MockProvider>
    )
  },
}
