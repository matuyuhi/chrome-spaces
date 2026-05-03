import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconButton } from './IconButton'
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  X,
} from './icons'

const meta: Meta<typeof IconButton> = {
  title: 'atoms/IconButton',
  component: IconButton,
}
export default meta

type Story = StoryObj<typeof IconButton>

export const Plain: Story = {
  render: () => (
    <IconButton>
      <MoreHorizontal size={14} />
    </IconButton>
  ),
}

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <IconButton aria-label="Plus"><Plus size={14} /></IconButton>
      <IconButton aria-label="Settings"><Settings size={14} /></IconButton>
      <IconButton aria-label="Refresh"><RefreshCw size={14} /></IconButton>
      <IconButton aria-label="Close"><X size={14} /></IconButton>
      <IconButton aria-label="Down"><ChevronDown size={14} /></IconButton>
      <IconButton aria-label="Right"><ChevronRight size={14} /></IconButton>
    </div>
  ),
}
