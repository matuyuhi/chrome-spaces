import styled from '@emotion/styled'
import { tokens } from '../theme'

// The horizontal header of a Folder: toggle, name, sync (live), more.
// Background flips when this row is the drop target for a DnD-in-flight.
export const FolderHeaderBox = styled.div<{ isDropInto?: boolean; isLive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 4px 4px;
  font-size: 11px;
  color: ${(p) => (p.isLive ? tokens.fg : tokens.subtle)};
  position: relative;
  border-radius: ${tokens.radius.sm};
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: grab;

  ${(p) => p.isDropInto && `background: ${tokens.accentSoft};`}
`

export const FolderName = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

export const LiveErrorBadge = styled.span`
  color: ${tokens.danger};
  font-size: 11px;
`
