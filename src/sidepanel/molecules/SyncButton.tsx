import styled from '@emotion/styled'
import { IconButton } from '../atoms/IconButton'
import { RefreshCw } from '../atoms/icons'
import { tokens } from '../theme'

const Btn = styled(IconButton)<{ syncing?: boolean }>`
  &:hover {
    color: ${tokens.accent};
  }

  ${(p) =>
    p.syncing &&
    `
    color: ${tokens.accent};
    & .spin {
      animation: sync-spin 0.7s linear infinite;
      transform-origin: center;
    }
  `}

  @keyframes sync-spin {
    from { transform: rotate(0); }
    to { transform: rotate(360deg); }
  }
`

export function SyncButton({
  syncing,
  onClick,
  title,
}: {
  syncing: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <Btn syncing={syncing} disabled={syncing} onClick={onClick} title={title} aria-label="Sync">
      <RefreshCw size={12} className="spin" />
    </Btn>
  )
}
