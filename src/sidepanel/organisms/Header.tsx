import styled from '@emotion/styled'
import { plural, t } from '../../shared/i18n'
import { tokens } from '../theme'
import { PillButton } from '../atoms/Button'
import { Download, Plus, Settings as SettingsIcon } from '../atoms/icons'

const Bar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 24px;

  h1 {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin: 0;
    flex: 1;
    color: ${tokens.subtle};
    text-transform: uppercase;
  }
`

const Actions = styled.div`
  display: flex;
  gap: 4px;
`

const Count = styled.span`
  font-size: 11px;
  font-weight: 600;
`

interface Props {
  tabGroupCount: number
  onImportTabGroups: () => void
  onNewSpace: () => void
  onOpenSettings: () => void
}

export function PanelHeader({
  tabGroupCount,
  onImportTabGroups,
  onNewSpace,
  onOpenSettings,
}: Props) {
  const newSpaceLabel = t('header_newSpace')
  const settingsLabel = t('header_settings')
  return (
    <Bar>
      <h1>{t('header_title')}</h1>
      <Actions>
        {tabGroupCount > 0 && (
          <PillButton
            title={plural(
              tabGroupCount,
              'header_convertGroups_one',
              'header_convertGroups_other',
              tabGroupCount,
            )}
            onClick={onImportTabGroups}
          >
            <Download size={14} />
            <Count>{tabGroupCount}</Count>
          </PillButton>
        )}
        <PillButton title={newSpaceLabel} aria-label={newSpaceLabel} onClick={onNewSpace}>
          <Plus size={14} />
        </PillButton>
        <PillButton
          title={settingsLabel}
          aria-label={settingsLabel}
          onClick={onOpenSettings}
        >
          <SettingsIcon size={14} />
        </PillButton>
      </Actions>
    </Bar>
  )
}
