import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BUILTIN_GITHUB_CLIENT_ID,
  pollDeviceFlow,
  resolveClientId,
  startDeviceFlow,
} from './oauth'
import { getGitHubToken, setGitHubClientId } from './secret-storage'
import { setupChromeMock } from './test-utils'

describe('oauth device flow', () => {
  beforeEach(() => setupChromeMock())

  it('resolveClientId prefers a saved override over the built-in', async () => {
    await setGitHubClientId('Iv1.override')
    expect(await resolveClientId()).toBe('Iv1.override')
  })

  it('resolveClientId falls back to the built-in when no override is saved', async () => {
    expect(await resolveClientId()).toBe(BUILTIN_GITHUB_CLIENT_ID)
  })

  it('startDeviceFlow returns the device-code response', async () => {
    await setGitHubClientId('Iv1.test')
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          device_code: 'dc_123',
          user_code: 'WDJB-MJHT',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
        { status: 200 },
      ),
    )
    const out = await startDeviceFlow(fetchSpy as unknown as typeof fetch)
    expect(out).toEqual({
      deviceCode: 'dc_123',
      userCode: 'WDJB-MJHT',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 900,
      interval: 5,
    })
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('https://github.com/login/device/code')
    const body = (call[1].body as URLSearchParams).toString()
    expect(body).toContain('client_id=Iv1.test')
    expect(body).toContain('scope=repo+read%3Aorg')
  })

  it('pollDeviceFlow stores the token on success', async () => {
    await setGitHubClientId('Iv1.test')
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: 'gho_test',
          token_type: 'bearer',
          scope: 'repo,read:org',
        }),
        { status: 200 },
      ),
    )
    const out = await pollDeviceFlow('dc_123', fetchSpy as unknown as typeof fetch)
    expect(out).toEqual({ status: 'success' })
    expect(await getGitHubToken()).toBe('gho_test')
  })

  it('maps known error codes to a status without throwing', async () => {
    await setGitHubClientId('Iv1.test')
    const cases: { error: string; expect: object }[] = [
      { error: 'authorization_pending', expect: { status: 'pending' } },
      { error: 'slow_down', expect: { status: 'slow_down', interval: 5 } },
      { error: 'expired_token', expect: { status: 'expired' } },
      { error: 'access_denied', expect: { status: 'denied' } },
    ]
    for (const c of cases) {
      const fetchSpy = vi.fn(async () =>
        new Response(JSON.stringify({ error: c.error, interval: 5 }), { status: 200 }),
      )
      expect(await pollDeviceFlow('dc_x', fetchSpy as unknown as typeof fetch)).toEqual(
        c.expect,
      )
    }
  })

  it('throws on unrecognized errors', async () => {
    await setGitHubClientId('Iv1.test')
    const fetchSpy = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: 'incorrect_client_credentials' }),
        { status: 200 },
      ),
    )
    await expect(
      pollDeviceFlow('dc_x', fetchSpy as unknown as typeof fetch),
    ).rejects.toThrow(/incorrect_client_credentials/)
  })
})
