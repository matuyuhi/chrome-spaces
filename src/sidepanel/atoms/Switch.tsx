import styled from '@emotion/styled'
import { tokens } from '../theme'

const Track = styled.span<{ checked: boolean }>`
  display: inline-flex;
  align-items: center;
  width: 36px;
  height: 20px;
  border-radius: ${tokens.radius.pill};
  background: ${(p) => (p.checked ? tokens.accent : tokens.border)};
  flex-shrink: 0;
  position: relative;
  transition: background ${tokens.duration.medium} ease;
  cursor: pointer;
`

const Thumb = styled.span<{ checked: boolean }>`
  position: absolute;
  left: ${(p) => (p.checked ? '18px' : '2px')};
  width: 16px;
  height: 16px;
  border-radius: ${tokens.radius.pill};
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition:
    left ${tokens.duration.medium} ease,
    box-shadow ${tokens.duration.fast} ease;

  ${Track}:hover & {
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
`

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  id?: string
}

export function Switch({ checked, onChange, id }: SwitchProps) {
  return (
    <Track
      checked={checked}
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      tabIndex={0}
    >
      <Thumb checked={checked} />
    </Track>
  )
}
