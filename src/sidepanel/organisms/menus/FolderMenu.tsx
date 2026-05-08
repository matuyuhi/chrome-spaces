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
      <MenuItem onClick={onRename}>Rename</MenuItem>
      {isLive && <MenuItem onClick={onEditLive}>Edit live config</MenuItem>}
      {!isLive && (
        <>
          <MenuItem onClick={onAddFolder}>+ Folder</MenuItem>
          <MenuItem onClick={onAddLive}>+ Live folder</MenuItem>
        </>
      )}
      <MenuSection>Icon</MenuSection>
      <EmojiInput initial={folder.emoji} onChange={onEmoji} />
      <MenuDivider />
      <MenuItem danger onClick={() => onDelete(false)}>
        Delete (keep tabs)
      </MenuItem>
      <MenuItem danger onClick={() => onDelete(true)}>
        Delete + close tabs
      </MenuItem>
      <MenuDivider />
      <MenuItem onClick={onClose}>Close menu</MenuItem>
    </MenuBox>
  )
}
