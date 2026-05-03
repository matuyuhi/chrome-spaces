import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockProvider, makeFixture } from '../storybook/MockAppCtx'
import { SpaceTabsList } from './SpaceTabsList'

const meta: Meta<typeof SpaceTabsList> = {
  title: 'organisms/SpaceTabsList',
  component: SpaceTabsList,
}
export default meta

type Story = StoryObj<typeof SpaceTabsList>

export const TwoSpaces: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const spaces = Object.values(store.spaces)
    return (
      <MockProvider overrides={{ store, tabs }}>
        <SpaceTabsList spaces={spaces} active={spaces[0]} windowId={1} />
      </MockProvider>
    )
  },
}

export const ManySpaces: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const moreSpaces = [...Object.values(store.spaces)]
    for (let i = 0; i < 6; i++) {
      moreSpaces.push({
        id: `extra${i}`,
        name: `Project ${i + 1}`,
        color: (['red', 'yellow', 'cyan', 'purple', 'pink', 'orange'] as const)[i]!,
        windowId: 1,
        order: 100 + i,
        rootFolderId: `er${i}`,
        createdAt: 0,
        lastAccessedAt: 0,
      })
    }
    return (
      <MockProvider overrides={{ store, tabs }}>
        <SpaceTabsList spaces={moreSpaces} active={moreSpaces[0]} windowId={1} />
      </MockProvider>
    )
  },
}

export const NoActive: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const spaces = Object.values(store.spaces)
    return (
      <MockProvider overrides={{ store, tabs }}>
        <SpaceTabsList spaces={spaces} active={undefined} windowId={1} />
      </MockProvider>
    )
  },
}
