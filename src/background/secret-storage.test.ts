import { describe, it, expect, beforeEach } from 'vitest'
import { getGitHubToken, setGitHubToken, getSecrets } from './secret-storage'
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
})
