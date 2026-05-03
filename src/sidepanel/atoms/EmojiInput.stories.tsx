import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { EmojiInput } from './EmojiInput'

const meta: Meta<typeof EmojiInput> = {
  title: 'atoms/EmojiInput',
  component: EmojiInput,
}
export default meta

type Story = StoryObj<typeof EmojiInput>

export const Empty: Story = {
  render: () => {
    const [v, setV] = useState<string | undefined>()
    return <EmojiInput initial={v} onChange={setV} />
  },
}

export const Preset: Story = {
  render: () => {
    const [v, setV] = useState<string | undefined>('🚀')
    return <EmojiInput initial={v} onChange={setV} />
  },
}
