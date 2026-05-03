import { type GitHubAuthMethod, type SecretStore } from '../shared/types'

const STORAGE_KEY = 'secrets'

export const DEFAULT_GITHUB_API_BASE = 'https://api.github.com'

export async function getSecrets(): Promise<SecretStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as SecretStore | undefined) ?? {}
}

export async function setSecrets(secrets: SecretStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: secrets })
}

// ---- Active token (the one Live folders actually use) ----------------

// Returns the credential to use right now. Falls back across slots
// because preferredAuth may be undefined, the preferred slot may be
// empty, or only the legacy single-slot token may exist.
export async function getGitHubToken(): Promise<string | undefined> {
  const s = await getSecrets()
  // Treat the legacy single-slot token as a PAT for fallback purposes.
  const pat = s.githubPat ?? s.githubToken
  const oauth = s.githubOauthToken
  const preferred = s.preferredAuth
  if (preferred === 'oauth') return oauth ?? pat
  if (preferred === 'pat') return pat ?? oauth
  // No explicit preference yet — prefer OAuth when present (it's the
  // newer, recommended path), otherwise fall through to PAT.
  return oauth ?? pat
}

// ---- Split slot accessors -------------------------------------------

export async function getGitHubOauthToken(): Promise<string | undefined> {
  return (await getSecrets()).githubOauthToken
}

export async function setGitHubOauthToken(token: string | undefined): Promise<void> {
  const secrets = await getSecrets()
  const trimmed = token?.trim()
  if (trimmed) {
    secrets.githubOauthToken = trimmed
    // First successful sign-in wins the default preference.
    if (!secrets.preferredAuth) secrets.preferredAuth = 'oauth'
  } else {
    delete secrets.githubOauthToken
    // If the user cleared OAuth but still has a PAT, switch the
    // preference rather than leaving a stale "use OAuth" pointer.
    if (secrets.preferredAuth === 'oauth' && secrets.githubPat) {
      secrets.preferredAuth = 'pat'
    }
  }
  await setSecrets(secrets)
}

export async function getGitHubPat(): Promise<string | undefined> {
  const s = await getSecrets()
  return s.githubPat ?? s.githubToken
}

export async function setGitHubPat(token: string | undefined): Promise<void> {
  const secrets = await getSecrets()
  const trimmed = token?.trim()
  if (trimmed) {
    secrets.githubPat = trimmed
    // Migration: once we have an explicit PAT slot, retire the legacy
    // single-slot token to avoid two sources of truth.
    delete secrets.githubToken
    if (!secrets.preferredAuth) secrets.preferredAuth = 'pat'
  } else {
    delete secrets.githubPat
    delete secrets.githubToken
    if (secrets.preferredAuth === 'pat' && secrets.githubOauthToken) {
      secrets.preferredAuth = 'oauth'
    }
  }
  await setSecrets(secrets)
}

export async function getPreferredAuth(): Promise<GitHubAuthMethod | undefined> {
  return (await getSecrets()).preferredAuth
}

export async function setPreferredAuth(
  method: GitHubAuthMethod | undefined,
): Promise<void> {
  const secrets = await getSecrets()
  if (method) secrets.preferredAuth = method
  else delete secrets.preferredAuth
  await setSecrets(secrets)
}

export function normalizeGitHubApiBaseUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  // Strip trailing slash so callers can append `/search/issues` cleanly.
  const noSlash = trimmed.replace(/\/+$/, '')
  // Reject bad URLs early; the saver will surface this to the user.
  try {
    const u = new URL(noSlash)
    if (u.protocol !== 'https:') throw new Error('https only')
  } catch {
    throw new Error(`Invalid GitHub API base URL: ${trimmed}`)
  }
  return noSlash === DEFAULT_GITHUB_API_BASE ? undefined : noSlash
}

export async function getGitHubApiBaseUrl(): Promise<string> {
  return (await getSecrets()).githubApiBaseUrl ?? DEFAULT_GITHUB_API_BASE
}

export async function setGitHubApiBaseUrl(raw: string | undefined): Promise<void> {
  const normalized = normalizeGitHubApiBaseUrl(raw)
  const secrets = await getSecrets()
  if (normalized) secrets.githubApiBaseUrl = normalized
  else delete secrets.githubApiBaseUrl
  await setSecrets(secrets)
}

export async function getGitHubClientId(): Promise<string | undefined> {
  return (await getSecrets()).githubClientId
}

export async function setGitHubClientId(id: string | undefined): Promise<void> {
  const secrets = await getSecrets()
  const trimmed = id?.trim()
  if (trimmed) secrets.githubClientId = trimmed
  else delete secrets.githubClientId
  await setSecrets(secrets)
}
