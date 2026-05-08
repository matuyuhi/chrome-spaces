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
      {canReset && <MenuItem onClick={onReset}>Reset to base URL</MenuItem>}
      {canPin && <MenuItem onClick={onPin}>Pin to current URL</MenuItem>}
      {canUnpin && <MenuItem onClick={onUnpin}>Unpin</MenuItem>}
      {canAddToPinBar &&
        (isInPinBar ? (
          <MenuItem onClick={onRemoveFromPinBar}>Remove from pin bar</MenuItem>
        ) : (
          <MenuItem onClick={onAddToPinBar}>Pin URL to bar</MenuItem>
        ))}
      <MenuDivider />
      <MenuItem danger onClick={onCloseTab}>
        Close tab
      </MenuItem>
      <MenuDivider />
      <MenuItem onClick={onClose}>Close menu</MenuItem>
    </MenuBox>
  )
}
