import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { EmojiPicker } from './EmojiPicker'

const meta: Meta<typeof EmojiPicker> = {
  title: 'atoms/EmojiPicker',
  component: EmojiPicker,
}
export default meta

type Story = StoryObj<typeof EmojiPicker>

export const Empty: Story = {
  render: () => {
    const [v, setV] = useState<string | undefined>()
    return <EmojiPicker value={v} onChange={setV} />
  },
}

export const Preset: Story = {
  render: () => {
    const [v, setV] = useState<string | undefined>('🚀')
    return <EmojiPicker value={v} onChange={setV} />
  },
}
