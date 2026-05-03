import styled from '@emotion/styled'
import { tokens } from '../theme'

// Form field wrapper used by LiveFolderForm. Label + input/select stacked.
export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: ${tokens.muted};

  input,
  select {
    background: ${tokens.bg};
    color: ${tokens.fg};
    border: 1px solid ${tokens.border};
    border-radius: ${tokens.radius.md};
    padding: 6px 8px;
    font: inherit;
    font-size: 13px;
    outline: none;
    transition: border-color ${tokens.duration.fast} ease;
  }

  input:focus,
  select:focus {
    border-color: ${tokens.accent};
  }
`
