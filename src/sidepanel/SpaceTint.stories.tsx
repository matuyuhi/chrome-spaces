import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import type { SpaceColor } from '../shared/types'
import { COLOR_GRADIENT, COLOR_HEX, COLORS } from './theme'

// Mirrors what App.tsx does in the real side panel: writes the active
// Space's gradient into --space-tint on <body> and the color name into
// data-space-tint on <html>. globalStyles.tsx then paints the gradient
// and (for non-grey colors) flips the palette to light-mode values so
// dark text reads against the pastel body.
function applyTint(color: SpaceColor | 'none') {
  const root = document.documentElement
  if (color === 'none') {
    document.body.style.removeProperty('--space-tint')
    root.removeAttribute('data-space-tint')
  } else {
    document.body.style.setProperty('--space-tint', COLOR_GRADIENT[color])
    root.setAttribute('data-space-tint', color)
  }
}

function Single({ color }: { color: SpaceColor }) {
  useEffect(() => {
    applyTint(color)
    return () => applyTint('none')
  }, [color])
  return (
    <div style={{ padding: 16, minHeight: 'calc(100vh - 24px)' }}>
      <h2 style={{ margin: 0, color: 'var(--fg)', fontSize: 14 }}>
        Space tint preview
      </h2>
      <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>
        Active color: <code>{color}</code>. <code>--space-tint</code> is
        written onto <code>&lt;body&gt;</code>; the Storybook canvas body
        renders the same way the side panel body does.
      </p>
      <div
        style={{
          marginTop: 16,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 999,
          background: 'var(--bg-soft)',
          color: 'var(--fg)',
          fontSize: 12,
          border: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: COLOR_HEX[color],
          }}
        />
        {color}
      </div>
    </div>
  )
}

const meta: Meta<typeof Single> = {
  title: 'Theme/SpaceTint',
  component: Single,
  // The default `panel` background paints the canvas body white and
  // hides the tint — disable so the tint is the only body paint.
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
  argTypes: {
    color: { control: { type: 'select' }, options: COLORS },
  },
}
export default meta

type Story = StoryObj<typeof Single>

export const Pink: Story = { args: { color: 'pink' } }
export const Blue: Story = { args: { color: 'blue' } }
export const Red: Story = { args: { color: 'red' } }
export const Green: Story = { args: { color: 'green' } }
export const Yellow: Story = { args: { color: 'yellow' } }
export const Cyan: Story = { args: { color: 'cyan' } }
export const Purple: Story = { args: { color: 'purple' } }
export const Orange: Story = { args: { color: 'orange' } }
export const Grey: Story = { args: { color: 'grey' } }

// Side-by-side swatches — useful for comparing relative tint strength
// without flipping stories. Each swatch paints the gradient locally
// (not on body) so all 9 colors are visible at once.
export const AllColors: StoryObj = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
  },
  render: () => (
    <div
      style={{
        padding: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
      }}
    >
      {COLORS.map((c) => (
        <div
          key={c}
          style={{
            padding: 14,
            minHeight: 120,
            borderRadius: 8,
            backgroundColor: 'var(--bg)',
            backgroundImage: COLOR_GRADIENT[c],
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          <span>{c}</span>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: COLOR_HEX[c],
            }}
          />
        </div>
      ))}
    </div>
  ),
}
