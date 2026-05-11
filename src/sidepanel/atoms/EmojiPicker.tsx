import styled from '@emotion/styled'
import { tokens } from '../theme'
import { LinkButton } from './Button'

// Curated set of emojis that cover the kinds of things people name a
// workspace after — places, tools, creatures, weather, food. The order
// is deliberately not alphabetic; visually similar glyphs are spread
// out so the grid scans quickly.
export const PRESET_EMOJIS: ReadonlyArray<string> = [
  '🏠', '🚀', '🌱', '⚡️', '🔥', '⭐', '🎯', '📝',
  '💼', '💻', '🛠️', '📚', '📌', '✏️', '🎨', '🎵',
  '🎮', '☕️', '🍕', '🐱', '🐶', '🦊', '🐢', '🦄',
  '🌈', '🌙', '☀️', '🌊', '🏝️', '🎉', '💡', '🔖',
  '📦', '🧪', '🧠', '📷',
]

const Wrap = styled.div`
  padding: 2px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
`

const Cell = styled.button<{ isCurrent?: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: ${tokens.radius.sm};
  border: 1px solid
    ${(p) => (p.isCurrent ? tokens.accent : 'transparent')};
  background: ${(p) => (p.isCurrent ? tokens.accentSoft : 'transparent')};
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background ${tokens.duration.fast} ease,
    transform ${tokens.duration.fast} ease;

  &:hover {
    background: ${tokens.bgHover};
    transform: scale(1.1);
  }
`

const ClearRow = styled.div`
  display: flex;
  justify-content: flex-end;
`

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (emoji: string | undefined) => void
}) {
  return (
    <Wrap>
      <Grid>
        {PRESET_EMOJIS.map((e) => (
          <Cell
            key={e}
            isCurrent={value === e}
            onClick={() => onChange(value === e ? undefined : e)}
            aria-label={`Select ${e}`}
            aria-pressed={value === e}
          >
            {e}
          </Cell>
        ))}
      </Grid>
      {value && (
        <ClearRow>
          <LinkButton onClick={() => onChange(undefined)}>Clear</LinkButton>
        </ClearRow>
      )}
    </Wrap>
  )
}
