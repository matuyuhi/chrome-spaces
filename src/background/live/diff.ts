import { type ManagedTab } from '../../shared/types'
import { type ItemRef } from './sources/github'

export interface DiffResult {
  toAdd: ItemRef[]
  toRemove: ManagedTab[]
  toKeep: { managed: ManagedTab; fetched: ItemRef }[]
}

export function diff(currentTabs: ManagedTab[], fetchedItems: ItemRef[]): DiffResult {
  const currentByExt = new Map(currentTabs.map((t) => [t.externalId, t]))
  const fetchedByExt = new Map(fetchedItems.map((i) => [i.externalId, i]))

  const toAdd: ItemRef[] = []
  const toKeep: { managed: ManagedTab; fetched: ItemRef }[] = []
  for (const item of fetchedItems) {
    const existing = currentByExt.get(item.externalId)
    if (existing) toKeep.push({ managed: existing, fetched: item })
    else toAdd.push(item)
  }

  const toRemove = currentTabs.filter((t) => !fetchedByExt.has(t.externalId))
  return { toAdd, toRemove, toKeep }
}
