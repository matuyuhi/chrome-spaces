import { loadStore, updateStore } from './storage'
import { type StaticSpace, TAB_GROUP_ID_NONE } from '../shared/types'

const now = (): number => Date.now()
const uid = (): string => crypto.randomUUID()

export interface ReconcileOptions {
  adoptExistingGroups?: boolean
}

export async function reconcile(options: ReconcileOptions = {}): Promise<void> {
  const groups = await chrome.tabGroups.query({})
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  await updateStore((s) => {
    for (const space of Object.values(s.spaces)) {
      if (space.groupId === TAB_GROUP_ID_NONE) continue
      if (!groupMap.has(space.groupId)) space.groupId = TAB_GROUP_ID_NONE
    }
  })

  if (!options.adoptExistingGroups) return

  const store = await loadStore()
  const claimedGroupIds = new Set(
    Object.values(store.spaces)
      .map((s) => s.groupId)
      .filter((g) => g !== TAB_GROUP_ID_NONE),
  )
  const toAdopt = groups.filter((g) => !claimedGroupIds.has(g.id))
  if (toAdopt.length === 0) return

  await updateStore((s) => {
    for (const g of toAdopt) {
      const id = uid()
      const ts = now()
      const space: StaticSpace = {
        kind: 'static',
        id,
        name: g.title || 'Untitled',
        color: g.color,
        groupId: g.id,
        windowId: g.windowId,
        order: Object.values(s.spaces).filter((sp) => sp.windowId === g.windowId).length,
        createdAt: ts,
        lastAccessedAt: ts,
      }
      s.spaces[id] = space
    }
  })
}
