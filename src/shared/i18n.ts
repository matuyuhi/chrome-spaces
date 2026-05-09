import enMessages from '../../public/_locales/en/messages.json'

type MessageEntry = { message: string; description?: string }
type MessagesJson = Record<string, MessageEntry>

export type MessageKey = keyof typeof enMessages

const fallbackMessages = enMessages as MessagesJson

interface ChromeI18n {
  getMessage?: (key: string, substitutions?: string | string[]) => string
}

function getApi(): ChromeI18n | undefined {
  return (globalThis as { chrome?: { i18n?: ChromeI18n } }).chrome?.i18n
}

// Exported so that the Vitest / Storybook chrome.i18n.getMessage stubs can
// share the exact same substitution semantics as the runtime fallback.
export function applyI18nSubs(
  template: string,
  substitutions?: string | string[],
): string {
  if (substitutions === undefined) return template
  const list = Array.isArray(substitutions) ? substitutions : [substitutions]
  return template.replace(/\$(\d)/g, (_, idx: string) => {
    const i = Number(idx) - 1
    return i >= 0 && i < list.length ? list[i] : ''
  })
}

export function t(
  key: MessageKey,
  substitutions?: string | string[] | number | number[],
): string {
  const subs =
    substitutions === undefined
      ? undefined
      : Array.isArray(substitutions)
        ? substitutions.map(String)
        : String(substitutions)
  const api = getApi()
  if (api?.getMessage) {
    const msg = api.getMessage(key, subs)
    // chrome.i18n.getMessage returns '' for unknown keys; use the bundled
    // EN fallback in that case. A legitimately empty translation would
    // also fall through here, but messages.json has no empty entries.
    if (msg !== '') return msg
  }
  const entry = fallbackMessages[key]
  if (!entry) return key
  return applyI18nSubs(entry.message, subs)
}

export function plural(
  count: number,
  singularKey: MessageKey,
  otherKey: MessageKey,
  substitutions?: string | string[] | number | number[],
): string {
  // Default the substitution to `count` so callers don't have to repeat it
  // in the common `$1` placeholder case.
  return t(count === 1 ? singularKey : otherKey, substitutions ?? count)
}
