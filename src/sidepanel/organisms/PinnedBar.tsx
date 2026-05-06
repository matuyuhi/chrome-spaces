import styled from '@emotion/styled'
import { useMemo, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type PinnedUrl, type SpaceId } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { tokens } from '../theme'
import { PinnedBlock } from '../atoms/PinnedBlock'
import { MenuBox, MenuItem } from '../atoms/Menu'

// Match the bg-side normalization (strip fragment + a single trailing
// slash on the path) so "/foo" and "/foo/" collapse, and so the active
// tab indicator highlights when the user is currently on a pinned URL.
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const u = new URL(trimmed)
    u.hash = ''
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return trimmed
  }
}

// ---- styles ---------------------------------------------------------------

// Pin entry / removal happens via TabMenu now ("Pin URL to bar" /
// "Remove from pin bar"), so the bar no longer doubles as a drop target.
// Earlier attempts to use the bar as a DnD landing zone broke the HTML5
// drag whenever its layout changed mid-drag — the menu-driven path
// dodges that entire class of problem.
const Bar = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 4px;
  min-height: 36px;
  border-radius: ${tokens.radius.md};
  background: transparent;
  margin-bottom: 4px;
  position: relative;
`

// Absolutely-positioned wrapper so the PinnedMenu can be relative to the
// block without fighting Bar's flex layout.
const BlockWrap = styled.div`
  position: relative;
`

// ---- PinnedMenu -----------------------------------------------------------

function PinnedMenu({
  anchor,
  onUnpin,
  onClose,
}: {
  anchor: 'left' | 'right'
  onUnpin: () => void
  onClose: () => void
}) {
  // The default MenuBox anchors right:0; pinned blocks live near the
  // left edge so the menu would clip off the left side. Caller picks
  // 'left' or 'right' based on which side has room in the panel.
  const positionStyle =
    anchor === 'left'
      ? { top: '100%', left: 0, right: 'auto' as const }
      : { top: '100%', right: 0, left: 'auto' as const }
  return (
    <MenuBox
      role="menu"
      style={{ ...positionStyle, minWidth: 120 }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem onClick={onUnpin}>Unpin</MenuItem>
      <MenuItem onClick={onClose}>Cancel</MenuItem>
    </MenuBox>
  )
}

// ---- PinnedBar ------------------------------------------------------------

export function PinnedBar({
  spaceId,
  pinnedUrls,
}: {
  spaceId: SpaceId
  pinnedUrls: PinnedUrl[] | undefined
}) {
  const ctx = useAppCtx()
  const pins = pinnedUrls ?? []
  // Per-block anchor decided when its menu opens — flips between left
  // and right based on which side has room in the side panel viewport.
  const [menuAnchors, setMenuAnchors] = useState<Record<string, 'left' | 'right'>>(
    {},
  )

  // Set of normalized URLs currently open as visible tabs in this window.
  // Used to mark each PinnedBlock as "active" when the user is on it.
  const openUrlSet = useMemo(() => {
    const set = new Set<string>()
    for (const t of Object.values(ctx.tabs)) {
      if (t.hidden) continue
      if (t.url) set.add(normalizeUrl(t.url))
    }
    return set
  }, [ctx.tabs])

  // Hide entirely when nothing is pinned. Safe to unmount because there
  // is no DnD interaction with this bar — pinning happens via TabMenu.
  if (pins.length === 0) return null

  const handleClickPin = async (pin: PinnedUrl) => {
    // 1. Try to find an existing tab with a normalized-URL match. Falls
    //    back through trailing slash / fragment differences.
    const target = normalizeUrl(pin.url)
    const existingTab = Object.values(ctx.tabs).find(
      (t) => t.url && normalizeUrl(t.url) === target,
    )
    if (existingTab) {
      try {
        await sendMessage({ type: 'activateTab', tabId: existingTab.id })
      } catch (e) {
        ctx.onError(e)
      }
      return
    }

    // 2. Open a new tab
    try {
      await chrome.tabs.create({ url: pin.url, windowId: ctx.windowId, active: true })
      await ctx.refresh()
    } catch (e) {
      ctx.onError(e)
    }
  }

  const handleUnpin = async (pin: PinnedUrl) => {
    // Close the menu optimistically so the UI feels instant; refresh
    // catches up with the actual store after the round-trip.
    ctx.setOpenMenu(undefined)
    try {
      // Pinning closed the source tab, so unpinning should bring it
      // back into the Space — unless the URL is already open (e.g. the
      // user clicked the pin earlier). Skip the recreate in that case
      // to avoid duplicates. registerTab will append the new tab to
      // the active Space's root folder.
      const target = normalizeUrl(pin.url)
      const existingTab = Object.values(ctx.tabs).find(
        (t) => !t.hidden && t.url && normalizeUrl(t.url) === target,
      )
      if (!existingTab) {
        await chrome.tabs.create({
          url: pin.url,
          windowId: ctx.windowId,
          active: false,
        })
      }
      await sendMessage({ type: 'unpinUrl', spaceId, pinnedId: pin.id })
      await ctx.refresh()
    } catch (e) {
      ctx.onError(e)
    }
  }

  return (
    <Bar>
      {pins.map((pin) => {
        const menuId = `pinned:${pin.id}`
        const isActive = openUrlSet.has(normalizeUrl(pin.url))
        return (
          <BlockWrap key={pin.id}>
            <PinnedBlock
              url={pin.url}
              title={pin.title}
              favIconUrl={pin.favIconUrl}
              isActive={isActive}
              onClick={() => void handleClickPin(pin)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (ctx.openMenu !== menuId) {
                  // Decide which side to anchor the menu on based on
                  // available room. Estimate the menu at 140px (minWidth
                  // 120 + a small buffer for items / padding).
                  const rect = e.currentTarget.getBoundingClientRect()
                  const MENU_WIDTH = 140
                  const MARGIN = 8
                  const fitsLeftAnchor =
                    rect.left + MENU_WIDTH <= window.innerWidth - MARGIN
                  setMenuAnchors((prev) => ({
                    ...prev,
                    [pin.id]: fitsLeftAnchor ? 'left' : 'right',
                  }))
                }
                ctx.setOpenMenu(ctx.openMenu === menuId ? undefined : menuId)
              }}
              aria-label={pin.title ?? pin.url}
            />
            {ctx.openMenu === menuId && (
              <PinnedMenu
                anchor={menuAnchors[pin.id] ?? 'left'}
                onUnpin={() => void handleUnpin(pin)}
                onClose={() => ctx.setOpenMenu(undefined)}
              />
            )}
          </BlockWrap>
        )
      })}
    </Bar>
  )
}
