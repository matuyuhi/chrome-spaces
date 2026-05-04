import type { Meta, StoryObj } from '@storybook/react-vite'
import { MockProvider, makeFixture } from '../storybook/MockAppCtx'
import { PinnedBar } from './PinnedBar'
import { type PinnedUrl } from '../../shared/types'

const meta: Meta<typeof PinnedBar> = {
  title: 'organisms/PinnedBar',
  component: PinnedBar,
}
export default meta

type Story = StoryObj<typeof PinnedBar>

const SAMPLE_PINS: PinnedUrl[] = [
  {
    id: 'p1',
    url: 'https://github.com',
    title: 'GitHub',
    favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
    addedAt: 0,
  },
  {
    id: 'p2',
    url: 'https://news.ycombinator.com/',
    title: 'Hacker News',
    favIconUrl: 'https://news.ycombinator.com/favicon.ico',
    addedAt: 0,
  },
  {
    id: 'p3',
    url: 'https://notion.so',
    title: 'Notion',
    favIconUrl: 'https://www.notion.so/images/favicon.ico',
    addedAt: 0,
  },
  {
    id: 'p4',
    url: 'https://linear.app',
    title: 'Linear',
    favIconUrl: 'https://linear.app/favicon.ico',
    addedAt: 0,
  },
  {
    id: 'p5',
    url: 'https://figma.com',
    title: 'Figma',
    favIconUrl: 'https://static.figma.com/app/icon/1/favicon.ico',
    addedAt: 0,
  },
]

// Empty state — drop zone only visible
export const Empty: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    return (
      <MockProvider overrides={{ store, tabs }}>
        <PinnedBar spaceId="sp1" pinnedUrls={[]} />
      </MockProvider>
    )
  },
}

// 5 pinned items
export const Populated: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const overrideStore = {
      ...store,
      spaces: {
        ...store.spaces,
        sp1: { ...store.spaces.sp1!, pinnedUrls: SAMPLE_PINS },
      },
    }
    return (
      <MockProvider overrides={{ store: overrideStore, tabs }}>
        <PinnedBar spaceId="sp1" pinnedUrls={SAMPLE_PINS} />
      </MockProvider>
    )
  },
}

// favIconUrl missing — should show Globe fallback
export const WithMissingFavicon: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    const noFaviconPins: PinnedUrl[] = [
      {
        id: 'p1',
        url: 'https://example.com',
        title: 'Example (no favicon)',
        addedAt: 0,
        // favIconUrl intentionally omitted
      },
      {
        id: 'p2',
        url: 'https://broken-favicon.example.com',
        title: 'Broken favicon',
        // deliberately bad URL so img onError fires
        favIconUrl: 'https://this-domain-does-not-exist.invalid/icon.png',
        addedAt: 0,
      },
      {
        id: 'p3',
        url: 'https://github.com',
        title: 'GitHub (good favicon)',
        favIconUrl: 'https://github.githubassets.com/favicons/favicon.svg',
        addedAt: 0,
      },
    ]
    return (
      <MockProvider overrides={{ store, tabs }}>
        <PinnedBar spaceId="sp1" pinnedUrls={noFaviconPins} />
      </MockProvider>
    )
  },
}

// undefined pinnedUrls — should behave identically to empty
export const UndefinedPinnedUrls: Story = {
  render: () => {
    const { store, tabs } = makeFixture()
    return (
      <MockProvider overrides={{ store, tabs }}>
        <PinnedBar spaceId="sp1" pinnedUrls={undefined} />
      </MockProvider>
    )
  },
}
