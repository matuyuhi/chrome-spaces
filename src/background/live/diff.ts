import { type ManagedTab } from '../../shared/types'
import { type LiveItem } from './sources/types'

export interface DiffResult {
  toAdd: LiveItem[]
  toRemove: ManagedTab[]
  toKeep: { managed: ManagedTab; fetched: LiveItem }[]
}

export function diff(currentTabs: ManagedTab[], fetchedItems: LiveItem[]): DiffResult {
  const currentByExt = new Map(currentTabs.map((t) => [t.externalId, t]))
  const fetchedByExt = new Map(fetchedItems.map((i) => [i.externalId, i]))

  const toAdd: LiveItem[] = []
  const toKeep: { managed: ManagedTab; fetched: LiveItem }[] = []
  for (const item of fetchedItems) {
    const existing = currentByExt.get(item.externalId)
    if (existing) toKeep.push({ managed: existing, fetched: item })
    else toAdd.push(item)
  }

  const toRemove = currentTabs.filter((t) => !fetchedByExt.has(t.externalId))
  return { toAdd, toRemove, toKeep }
}
