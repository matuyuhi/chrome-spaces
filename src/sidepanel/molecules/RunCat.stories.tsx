import type { Meta, StoryObj } from '@storybook/react-vite'
import { RunCat } from './RunCat'

const meta: Meta<typeof RunCat> = {
  title: 'molecules/RunCat',
  component: RunCat,
}
export default meta

type Story = StoryObj<typeof RunCat>

export const Default: Story = { args: { size: 24 } }
export const Big: Story = { args: { size: 48 } }
export const HasError: Story = { args: { size: 24, hasError: true } }
