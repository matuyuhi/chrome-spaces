import styled from '@emotion/styled'
import { tokens } from '../theme'

// Bare icon-only button. Default neutral; variants on the wrapper class
// (.is-syncing for the spinning sync, .danger for red hover, etc.).
export const IconButton = styled.button`
  background: none;
  border: none;
  color: ${tokens.muted};
  cursor: pointer;
  padding: 4px;
  border-radius: ${tokens.radius.sm};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background ${tokens.duration.fast} ease,
    color ${tokens.duration.fast} ease,
    transform 60ms ease;

  &:hover {
    color: ${tokens.fg};
    background: ${tokens.bgHover};
  }

  &:active {
    transform: scale(0.92);
  }

  &:disabled {
    cursor: progress;
  }
`
