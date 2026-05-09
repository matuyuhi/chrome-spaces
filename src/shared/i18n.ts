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

function applySubstitutions(
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
    if (msg) return msg
  }
  const entry = fallbackMessages[key]
  if (!entry) return key
  return applySubstitutions(entry.message, subs)
}

export function plural(
  count: number,
  singularKey: MessageKey,
  otherKey: MessageKey,
  substitutions?: string | string[] | number | number[],
): string {
  return t(count === 1 ? singularKey : otherKey, substitutions)
}
