import styled from '@emotion/styled'
import { type Space, type SpaceColor } from '../../../shared/types'
import { COLORS, COLOR_HEX, tokens } from '../../theme'
import { EmojiInput } from '../../atoms/EmojiInput'
import { MenuBox, MenuDivider, MenuItem, MenuSection } from '../../atoms/Menu'

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 4px;
  padding: 2px 10px 6px;
`

const Swatch = styled.button<{ color: string; isCurrent?: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid ${(p) => (p.isCurrent ? tokens.fg : 'transparent')};
  background: ${(p) => p.color};
  padding: 0;
  cursor: pointer;
  transition: transform ${tokens.duration.fast} ease;

  &:hover {
    transform: scale(1.15);
  }
`

export function SpaceMenu({
  space,
  onClose,
  onRename,
  onColor,
  onEmoji,
  onDelete,
}: {
  space: Space
  onClose: () => void
  onRename: () => void
  onColor: (color: SpaceColor) => void
  onEmoji: (emoji: string | undefined) => void
  onDelete: (closeTabs: boolean) => void
}) {
  return (
    <MenuBox role="menu" onClick={(e) => e.stopPropagation()}>
      <MenuItem onClick={onRename}>Rename</MenuItem>
      <MenuSection>Icon</MenuSection>
      <EmojiInput initial={space.emoji} onChange={onEmoji} />
      <MenuSection>Color</MenuSection>
      <ColorGrid>
        {COLORS.map((c) => (
          <Swatch
            key={c}
            color={COLOR_HEX[c]}
            isCurrent={c === space.color}
            onClick={() => onColor(c)}
            aria-label={`Color ${c}`}
          />
        ))}
      </ColorGrid>
      <MenuDivider />
      <MenuItem danger onClick={() => onDelete(false)}>
        Delete (keep tabs)
      </MenuItem>
      <MenuItem danger onClick={() => onDelete(true)}>
        Delete + close tabs
      </MenuItem>
      <MenuDivider />
      <MenuItem onClick={onClose}>Close menu</MenuItem>
    </MenuBox>
  )
}
