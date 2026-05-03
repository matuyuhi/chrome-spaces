import { type UIPreferences, DEFAULT_UI_PREFS } from '../shared/messaging'

const KEY = 'uiPrefs'

export async function getUIPrefs(): Promise<UIPreferences> {
  const result = await chrome.storage.local.get(KEY)
  const stored = result[KEY] as Partial<UIPreferences> | undefined
  return { ...DEFAULT_UI_PREFS, ...stored }
}

export async function setUIPrefs(patch: Partial<UIPreferences>): Promise<void> {
  const current = await getUIPrefs()
  await chrome.storage.local.set({ [KEY]: { ...current, ...patch } })
}
