import { type SecretStore } from '../shared/types'

const STORAGE_KEY = 'secrets'

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
