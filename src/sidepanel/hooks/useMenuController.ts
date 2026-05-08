import { useEffect, useState } from 'react'

export interface MenuController {
  openMenu: string | undefined
  setOpenMenu: (id: string | undefined) => void
}

// Document-level outside-click closes the currently open menu. Listener is
// attached on the next tick so the click that opened the menu doesn't
// immediately close it. Clicks inside [role="menu"] are ignored.
export function useMenuController(): MenuController {
  const [openMenu, setOpenMenu] = useState<string | undefined>()

  useEffect(() => {
    if (!openMenu) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest('[role="menu"]')) return
      setOpenMenu(undefined)
    }
    const t = window.setTimeout(
      () => document.addEventListener('click', onDocClick),
      0,
    )
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', onDocClick)
    }
  }, [openMenu])

  return { openMenu, setOpenMenu }
}
