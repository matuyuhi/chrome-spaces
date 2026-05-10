import { useEffect, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type GitHubAuthMethod } from '../../shared/types'
import { PrimaryButton, SecondaryButton } from '../atoms/Button'
import {
  Card,
  CardHeading,
  Row,
  RowLabel,
  RowTitle,
  RowDesc,
  RowControl,
  RowFull,
  RowFullTitle,
  RowFullDesc,
  TextInput,
  StatusBadge,
  DeviceCodeBox,
  DeviceCodeRow,
  DeviceCode,
  InlineActions,
  MutedText,
  ErrorText,
  RadioGroup,
  RadioLabel,
  AdvancedDetails,
  AdvancedBody,
} from './SettingsShared'

export function GitHubSettings() {
  const [token, setToken] = useState('')
  const [hasOauth, setHasOauth] = useState<boolean | undefined>(undefined)
  const [hasPat, setHasPat] = useState<boolean | undefined>(undefined)
  const [preferred, setPreferred] = useState<GitHubAuthMethod | undefined>()
  const [active, setActive] = useState<GitHubAuthMethod | undefined>()
  const [saved, setSaved] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [baseUrlIsCustom, setBaseUrlIsCustom] = useState(false)
  const [baseUrlStatus, setBaseUrlStatus] = useState<string | undefined>()
  const [clientId, setClientId] = useState('')
  const [hasOverride, setHasOverride] = useState<boolean | undefined>(undefined)
  const [hasBuiltin, setHasBuiltin] = useState<boolean>(false)
  const canSignIn = hasOverride || hasBuiltin
  const [codeCopiedAt, setCodeCopiedAt] = useState<number | undefined>()
  const [oauthState, setOauthState] = useState<
    | { phase: 'idle' }
    | {
        phase: 'awaiting'
        userCode: string
        verificationUri: string
      }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  const refreshAuthState = async () => {
    const s = await sendMessage({ type: 'getGitHubAuthState' })
    setHasOauth(s.hasOauth)
    setHasPat(s.hasPat)
    setPreferred(s.preferred)
    setActive(s.active)
  }

  useEffect(() => {
    void refreshAuthState()
    void sendMessage({ type: 'getGitHubApiBaseUrl' }).then(({ url, isCustom }) => {
      setBaseUrl(isCustom ? url : '')
      setBaseUrlIsCustom(isCustom)
    })
    void sendMessage({ type: 'getGitHubClientId' }).then(
      ({ hasOverride, hasBuiltin }) => {
        setHasOverride(hasOverride)
        setHasBuiltin(hasBuiltin)
      },
    )
  }, [])

  const handleSave = async () => {
    await sendMessage({ type: 'setGitHubPat', token: token || undefined })
    await refreshAuthState()
    setToken('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleSignOutOauth = async () => {
    await sendMessage({ type: 'clearGitHubOauthToken' })
    await refreshAuthState()
  }

  const handlePreferred = async (method: GitHubAuthMethod) => {
    await sendMessage({ type: 'setPreferredAuth', method })
    await refreshAuthState()
  }

  const handleSaveBaseUrl = async () => {
    const trimmed = baseUrl.trim()
    if (!trimmed) {
      await sendMessage({ type: 'setGitHubApiBaseUrl', url: undefined })
      setBaseUrlIsCustom(false)
      setBaseUrlStatus('Reverted to api.github.com.')
      setTimeout(() => setBaseUrlStatus(undefined), 2000)
      return
    }
    let origin: string
    try {
      const u = new URL(trimmed)
      if (u.protocol !== 'https:') throw new Error('https only')
      origin = u.origin
    } catch {
      setBaseUrlStatus('Enter a full https URL (e.g. https://ghe.example.com/api/v3).')
      return
    }
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
    if (!granted) {
      setBaseUrlStatus('Permission denied — base URL not saved.')
      return
    }
    try {
      await sendMessage({ type: 'setGitHubApiBaseUrl', url: trimmed })
      setBaseUrlIsCustom(true)
      setBaseUrlStatus('Saved.')
      setTimeout(() => setBaseUrlStatus(undefined), 2000)
    } catch (e) {
      setBaseUrlStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSaveClientId = async () => {
    await sendMessage({
      type: 'setGitHubClientId',
      clientId: clientId.trim() || undefined,
    })
    setHasOverride(!!clientId.trim())
    setClientId('')
  }

  const handleStartOAuth = async () => {
    setOauthState({ phase: 'idle' })
    let device
    try {
      device = await sendMessage({ type: 'startGitHubOAuth' })
    } catch (e) {
      setOauthState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
      return
    }
    const verificationUri = `${device.verificationUri}?user_code=${encodeURIComponent(device.userCode)}`
    setOauthState({
      phase: 'awaiting',
      userCode: device.userCode,
      verificationUri,
    })
    void navigator.clipboard.writeText(device.userCode).catch(() => {
      /* clipboard API can be denied; the on-screen Copy button covers it */
    })
    void chrome.tabs.create({ url: verificationUri })
    const start = Date.now()
    let interval = device.interval
    while (Date.now() - start < device.expiresIn * 1000) {
      await new Promise((r) => setTimeout(r, interval * 1000))
      let result
      try {
        result = await sendMessage({
          type: 'pollGitHubOAuth',
          deviceCode: device.deviceCode,
        })
      } catch (e) {
        setOauthState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
        return
      }
      if (result.status === 'success') {
        setOauthState({ phase: 'idle' })
        await refreshAuthState()
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
        return
      }
      if (result.status === 'denied') {
        setOauthState({ phase: 'error', message: 'Authorization denied.' })
        return
      }
      if (result.status === 'expired') {
        setOauthState({
          phase: 'error',
          message: 'Code expired before approval — please try again.',
        })
        return
      }
      if (result.status === 'slow_down') interval = result.interval
    }
    setOauthState({ phase: 'error', message: 'Timed out waiting for approval.' })
  }

  return (
    <Card>
      <CardHeading>GitHub integration</CardHeading>

      {/* Preferred method (only shown when both are saved) */}
      {hasOauth && hasPat && (
        <Row>
          <RowLabel>
            <RowTitle>Active credential</RowTitle>
            <RowDesc>
              You have both an OAuth token and a PAT saved. Choose which
              one Live folders use.
            </RowDesc>
          </RowLabel>
          <RowControl>
            <RadioGroup>
              <RadioLabel>
                <input
                  type="radio"
                  name="preferred-auth"
                  checked={(preferred ?? active) === 'oauth'}
                  onChange={() => void handlePreferred('oauth')}
                />
                OAuth
              </RadioLabel>
              <RadioLabel>
                <input
                  type="radio"
                  name="preferred-auth"
                  checked={(preferred ?? active) === 'pat'}
                  onChange={() => void handlePreferred('pat')}
                />
                PAT
              </RadioLabel>
            </RadioGroup>
          </RowControl>
        </Row>
      )}

      {/* Status summary row */}
      {(hasOauth !== undefined || hasPat !== undefined) && (
        <Row>
          <RowLabel>
            <RowTitle>Status</RowTitle>
          </RowLabel>
          <RowControl>
            <StatusBadge ok={!!(hasOauth || hasPat)}>
              {active === 'oauth'
                ? '✓ OAuth token active'
                : active === 'pat'
                  ? '✓ PAT active'
                  : '— not authenticated'}
            </StatusBadge>
          </RowControl>
        </Row>
      )}

      {/* Option A — OAuth */}
      <RowFull>
        <RowFullTitle>Option A — Sign in with OAuth (Device Flow)</RowFullTitle>
        <RowFullDesc>
          {hasBuiltin
            ? 'This build ships a maintainer-registered OAuth App. Click "Sign in with GitHub" — a tab opens, you enter the displayed code, and the access token comes back here.'
            : 'No OAuth App is bundled in this build. Either rebuild with VITE_GITHUB_CLIENT_ID set in .env, or paste a Client ID in the advanced section below.'}{' '}
          OAuth token:{' '}
          {hasOauth === undefined
            ? '…'
            : hasOauth
              ? '✓ saved'
              : '— not signed in'}
        </RowFullDesc>
        <InlineActions>
          <PrimaryButton
            onClick={() => void handleStartOAuth()}
            disabled={!canSignIn || oauthState.phase === 'awaiting'}
          >
            {oauthState.phase === 'awaiting'
              ? 'Waiting…'
              : hasOauth
                ? 'Re-authorize'
                : 'Sign in with GitHub'}
          </PrimaryButton>
          {hasOauth && (
            <SecondaryButton onClick={() => void handleSignOutOauth()}>
              Sign out
            </SecondaryButton>
          )}
        </InlineActions>

        {oauthState.phase === 'awaiting' && (
          <DeviceCodeBox>
            <RowFullDesc style={{ margin: 0 }}>
              Enter this code at{' '}
              <a
                href={oauthState.verificationUri}
                target="_blank"
                rel="noreferrer"
              >
                {oauthState.verificationUri}
              </a>{' '}
              (a tab was opened for you):
            </RowFullDesc>
            <DeviceCodeRow>
              <DeviceCode>{oauthState.userCode}</DeviceCode>
              <SecondaryButton
                onClick={() => {
                  void navigator.clipboard.writeText(oauthState.userCode)
                  setCodeCopiedAt(Date.now())
                  setTimeout(() => setCodeCopiedAt(undefined), 1500)
                }}
              >
                {codeCopiedAt ? 'Copied!' : 'Copy'}
              </SecondaryButton>
            </DeviceCodeRow>
            <RowFullDesc style={{ margin: 0 }}>
              Keep this page open — it polls until you approve.
            </RowFullDesc>
          </DeviceCodeBox>
        )}
        {oauthState.phase === 'error' && (
          <ErrorText>{oauthState.message}</ErrorText>
        )}

        <AdvancedDetails>
          <summary>Advanced — Override OAuth Client ID</summary>
          <AdvancedBody>
            <RowFullDesc style={{ margin: 0 }}>
              Client ID status:{' '}
              {hasOverride === undefined
                ? '…'
                : hasOverride
                  ? '✓ using override'
                  : hasBuiltin
                    ? '✓ using built-in'
                    : '— no Client ID available'}{' '}
              · Create an OAuth App at{' '}
              <a
                href="https://github.com/settings/applications/new"
                target="_blank"
                rel="noreferrer"
              >
                github.com/settings/applications/new
              </a>
              , enable <strong>Device Flow</strong>, then paste the Client
              ID here. Clear to fall back to the built-in.
            </RowFullDesc>
            <TextInput
              type="text"
              autoComplete="off"
              placeholder="Iv1.xxxxxxxxxxxx"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
            <InlineActions>
              <SecondaryButton onClick={() => void handleSaveClientId()}>
                {clientId.trim()
                  ? 'Save override'
                  : hasOverride
                    ? 'Clear override'
                    : 'Save'}
              </SecondaryButton>
            </InlineActions>
          </AdvancedBody>
        </AdvancedDetails>
      </RowFull>

      {/* Option B — PAT */}
      <RowFull>
        <RowFullTitle>Option B — Personal Access Token</RowFullTitle>
        <RowFullDesc>
          Stored only in <code>chrome.storage.local</code> on this device
          — never synced. PAT:{' '}
          {hasPat === undefined ? '…' : hasPat ? '✓ saved' : '— not set'}
          .{' '}
          Required scopes: <code>repo</code> (private) or{' '}
          <code>public_repo</code>. Generate at{' '}
          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank"
            rel="noreferrer"
          >
            github.com/settings/tokens
          </a>
          .
        </RowFullDesc>
        <TextInput
          type="password"
          autoComplete="off"
          placeholder="ghp_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <InlineActions style={{ marginTop: 8 }}>
          <PrimaryButton onClick={handleSave} disabled={!token && !hasPat}>
            {token ? 'Save PAT' : hasPat ? 'Clear PAT' : 'Save'}
          </PrimaryButton>
          {saved && <MutedText>Saved.</MutedText>}
        </InlineActions>
      </RowFull>

      {/* GitHub Enterprise */}
      <RowFull className="last-row">
        <RowFullTitle>GitHub Enterprise base URL (optional)</RowFullTitle>
        <RowFullDesc>
          Point Live folders at a GHES instance. Leave empty to use{' '}
          <code>api.github.com</code>. Format:{' '}
          <code>https://ghe.example.com/api/v3</code>. Saving prompts
          Chrome for permission to fetch from that origin. Status:{' '}
          {baseUrlIsCustom ? '✓ custom base URL' : '— using api.github.com'}
        </RowFullDesc>
        <TextInput
          type="text"
          autoComplete="off"
          placeholder="https://ghe.example.com/api/v3"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <InlineActions style={{ marginTop: 8 }}>
          <PrimaryButton onClick={() => void handleSaveBaseUrl()}>
            {baseUrl.trim()
              ? 'Save base URL'
              : baseUrlIsCustom
                ? 'Revert'
                : 'Save'}
          </PrimaryButton>
          {baseUrlStatus && <MutedText>{baseUrlStatus}</MutedText>}
        </InlineActions>
      </RowFull>
    </Card>
  )
}
