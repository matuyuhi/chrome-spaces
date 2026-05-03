import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SyncButton } from './SyncButton'

const meta: Meta<typeof SyncButton> = {
  title: 'molecules/SyncButton',
  component: SyncButton,
}
export default meta

type Story = StoryObj<typeof SyncButton>

export const Idle: Story = {
  args: { syncing: false, onClick: () => {} },
}

export const Syncing: Story = {
  args: { syncing: true, onClick: () => {} },
}

export const Interactive: Story = {
  render: () => {
    const [syncing, setSyncing] = useState(false)
    return (
      <SyncButton
        syncing={syncing}
        onClick={() => {
          setSyncing(true)
          setTimeout(() => setSyncing(false), 1500)
        }}
      />
    )
  },
}
