import type { Meta, StoryObj } from '@storybook/react-vite'
import { type Space } from '../../shared/types'
import { SpaceTab } from './SpaceTab'

const baseSpace: Space = {
  id: 'sp1',
  name: 'Reviews',
  color: 'blue',
  windowId: 1,
  order: 0,
  rootFolderId: 'r1',
  createdAt: 0,
  lastAccessedAt: 0,
}

const noopHandlers = {
  onClick: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
}

const meta: Meta<typeof SpaceTab> = {
  title: 'molecules/SpaceTab',
  component: SpaceTab,
  args: { space: baseSpace, active: false, ...noopHandlers },
}
export default meta

type Story = StoryObj<typeof SpaceTab>

export const Default: Story = {}

export const Active: Story = {
  args: { active: true },
}

export const WithEmoji: Story = {
  args: { space: { ...baseSpace, emoji: '🌱' } },
}

export const Dragging: Story = {
  args: { isDragging: true },
}

export const ItemDropTarget: Story = {
  args: { isItemDropTarget: true },
}

export const ReorderBefore: Story = {
  args: { reorderEdge: 'before' },
}

export const ReorderAfter: Story = {
  args: { reorderEdge: 'after' },
}
