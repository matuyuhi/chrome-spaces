import styled from '@emotion/styled'
import { tokens } from '../theme'
import { LinkButton } from '../atoms/Button'

export const PageHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid ${tokens.border};
  margin-bottom: 8px;
`

export const BackBtn = styled(LinkButton)`
  font-size: 13px;
  color: ${tokens.muted};
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  &:hover {
    color: ${tokens.accent};
  }
`

export const PageTitle = styled.h1`
  margin: 0;
  flex: 1;
  font-size: 24px;
  font-weight: 600;
  color: ${tokens.fg};
`

export const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const Card = styled.section`
  background: ${tokens.bgSoft};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.lg};
  padding: 0 24px;
  overflow: hidden;
`

export const CardHeading = styled.h2`
  margin: 0 0 0 0;
  padding: 16px 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: ${tokens.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid ${tokens.border};
`

export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;

  &.last-row {
    /* no border on the final row */
  }

  &:not(.last-row) {
    border-bottom: 1px solid ${tokens.border};
  }
`

export const RowLabel = styled.div`
  flex: 1;
  min-width: 0;
`

export const RowTitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${tokens.fg};
  font-weight: 500;
`

export const RowDesc = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  color: ${tokens.muted};
  line-height: 1.5;

  code {
    background: ${tokens.bgHover};
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  a {
    color: ${tokens.accent};
  }
`

export const RowControl = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

export const RowFull = styled.div`
  padding: 16px 0;

  &:not(.last-row) {
    border-bottom: 1px solid ${tokens.border};
  }
`

export const RowFullTitle = styled.p`
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: ${tokens.fg};
`

export const RowFullDesc = styled.p`
  margin: 0 0 12px;
  font-size: 12px;
  color: ${tokens.muted};
  line-height: 1.5;

  code {
    background: ${tokens.bgHover};
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  a {
    color: ${tokens.accent};
  }

  strong {
    color: ${tokens.fg};
  }
`

export const SizePicker = styled.div`
  display: flex;
  gap: 4px;
  background: ${tokens.bgHover};
  border-radius: ${tokens.radius.md};
  padding: 3px;
`

export const SizeBtn = styled.button<{ isCurrent?: boolean }>`
  flex: 1;
  background: ${(p) => (p.isCurrent ? tokens.bg : 'transparent')};
  color: ${(p) => (p.isCurrent ? tokens.accent : tokens.muted)};
  border: none;
  border-radius: ${tokens.radius.sm};
  padding: 6px 0;
  cursor: pointer;
  font-weight: ${(p) => (p.isCurrent ? '600' : '400')};
  font-size: 12px;
  transition:
    background ${tokens.duration.fast} ease,
    color ${tokens.duration.fast} ease;
  box-shadow: ${(p) =>
    p.isCurrent ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'};

  &:hover {
    color: ${tokens.fg};
    background: ${(p) => (p.isCurrent ? tokens.bg : tokens.bgSoft)};
  }
`

export const TextInput = styled.input`
  background: ${tokens.bg};
  color: ${tokens.fg};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.md};
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color ${tokens.duration.fast} ease;
  width: 100%;

  &:focus {
    border-color: ${tokens.accent};
  }
`

export const NumberInput = styled.input`
  background: ${tokens.bg};
  color: ${tokens.fg};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.md};
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
  width: 80px;
  text-align: center;
  transition: border-color ${tokens.duration.fast} ease;

  &:focus {
    border-color: ${tokens.accent};
  }
`

export const StatusBadge = styled.span<{ ok?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${(p) => (p.ok ? tokens.accent : tokens.muted)};
`

export const DeviceCodeBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${tokens.bg};
  border: 1px solid ${tokens.accent};
  border-radius: ${tokens.radius.md};
  padding: 14px;
  margin-top: 8px;
`

export const DeviceCodeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

export const DeviceCode = styled.div`
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: ${tokens.fg};
  text-align: center;
  padding: 8px 0;
  background: ${tokens.bgSoft};
  border-radius: ${tokens.radius.sm};
  user-select: all;
`

export const InlineActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
`

export const MutedText = styled.span`
  font-size: 12px;
  color: ${tokens.muted};
`

export const ErrorText = styled.p`
  margin: 6px 0 0;
  font-size: 12px;
  color: ${tokens.danger};
`

export const RadioGroup = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`

export const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${tokens.fg};
  cursor: pointer;
`

export const AdvancedDetails = styled.details`
  margin-top: 12px;

  summary {
    font-size: 12px;
    color: ${tokens.muted};
    cursor: pointer;
    user-select: none;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      content: '▶ ';
      font-size: 10px;
    }
  }

  &[open] summary::before {
    content: '▼ ';
  }
`

export const AdvancedBody = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`
