import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_GITHUB_API_BASE,
  getGitHubApiBaseUrl,
  getGitHubToken,
  getSecrets,
  normalizeGitHubApiBaseUrl,
  setGitHubApiBaseUrl,
  setGitHubToken,
} from './secret-storage'
import { setupChromeMock } from './test-utils'

describe('secret-storage', () => {
  beforeEach(() => setupChromeMock())

  it('returns empty secrets when nothing is stored', async () => {
    expect(await getSecrets()).toEqual({})
    expect(await getGitHubToken()).toBeUndefined()
  })

  it('stores and retrieves a GitHub token', async () => {
    await setGitHubToken('ghp_test')
    expect(await getGitHubToken()).toBe('ghp_test')
  })

  it('trims whitespace and treats empty/whitespace as clear', async () => {
    await setGitHubToken('  ghp_padded  ')
    expect(await getGitHubToken()).toBe('ghp_padded')
    await setGitHubToken('   ')
    expect(await getGitHubToken()).toBeUndefined()
  })

  it('clears the token when undefined is passed', async () => {
    await setGitHubToken('ghp_test')
    await setGitHubToken(undefined)
    expect(await getGitHubToken()).toBeUndefined()
  })

  it('keeps secrets out of chrome.storage.sync', async () => {
    await setGitHubToken('ghp_test')
    const synced = await chrome.storage.sync.get(null)
    expect(synced).toEqual({})
  })

  it('defaults the GitHub API base URL to api.github.com', async () => {
    expect(await getGitHubApiBaseUrl()).toBe(DEFAULT_GITHUB_API_BASE)
  })

  it('stores a GHES base URL and strips trailing slashes', async () => {
    await setGitHubApiBaseUrl('https://ghe.example.com/api/v3/')
    expect(await getGitHubApiBaseUrl()).toBe('https://ghe.example.com/api/v3')
  })

  it('treats the default URL as cleared', async () => {
    await setGitHubApiBaseUrl('https://api.github.com')
    const secrets = await getSecrets()
    expect(secrets.githubApiBaseUrl).toBeUndefined()
    expect(await getGitHubApiBaseUrl()).toBe(DEFAULT_GITHUB_API_BASE)
  })

  it('clears when undefined or empty', async () => {
    await setGitHubApiBaseUrl('https://ghe.example.com/api/v3')
    await setGitHubApiBaseUrl(undefined)
    expect(await getGitHubApiBaseUrl()).toBe(DEFAULT_GITHUB_API_BASE)
    await setGitHubApiBaseUrl('https://ghe.example.com/api/v3')
    await setGitHubApiBaseUrl('   ')
    expect(await getGitHubApiBaseUrl()).toBe(DEFAULT_GITHUB_API_BASE)
  })

  it('rejects non-https and malformed URLs', () => {
    expect(() => normalizeGitHubApiBaseUrl('http://ghe.example.com/api/v3')).toThrow()
    expect(() => normalizeGitHubApiBaseUrl('not a url')).toThrow()
  })
})
