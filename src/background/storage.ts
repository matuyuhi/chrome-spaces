import { type SpaceStore, CURRENT_SCHEMA_VERSION, emptyStore } from '../shared/types'

const STORAGE_KEY = 'spaceStore'

// Use chrome.storage.local rather than .sync — Tab Groups themselves are not
// synced across devices, so syncing the metadata gives little benefit, and
// .sync's per-minute write quota is easy to hit during rapid Space switching.
export async function loadStore(): Promise<SpaceStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY] as SpaceStore | undefined
  if (!stored) return emptyStore()
  if (stored.schemaVersion !== CURRENT_SCHEMA_VERSION) return migrate(stored)
  return stored
}

export async function saveStore(store: SpaceStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store })
}

export async function updateStore(
  mutator: (store: SpaceStore) => SpaceStore | void,
): Promise<SpaceStore> {
  const current = await loadStore()
  const next = mutator(current) ?? current
  await saveStore(next)
  return next
}

function migrate(stored: SpaceStore): SpaceStore {
  return { ...stored, schemaVersion: CURRENT_SCHEMA_VERSION }
}
