import type { Meta, StoryObj } from '@storybook/react-vite'
import { LiveFolderForm } from './LiveFolderForm'

const meta: Meta<typeof LiveFolderForm> = {
  title: 'organisms/LiveFolderForm',
  component: LiveFolderForm,
  args: {
    onCancel: () => {},
    onSubmit: () => {},
  },
}
export default meta

type Story = StoryObj<typeof LiveFolderForm>

export const Create: Story = {
  args: { mode: 'create' },
}

export const EditPreset: Story = {
  args: {
    mode: 'edit',
    initial: {
      name: 'Reviews',
      source: {
        type: 'github-prs',
        preset: 'review-requested',
        repoFilter: 'acme',
      },
      refreshIntervalMin: 5,
    },
  },
}

export const EditCustom: Story = {
  args: {
    mode: 'edit',
    initial: {
      name: 'Hot bugs',
      source: {
        type: 'github-issues',
        preset: 'custom',
        query: 'is:issue is:open label:bug org:acme',
      },
      refreshIntervalMin: 0,
    },
  },
}
