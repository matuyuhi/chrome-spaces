import styled from '@emotion/styled'
import { tokens } from '../theme'

export const NameInput = styled.input<{ small?: boolean }>`
  flex: 1;
  font: inherit;
  font-size: ${(p) => (p.small ? '12px' : '12px')};
  font-weight: ${(p) => (p.small ? 500 : 600)};
  color: inherit;
  background: ${tokens.bg};
  border: 1px solid ${tokens.accent};
  border-radius: ${tokens.radius.sm};
  padding: ${(p) => (p.small ? '1px 4px' : '2px 6px')};
  outline: none;
`
