import styled from '@emotion/styled'
import { tokens } from '../theme'
import { LinkButton } from '../atoms/Button'

const Box = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 11px;
  background: ${tokens.accentSoft};
  border-radius: ${tokens.radius.md};
  flex-wrap: wrap;
`

const Count = styled.span`
  color: ${tokens.accent};
  flex: 1;
  font-weight: 500;
`

interface Props {
  count: number
  spaceName?: string
  onAddToCurrent: () => void
  onCreateNewSpace: () => void
}

export function OrphanBanner({
  count,
  spaceName,
  onAddToCurrent,
  onCreateNewSpace,
}: Props) {
  if (count === 0) return null
  return (
    <Box>
      <Count>
        {count} tab{count === 1 ? '' : 's'} not in any Space
      </Count>
      {spaceName && (
        <LinkButton
          title={`Add ${count} tab(s) to "${spaceName}"`}
          onClick={onAddToCurrent}
        >
          → current Space
        </LinkButton>
      )}
      <LinkButton
        title={`Create a new Space holding these ${count} tab(s)`}
        onClick={onCreateNewSpace}
      >
        → new Space
      </LinkButton>
    </Box>
  )
}
