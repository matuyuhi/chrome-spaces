import styled from '@emotion/styled'
import { tokens } from '../theme'

export const MenuBox = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background: ${tokens.bg};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.lg};
  padding: 4px;
  min-width: 200px;
  z-index: 10;
  box-shadow: ${tokens.shadow};
  display: flex;
  flex-direction: column;

  /* Pill menu in App alignment hooks: parent wrappers add classes
     menu-align-left / menu-align-right to flip the anchor. */
  .menu-align-left > & {
    right: auto;
    left: 0;
  }
  .menu-align-right > & {
    right: 0;
    left: auto;
  }
`

export const MenuItem = styled.button<{ danger?: boolean }>`
  background: none;
  border: none;
  color: ${(p) => (p.danger ? tokens.danger : 'inherit')};
  text-align: left;
  padding: 6px 10px;
  border-radius: ${tokens.radius.md};
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background: ${(p) =>
      p.danger ? 'rgba(207, 34, 46, 0.08)' : tokens.bgSoft};
  }
`

export const MenuSection = styled.div`
  font-size: 10px;
  color: ${tokens.subtle};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 10px 4px;
  font-weight: 600;
`

export const MenuDivider = styled.div`
  height: 1px;
  background: ${tokens.border};
  margin: 4px 0;
`
