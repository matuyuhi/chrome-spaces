import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_GITHUB_API_BASE,
  getGitHubApiBaseUrl,
  getGitHubOauthToken,
  getGitHubPat,
  getGitHubToken,
  getPreferredAuth,
  getSecrets,
  normalizeGitHubApiBaseUrl,
  setGitHubApiBaseUrl,
  setGitHubOauthToken,
  setGitHubPat,
  setPreferredAuth,
  setSecrets,
} from './secret-storage'
import { setupChromeMock } from './test-utils'

describe('secret-storage', () => {
  beforeEach(() => setupChromeMock())

  it('returns empty secrets when nothing is stored', async () => {
    expect(await getSecrets()).toEqual({})
    expect(await getGitHubToken()).toBeUndefined()
  })

  it('stores and retrieves a PAT, trims whitespace, treats empty as clear', async () => {
    await setGitHubPat('  ghp_padded  ')
    expect(await getGitHubPat()).toBe('ghp_padded')
    expect(await getGitHubToken()).toBe('ghp_padded')
    await setGitHubPat('   ')
    expect(await getGitHubPat()).toBeUndefined()
  })

  it('stores and retrieves an OAuth token', async () => {
    await setGitHubOauthToken('gho_test')
    expect(await getGitHubOauthToken()).toBe('gho_test')
    expect(await getGitHubToken()).toBe('gho_test')
  })

  it('first OAuth sign-in sets preferredAuth=oauth; first PAT sets preferredAuth=pat', async () => {
    await setGitHubOauthToken('gho_test')
    expect(await getPreferredAuth()).toBe('oauth')
    setupChromeMock() // reset
    await setGitHubPat('ghp_test')
    expect(await getPreferredAuth()).toBe('pat')
  })

  it('keeps both saved and getGitHubToken obeys preferredAuth', async () => {
    await setGitHubOauthToken('gho_x')
    await setGitHubPat('ghp_y')
    await setPreferredAuth('pat')
    expect(await getGitHubToken()).toBe('ghp_y')
    await setPreferredAuth('oauth')
    expect(await getGitHubToken()).toBe('gho_x')
  })

  it('clearing the preferred slot rolls preferredAuth to the surviving slot', async () => {
    await setGitHubOauthToken('gho_x')
    await setGitHubPat('ghp_y')
    await setPreferredAuth('oauth')
    await setGitHubOauthToken(undefined)
    expect(await getPreferredAuth()).toBe('pat')
    expect(await getGitHubToken()).toBe('ghp_y')
  })

  it('treats a legacy single-slot githubToken as a PAT for fallback', async () => {
    // Simulate an older install that wrote to githubToken before the
    // split. getGitHubToken should still return it via the PAT fallback.
    await setSecrets({ githubToken: 'legacy_pat' })
    expect(await getGitHubToken()).toBe('legacy_pat')
    expect(await getGitHubPat()).toBe('legacy_pat')
  })

  it('saving a PAT retires the legacy single-slot value', async () => {
    await setSecrets({ githubToken: 'legacy_pat' })
    await setGitHubPat('ghp_new')
    const s = await getSecrets()
    expect(s.githubToken).toBeUndefined()
    expect(s.githubPat).toBe('ghp_new')
  })

  it('keeps secrets out of chrome.storage.sync', async () => {
    await setGitHubPat('ghp_test')
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
