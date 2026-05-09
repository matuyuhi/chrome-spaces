import { t } from '../../../shared/i18n'
import { type Folder } from '../../../shared/types'
import { EmojiInput } from '../../atoms/EmojiInput'
import { MenuBox, MenuDivider, MenuItem, MenuSection } from '../../atoms/Menu'

export function FolderMenu({
  folder,
  onClose,
  onRename,
  onEmoji,
  onEditLive,
  onAddFolder,
  onAddLive,
  onDelete,
}: {
  folder: Folder
  onClose: () => void
  onRename: () => void
  onEmoji: (emoji: string | undefined) => void
  onEditLive: () => void
  onAddFolder: () => void
  onAddLive: () => void
  onDelete: (closeTabs: boolean) => void
}) {
  const isLive = !!folder.live
  return (
    <MenuBox role="menu" onClick={(e) => e.stopPropagation()}>
      <MenuItem onClick={onRename}>{t('menu_rename')}</MenuItem>
      {isLive && <MenuItem onClick={onEditLive}>{t('menu_editLiveConfig')}</MenuItem>}
      {!isLive && (
        <>
          <MenuItem onClick={onAddFolder}>{t('menu_addFolder')}</MenuItem>
          <MenuItem onClick={onAddLive}>{t('menu_addLiveFolder')}</MenuItem>
        </>
      )}
      <MenuSection>{t('menu_icon')}</MenuSection>
      <EmojiInput initial={folder.emoji} onChange={onEmoji} />
      <MenuDivider />
      <MenuItem danger onClick={() => onDelete(false)}>
        {t('menu_delete_keepTabs')}
      </MenuItem>
      <MenuItem danger onClick={() => onDelete(true)}>
        {t('menu_delete_closeTabs')}
      </MenuItem>
      <MenuDivider />
      <MenuItem onClick={onClose}>{t('menu_close')}</MenuItem>
    </MenuBox>
  )
}
