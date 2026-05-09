import { t } from '../../../shared/i18n'
import { MenuBox, MenuDivider, MenuItem } from '../../atoms/Menu'

export function TabMenu({
  canReset,
  canPin,
  canUnpin,
  isInPinBar,
  canAddToPinBar,
  onClose,
  onPin,
  onUnpin,
  onAddToPinBar,
  onRemoveFromPinBar,
  onReset,
  onCloseTab,
}: {
  canReset: boolean
  canPin: boolean
  canUnpin: boolean
  isInPinBar: boolean
  canAddToPinBar: boolean
  onClose: () => void
  onPin: () => void
  onUnpin: () => void
  onAddToPinBar: () => void
  onRemoveFromPinBar: () => void
  onReset: () => void
  onCloseTab: () => void
}) {
  return (
    <MenuBox role="menu" onClick={(e) => e.stopPropagation()}>
      {canReset && <MenuItem onClick={onReset}>{t('tab_resetToBase')}</MenuItem>}
      {canPin && <MenuItem onClick={onPin}>{t('tab_pinToCurrentUrl')}</MenuItem>}
      {canUnpin && <MenuItem onClick={onUnpin}>{t('tab_unpin')}</MenuItem>}
      {canAddToPinBar &&
        (isInPinBar ? (
          <MenuItem onClick={onRemoveFromPinBar}>{t('tab_removeFromPinBar')}</MenuItem>
        ) : (
          <MenuItem onClick={onAddToPinBar}>{t('tab_pinUrlToBar')}</MenuItem>
        ))}
      <MenuDivider />
      <MenuItem danger onClick={onCloseTab}>
        {t('tab_closeTab')}
      </MenuItem>
      <MenuDivider />
      <MenuItem onClick={onClose}>{t('menu_close')}</MenuItem>
    </MenuBox>
  )
}
