import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockProvider, makeFixture } from '../storybook/MockAppCtx'
import { SpaceContent } from './SpaceContent'

const meta: Meta<typeof SpaceContent> = {
  title: 'organisms/SpaceContent',
  component: SpaceContent,
}
export default meta

type Story = StoryObj<typeof SpaceContent>

export const ActiveSpace: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const space = store.spaces.sp1!
    return (
      <MockProvider overrides={{ store, tabs }}>
        <SpaceContent space={space} />
      </MockProvider>
    )
  },
}

export const SecondSpace: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const space = store.spaces.sp2!
    return (
      <MockProvider overrides={{ store, tabs }}>
        <SpaceContent space={space} />
      </MockProvider>
    )
  },
}
