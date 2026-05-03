import type { Meta, StoryObj } from '@storybook/react-vite'
import { type Folder, type Space } from '../../shared/types'
import { FolderMenu, SpaceMenu, TabMenu } from './menus'

const space: Space = {
  id: 'sp1',
  name: 'Reviews',
  color: 'blue',
  windowId: 1,
  order: 0,
  rootFolderId: 'r1',
  createdAt: 0,
  lastAccessedAt: 0,
}

const folder: Folder = {
  id: 'f1',
  name: 'PRs',
  collapsed: false,
  items: [],
}

const liveFolder: Folder = {
  ...folder,
  id: 'f2',
  name: 'Reviews',
  live: {
    source: { type: 'github-prs', preset: 'review-requested' },
    refreshIntervalMin: 0,
    managedTabs: [],
  },
}

const noop = () => {}

// Menus are positioned absolutely. Wrap in a relative box so they
// render in-place inside the story.
const Anchor = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: 'relative', height: 320 }}>{children}</div>
)

export default {
  title: 'organisms/Menus',
} as Meta

type Story = StoryObj

export const Space_: Story = {
  name: 'SpaceMenu',
  render: () => (
    <Anchor>
      <SpaceMenu
        space={space}
        onClose={noop}
        onRename={noop}
        onColor={noop}
        onEmoji={noop}
        onDelete={noop}
      />
    </Anchor>
  ),
}

export const Folder_: Story = {
  name: 'FolderMenu',
  render: () => (
    <Anchor>
      <FolderMenu
        folder={folder}
        onClose={noop}
        onRename={noop}
        onEmoji={noop}
        onEditLive={noop}
        onDelete={noop}
      />
    </Anchor>
  ),
}

export const LiveFolder: Story = {
  name: 'FolderMenu (live)',
  render: () => (
    <Anchor>
      <FolderMenu
        folder={liveFolder}
        onClose={noop}
        onRename={noop}
        onEmoji={noop}
        onEditLive={noop}
        onDelete={noop}
      />
    </Anchor>
  ),
}

export const Tab_: Story = {
  name: 'TabMenu (unpinned)',
  render: () => (
    <Anchor>
      <TabMenu
        canReset={false}
        canPin={true}
        canUnpin={false}
        onClose={noop}
        onPin={noop}
        onUnpin={noop}
        onReset={noop}
        onCloseTab={noop}
      />
    </Anchor>
  ),
}

export const TabPinned: Story = {
  name: 'TabMenu (pinned)',
  render: () => (
    <Anchor>
      <TabMenu
        canReset={true}
        canPin={false}
        canUnpin={true}
        onClose={noop}
        onPin={noop}
        onUnpin={noop}
        onReset={noop}
        onCloseTab={noop}
      />
    </Anchor>
  ),
}

export const TabLive: Story = {
  name: 'TabMenu (live)',
  render: () => (
    <Anchor>
      <TabMenu
        canReset={true}
        canPin={false}
        canUnpin={false}
        onClose={noop}
        onPin={noop}
        onUnpin={noop}
        onReset={noop}
        onCloseTab={noop}
      />
    </Anchor>
  ),
}
