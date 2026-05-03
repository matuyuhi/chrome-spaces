import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinkButton, PillButton, PrimaryButton, SecondaryButton } from './Button'

const meta: Meta = {
  title: 'atoms/Button',
}
export default meta

type Story = StoryObj

export const Primary: Story = {
  render: () => <PrimaryButton>Save token</PrimaryButton>,
}

export const Secondary: Story = {
  render: () => <SecondaryButton>Cancel</SecondaryButton>,
}

export const Pill: Story = {
  render: () => <PillButton>+ Space</PillButton>,
}

export const Link: Story = {
  render: () => <LinkButton>dismiss</LinkButton>,
}

export const Disabled: Story = {
  render: () => <PrimaryButton disabled>Saving…</PrimaryButton>,
}
