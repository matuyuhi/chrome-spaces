import type { Meta, StoryObj } from '@storybook/react-vite'
import { OrphanBanner } from './OrphanBanner'

const meta: Meta<typeof OrphanBanner> = {
  title: 'organisms/OrphanBanner',
  component: OrphanBanner,
  args: {
    count: 4,
    spaceName: 'Reviews',
    onAddToCurrent: () => {},
    onCreateNewSpace: () => {},
  },
}
export default meta

type Story = StoryObj<typeof OrphanBanner>

export const Default: Story = {}
export const Single: Story = { args: { count: 1 } }
export const NoActiveSpace: Story = { args: { spaceName: undefined } }
export const Hidden: Story = { args: { count: 0 } }
