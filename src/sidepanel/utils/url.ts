// Normalize a URL for matching against another URL. Strips the fragment
// and a single trailing slash on non-root paths, so "/foo" and "/foo/"
// collapse and "#hash" doesn't break equality. Used by PinnedBar (active
// indicator) and ItemRow (hide rows already represented in the pin bar).
// Mirrors the bg-side normalization.
export function normalizeUrlForMatching(raw: string): string {
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
