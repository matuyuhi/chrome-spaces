// GitHub OAuth Device Flow client.
//
// Why Device Flow rather than the redirect-based Authorization Code flow:
// Chrome extensions don't have a stable HTTPS callback URL the way a web
// app does, and chrome.identity.launchWebAuthFlow doesn't help on the
// redirect side either since GitHub OAuth Apps reject `chromiumapp.org`.
// Device Flow needs only the client_id and a `POST` to two endpoints,
// which keeps everything inside the side panel.
//
// Client ID resolution order:
//   1. The user's saved override in Settings (chrome.storage.local).
//   2. The build-time `VITE_GITHUB_CLIENT_ID` baked in via .env (the
//      common case — maintainer registers one OAuth App for everyone
//      using this build).

import { getGitHubClientId, setGitHubToken } from './secret-storage'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
// Read access to PRs/issues across orgs the user belongs to. Matches the
// scopes recommended in the SettingsPanel PAT note.
const DEFAULT_SCOPE = 'repo read:org'

// Vite injects this at build time; falsy when .env is missing or empty.
// `as string | undefined` because `import.meta.env` types are loose.
export const BUILTIN_GITHUB_CLIENT_ID = (
  (import.meta.env?.VITE_GITHUB_CLIENT_ID as string | undefined) ?? ''
).trim() || undefined

export async function resolveClientId(): Promise<string | undefined> {
  // Per-user override beats built-in so a fork or contributor can point
  // at their own OAuth App without rebuilding.
  const saved = await getGitHubClientId()
  return saved ?? BUILTIN_GITHUB_CLIENT_ID
}

export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export async function startDeviceFlow(
  fetchImpl: typeof fetch = fetch,
): Promise<DeviceCode> {
  const clientId = await resolveClientId()
  if (!clientId)
    throw new Error(
      'No GitHub OAuth client_id available. This build did not bundle one — paste a client_id under Settings → "Advanced — Override OAuth Client ID".',
    )
  const body = new URLSearchParams({ client_id: clientId, scope: DEFAULT_SCOPE })
  const res = await fetchImpl(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Device code request failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as DeviceCodeResponse
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  }
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'success' }

interface AccessTokenSuccess {
  access_token: string
  token_type: string
  scope: string
}

interface AccessTokenError {
  error:
    | 'authorization_pending'
    | 'slow_down'
    | 'expired_token'
    | 'access_denied'
    | 'unsupported_grant_type'
    | 'incorrect_client_credentials'
    | 'incorrect_device_code'
  error_description?: string
  interval?: number
}

export async function pollDeviceFlow(
  deviceCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PollResult> {
  const clientId = await resolveClientId()
  if (!clientId) throw new Error('client_id was cleared mid-flow')
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  const res = await fetchImpl(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  // GitHub returns 200 for both success and pending — distinguish via body.
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Token poll failed: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as AccessTokenSuccess | AccessTokenError
  if ('access_token' in data) {
    await setGitHubToken(data.access_token)
    return { status: 'success' }
  }
  switch (data.error) {
    case 'authorization_pending':
      return { status: 'pending' }
    case 'slow_down':
      return { status: 'slow_down', interval: data.interval ?? 5 }
    case 'expired_token':
      return { status: 'expired' }
    case 'access_denied':
      return { status: 'denied' }
    default:
      throw new Error(
        `Token endpoint returned ${data.error}${
          data.error_description ? `: ${data.error_description}` : ''
        }`,
      )
  }
}
