import type { Meta, StoryObj } from '@storybook/react-vite'
import { PanelHeader } from './Header'

const meta: Meta<typeof PanelHeader> = {
  title: 'organisms/PanelHeader',
  component: PanelHeader,
  args: {
    tabGroupCount: 0,
    onImportTabGroups: () => {},
    onNewSpace: () => {},
    onOpenSettings: () => {},
  },
}
export default meta

type Story = StoryObj<typeof PanelHeader>

export const Default: Story = {}
export const WithImportPrompt: Story = { args: { tabGroupCount: 3 } }
