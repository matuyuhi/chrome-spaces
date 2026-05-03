import { type SecretStore } from '../shared/types'

const STORAGE_KEY = 'secrets'

export const DEFAULT_GITHUB_API_BASE = 'https://api.github.com'

export async function getSecrets(): Promise<SecretStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as SecretStore | undefined) ?? {}
}

export async function setSecrets(secrets: SecretStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: secrets })
}

export async function getGitHubToken(): Promise<string | undefined> {
  return (await getSecrets()).githubToken
}

export async function setGitHubToken(token: string | undefined): Promise<void> {
  const secrets = await getSecrets()
  if (token && token.trim().length > 0) {
    secrets.githubToken = token.trim()
  } else {
    delete secrets.githubToken
  }
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
