import styled from '@emotion/styled'
import { tokens } from '../theme'

export const PrimaryButton = styled.button`
  font-size: 12px;
  padding: 5px 12px;
  background: ${tokens.accent};
  color: white;
  border: none;
  border-radius: ${tokens.radius.md};
  cursor: pointer;
  font-weight: 500;

  &:hover {
    filter: brightness(1.05);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

export const SecondaryButton = styled.button`
  font-size: 12px;
  padding: 5px 12px;
  background: ${tokens.bgSoft};
  color: ${tokens.fg};
  border: none;
  border-radius: ${tokens.radius.md};
  cursor: pointer;

  &:hover {
    background: ${tokens.bgHover};
  }
`

// Pill-style button used in the header (+ Space, ⚙, ⇩N).
export const PillButton = styled.button`
  background: ${tokens.bgSoft};
  border: none;
  color: ${tokens.muted};
  border-radius: ${tokens.radius.md};
  padding: 5px 8px;
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition:
    background ${tokens.duration.fast} ease,
    color ${tokens.duration.fast} ease;

  &:hover {
    background: ${tokens.bgHover};
    color: ${tokens.fg};
  }
`

export const LinkButton = styled.button`
  background: none;
  border: none;
  color: ${tokens.muted};
  cursor: pointer;
  font-size: 11px;
  padding: 0 4px;
  transition: color ${tokens.duration.fast} ease;

  &:hover {
    color: ${tokens.accent};
  }
`
