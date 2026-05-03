import styled from '@emotion/styled'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type SpaceStore } from '../../shared/types'
import { useAppCtx } from '../AppContext'
import { type TabInfo } from '../dnd'
import { tokens } from '../theme'

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 48px;
`

const Panel = styled.div`
  width: min(560px, calc(100vw - 24px));
  max-height: 70vh;
  background: ${tokens.bgSoft};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.lg};
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const Search = styled.input`
  border: none;
  outline: none;
  background: transparent;
  color: ${tokens.fg};
  font: inherit;
  padding: 14px 16px;
  font-size: 15px;
  border-bottom: 1px solid ${tokens.border};
`

const Results = styled.ul`
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
`

const Row = styled.li<{ selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  cursor: pointer;
  background: ${(p) => (p.selected ? tokens.bgHover : 'transparent')};
  color: ${tokens.fg};

  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }
  .meta {
    font-size: 11px;
    color: ${tokens.muted};
    white-space: nowrap;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  img {
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
  }
`

const Empty = styled.div`
  padding: 20px;
  text-align: center;
  color: ${tokens.muted};
  font-size: 12px;
`

interface Hit {
  tabId: number
  tab: TabInfo
  spaceId?: string
  spaceName?: string
}

function buildIndex(store: SpaceStore, tabs: Record<number, TabInfo>, windowId: number): Hit[] {
  // Map tabId → owning Space (within this window). A tab can only belong
  // to one Space's tree because moveItem enforces single-ownership.
  const ownerByTab = new Map<number, { id: string; name: string }>()
  for (const space of Object.values(store.spaces)) {
    if (space.windowId !== windowId) continue
    const seen = new Set<string>()
    const stack = [space.rootFolderId]
    while (stack.length) {
      const fid = stack.pop()!
      if (seen.has(fid)) continue
      seen.add(fid)
      const f = store.folders[fid]
      if (!f) continue
      for (const it of f.items) {
        if (it.kind === 'folder') stack.push(it.folderId)
        else ownerByTab.set(it.tabId, { id: space.id, name: space.name })
      }
    }
  }
  const hits: Hit[] = []
  for (const tab of Object.values(tabs)) {
    const owner = ownerByTab.get(tab.id)
    hits.push({
      tabId: tab.id,
      tab,
      spaceId: owner?.id,
      spaceName: owner?.name,
    })
  }
  return hits
}

function score(hit: Hit, q: string): number {
  if (!q) return 1
  const ql = q.toLowerCase()
  const t = hit.tab.title.toLowerCase()
  const u = hit.tab.url.toLowerCase()
  const titleHit = t.indexOf(ql)
  const urlHit = u.indexOf(ql)
  if (titleHit === -1 && urlHit === -1) return 0
  // Earlier matches rank higher; title beats URL.
  if (titleHit !== -1) return 1000 - titleHit
  return 500 - urlHit
}

export function CommandBar({ onClose }: { onClose: () => void }) {
  const { store, tabs, windowId, refresh, onError } = useAppCtx()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const hits = useMemo(() => {
    const all = buildIndex(store, tabs, windowId)
    const ranked = all
      .map((h) => ({ h, s: score(h, query.trim()) }))
      .filter((p) => p.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((p) => p.h)
    return ranked.slice(0, 50)
  }, [store, tabs, windowId, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLLIElement>(
      `li[data-idx="${selected}"]`,
    )
    row?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const activate = async (hit: Hit) => {
    try {
      const activeId = store.activeSpaceByWindow[windowId]
      if (hit.spaceId && hit.spaceId !== activeId) {
        await sendMessage({ type: 'switchTo', spaceId: hit.spaceId, windowId })
      }
      await sendMessage({ type: 'activateTab', tabId: hit.tabId })
      onClose()
      void refresh()
    } catch (e) {
      onError(e)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, Math.max(0, hits.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = hits[selected]
      if (hit) void activate(hit)
    }
  }

  return (
    <Backdrop onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Panel onKeyDown={onKey}>
        <Search
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tabs across spaces…"
        />
        {hits.length === 0 ? (
          <Empty>{query ? 'No matches.' : 'No tabs yet.'}</Empty>
        ) : (
          <Results ref={listRef}>
            {hits.map((hit, idx) => (
              <Row
                key={hit.tabId}
                data-idx={idx}
                selected={idx === selected}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => void activate(hit)}
              >
                {hit.tab.favIconUrl ? (
                  <img src={hit.tab.favIconUrl} alt="" />
                ) : (
                  <span style={{ width: 14 }} />
                )}
                <span className="title">{hit.tab.title || hit.tab.url}</span>
                <span className="meta">{hit.spaceName ?? '— unfiled'}</span>
              </Row>
            ))}
          </Results>
        )}
      </Panel>
    </Backdrop>
  )
}
