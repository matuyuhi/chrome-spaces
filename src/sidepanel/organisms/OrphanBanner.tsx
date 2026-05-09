import styled from '@emotion/styled'
import { plural, t } from '../../shared/i18n'
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
      <Count>{plural(count, 'orphan_count_one', 'orphan_count_other', count)}</Count>
      {spaceName && (
        <LinkButton
          title={plural(
            count,
            'orphan_addToCurrent_title_one',
            'orphan_addToCurrent_title_other',
            [String(count), spaceName],
          )}
          onClick={onAddToCurrent}
        >
          {t('orphan_addToCurrent')}
        </LinkButton>
      )}
      <LinkButton
        title={plural(
          count,
          'orphan_createNewSpace_title_one',
          'orphan_createNewSpace_title_other',
          count,
        )}
        onClick={onCreateNewSpace}
      >
        {t('orphan_createNewSpace')}
      </LinkButton>
    </Box>
  )
}
