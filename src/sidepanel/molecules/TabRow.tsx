import styled from '@emotion/styled'
import { IconButton } from '../atoms/IconButton'
import { tokens } from '../theme'

// The close button is hidden by default and revealed on row hover via
// the `.close-btn` class hook below — using a static class instead of
// emotion's component selector keeps it working in Storybook's vitest
// runner (which doesn't run the babel plugin).
export const TabRowBox = styled.div<{
  isActive?: boolean
  isDragging?: boolean
  dropAbove?: boolean
  dropBelow?: boolean
}>`
  display: flex;
  align-items: center;
  border-radius: ${tokens.radius.md};
  position: relative;
  opacity: ${(p) => (p.isDragging ? 0.4 : 1)};

  &:hover {
    background: ${tokens.bgSoft};
  }

  &:hover .close-btn {
    visibility: visible;
  }

  ${(p) =>
    p.isActive &&
    `
    background: ${tokens.accentSoft};
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 4px;
      bottom: 4px;
      width: 2px;
      background: ${tokens.accent};
      border-radius: 0 2px 2px 0;
    }
  `}

  ${(p) =>
    p.dropAbove &&
    `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: -1px;
      height: 2px;
      background: ${tokens.accent};
      border-radius: 1px;
      pointer-events: none;
    }
  `}

  ${(p) =>
    p.dropBelow &&
    `
    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      background: ${tokens.accent};
      border-radius: 1px;
      pointer-events: none;
    }
  `}
`

export const TabMain = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
  min-width: 0;
`

export const Favicon = styled.img`
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 2px;
`

export const FaviconPlaceholder = styled.span`
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 2px;
  background: ${tokens.bgHover};
`

export const TabTitle = styled.span<{ active?: boolean }>`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${(p) =>
    p.active &&
    `
    color: ${tokens.accent};
    font-weight: 500;
  `}
`

export const PinDot = styled.span`
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${tokens.accent};
  margin-right: 6px;
  vertical-align: middle;
`

export const ResetButton = styled(IconButton)`
  color: ${tokens.accent};
  &:hover {
    background: ${tokens.accentSoft};
    color: ${tokens.accent};
  }
`

export const CloseButton = styled(IconButton)`
  color: ${tokens.subtle};
  visibility: hidden;

  &:hover {
    color: ${tokens.danger};
    background: rgba(207, 34, 46, 0.08);
  }
`
