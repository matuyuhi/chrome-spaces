import styled from '@emotion/styled'
import { useEffect, useRef, useState } from 'react'
import { sendMessage, type UIFontSize } from '../../shared/messaging'
import { type GitHubAuthMethod, type SpaceStore } from '../../shared/types'
import { applyFontSize, FONT_LABELS, FONT_SCALE, tokens } from '../theme'
import { LinkButton, PrimaryButton, SecondaryButton } from '../atoms/Button'
import { Switch } from '../atoms/Switch'

// ─── Layout ──────────────────────────────────────────────────────────────────

const PageHeader = styled.header`
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid ${tokens.border};
  margin-bottom: 8px;
`

const BackBtn = styled(LinkButton)`
  font-size: 13px;
  color: ${tokens.muted};
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  &:hover {
    color: ${tokens.accent};
  }
`

const PageTitle = styled.h1`
  margin: 0;
  flex: 1;
  font-size: 24px;
  font-weight: 600;
  color: ${tokens.fg};
`

// ─── Card (one per section group) ────────────────────────────────────────────

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Card = styled.section`
  background: ${tokens.bgSoft};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.lg};
  padding: 0 24px;
  overflow: hidden;
`

const CardHeading = styled.h2`
  margin: 0 0 0 0;
  padding: 16px 0 12px;
  font-size: 12px;
  font-weight: 600;
  color: ${tokens.muted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid ${tokens.border};
`

// ─── Row (label + description left / control right) ──────────────────────────

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;

  &.last-row {
    /* no border on the final row */
  }

  &:not(.last-row) {
    border-bottom: 1px solid ${tokens.border};
  }
`

const RowLabel = styled.div`
  flex: 1;
  min-width: 0;
`

const RowTitle = styled.p`
  margin: 0;
  font-size: 14px;
  color: ${tokens.fg};
  font-weight: 500;
`

const RowDesc = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  color: ${tokens.muted};
  line-height: 1.5;

  code {
    background: ${tokens.bgHover};
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  a {
    color: ${tokens.accent};
  }
`

const RowControl = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

// Full-width content area inside a card row (e.g. font picker, OAuth flow)
const RowFull = styled.div`
  padding: 16px 0;

  &:not(.last-row) {
    border-bottom: 1px solid ${tokens.border};
  }
`

const RowFullTitle = styled.p`
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: ${tokens.fg};
`

const RowFullDesc = styled.p`
  margin: 0 0 12px;
  font-size: 12px;
  color: ${tokens.muted};
  line-height: 1.5;

  code {
    background: ${tokens.bgHover};
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  a {
    color: ${tokens.accent};
  }

  strong {
    color: ${tokens.fg};
  }
`

// ─── Font size picker ────────────────────────────────────────────────────────

const SizePicker = styled.div`
  display: flex;
  gap: 4px;
  background: ${tokens.bgHover};
  border-radius: ${tokens.radius.md};
  padding: 3px;
`

const SizeBtn = styled.button<{ isCurrent?: boolean }>`
  flex: 1;
  background: ${(p) => (p.isCurrent ? tokens.bg : 'transparent')};
  color: ${(p) => (p.isCurrent ? tokens.accent : tokens.muted)};
  border: none;
  border-radius: ${tokens.radius.sm};
  padding: 6px 0;
  cursor: pointer;
  font-weight: ${(p) => (p.isCurrent ? '600' : '400')};
  font-size: 12px;
  transition:
    background ${tokens.duration.fast} ease,
    color ${tokens.duration.fast} ease;
  box-shadow: ${(p) =>
    p.isCurrent ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'};

  &:hover {
    color: ${tokens.fg};
    background: ${(p) => (p.isCurrent ? tokens.bg : tokens.bgSoft)};
  }
`

// ─── Inline text input ───────────────────────────────────────────────────────

const TextInput = styled.input`
  background: ${tokens.bg};
  color: ${tokens.fg};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.md};
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color ${tokens.duration.fast} ease;
  width: 100%;

  &:focus {
    border-color: ${tokens.accent};
  }
`

const NumberInput = styled.input`
  background: ${tokens.bg};
  color: ${tokens.fg};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.md};
  padding: 7px 10px;
  font: inherit;
  font-size: 13px;
  outline: none;
  width: 80px;
  text-align: center;
  transition: border-color ${tokens.duration.fast} ease;

  &:focus {
    border-color: ${tokens.accent};
  }
`

// ─── Status badge ────────────────────────────────────────────────────────────

const StatusBadge = styled.span<{ ok?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: ${(p) => (p.ok ? tokens.accent : tokens.muted)};
`

// ─── Device code flow ────────────────────────────────────────────────────────

const DeviceCodeBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${tokens.bg};
  border: 1px solid ${tokens.accent};
  border-radius: ${tokens.radius.md};
  padding: 14px;
  margin-top: 8px;
`

const DeviceCodeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const DeviceCode = styled.div`
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: ${tokens.fg};
  text-align: center;
  padding: 8px 0;
  background: ${tokens.bgSoft};
  border-radius: ${tokens.radius.sm};
  user-select: all;
`

const InlineActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
`

const MutedText = styled.span`
  font-size: 12px;
  color: ${tokens.muted};
`

const ErrorText = styled.p`
  margin: 6px 0 0;
  font-size: 12px;
  color: ${tokens.danger};
`

// ─── Preferred auth toggle ────────────────────────────────────────────────────

const RadioGroup = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`

const RadioLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${tokens.fg};
  cursor: pointer;
`

// ─── Summary/details reset ───────────────────────────────────────────────────

const AdvancedDetails = styled.details`
  margin-top: 12px;

  summary {
    font-size: 12px;
    color: ${tokens.muted};
    cursor: pointer;
    user-select: none;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      content: '▶ ';
      font-size: 10px;
    }
  }

  &[open] summary::before {
    content: '▼ ';
  }
`

const AdvancedBody = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [hasOauth, setHasOauth] = useState<boolean | undefined>(undefined)
  const [hasPat, setHasPat] = useState<boolean | undefined>(undefined)
  const [preferred, setPreferred] = useState<GitHubAuthMethod | undefined>()
  const [active, setActive] = useState<GitHubAuthMethod | undefined>()
  const [saved, setSaved] = useState(false)
  const [fontSize, setFontSize] = useState<UIFontSize>(3)
  const [autoArchiveDays, setAutoArchiveDays] = useState(0)
  const [archiveSavedAt, setArchiveSavedAt] = useState<number | undefined>()
  const [showAddRowsInNestedFolders, setShowAddRowsInNestedFolders] =
    useState(false)
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
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) => {
      setFontSize(prefs.fontSize)
      setAutoArchiveDays(prefs.autoArchiveDays)
      setShowAddRowsInNestedFolders(prefs.showAddRowsInNestedFolders)
    })
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

  const handleSize = async (size: UIFontSize) => {
    setFontSize(size)
    applyFontSize(size)
    await sendMessage({ type: 'setUIPrefs', prefs: { fontSize: size } })
  }

  const handleArchiveDays = async (raw: string) => {
    const n = Math.max(0, Math.min(365, Math.floor(Number(raw) || 0)))
    setAutoArchiveDays(n)
    await sendMessage({ type: 'setUIPrefs', prefs: { autoArchiveDays: n } })
    setArchiveSavedAt(Date.now())
    setTimeout(() => setArchiveSavedAt(undefined), 1500)
  }

  const handleNestedAddRows = async (next: boolean) => {
    setShowAddRowsInNestedFolders(next)
    await sendMessage({
      type: 'setUIPrefs',
      prefs: { showAddRowsInNestedFolders: next },
    })
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [backupStatus, setBackupStatus] = useState<string | undefined>()

  const handleExport = async () => {
    const store = await sendMessage({ type: 'getStore' })
    const json = JSON.stringify(store, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().slice(0, 10)
    a.download = `spaces-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupStatus('Exported.')
    setTimeout(() => setBackupStatus(undefined), 2000)
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

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    let parsed: SpaceStore
    try {
      parsed = JSON.parse(text) as SpaceStore
    } catch {
      setBackupStatus('Could not parse file as JSON.')
      return
    }
    if (
      !confirm(
        'Replace ALL Spaces with the backup file? Your current Spaces will be discarded.\nTab references in the backup are stripped (tabs are session-scoped); folder structure and Live config are preserved.',
      )
    )
      return
    try {
      const win = await chrome.windows.getCurrent()
      if (typeof win.id !== 'number') throw new Error('No current window')
      await sendMessage({
        type: 'importStore',
        store: parsed,
        currentWindowId: win.id,
      })
      setBackupStatus('Imported.')
      setTimeout(() => location.reload(), 600)
    } catch (e) {
      setBackupStatus(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <BackBtn onClick={onClose}>← Back</BackBtn>
        <PageTitle>Settings</PageTitle>
      </PageHeader>

      <CardList>
        {/* ── Appearance ──────────────────────────────────────────────── */}
        <Card>
          <CardHeading>Appearance</CardHeading>

          {/* Font size */}
          <RowFull>
            <RowFullTitle>Font size</RowFullTitle>
            <SizePicker>
              {([1, 2, 3, 4, 5] as UIFontSize[]).map((s) => (
                <SizeBtn
                  key={s}
                  isCurrent={s === fontSize}
                  onClick={() => void handleSize(s)}
                  title={`Scale ×${FONT_SCALE[s]}`}
                >
                  {FONT_LABELS[s]}
                </SizeBtn>
              ))}
            </SizePicker>
          </RowFull>

          {/* Folder controls */}
          <Row>
            <RowLabel>
              <RowTitle>Add-row controls in nested folders</RowTitle>
              <RowDesc>
                Show the hover-revealed <code>+ Folder</code> /{' '}
                <code>+ Live folder</code> row inside nested folders too. Off
                by default — the <code>…</code> menu always exposes both
                actions.
              </RowDesc>
            </RowLabel>
            <RowControl>
              <Switch
                checked={showAddRowsInNestedFolders}
                onChange={(next) => void handleNestedAddRows(next)}
              />
            </RowControl>
          </Row>

          {/* Side panel position */}
          <Row className="last-row">
            <RowLabel>
              <RowTitle>Side panel position</RowTitle>
              <RowDesc>
                Whether the side panel appears on the left or right is a Chrome
                preference, not an extension setting.
              </RowDesc>
            </RowLabel>
            <RowControl>
              <SecondaryButton
                onClick={() => {
                  void chrome.tabs.create({
                    url: 'chrome://settings/appearance',
                  })
                }}
              >
                Open Chrome settings…
              </SecondaryButton>
            </RowControl>
          </Row>
        </Card>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Card>
          <CardHeading>Tabs</CardHeading>

          <Row className="last-row">
            <RowLabel>
              <RowTitle>Auto-archive</RowTitle>
              <RowDesc>
                Move tabs untouched for N days into a per-Space{' '}
                <code>Archive</code> folder. Live folder tabs are never
                archived. Set 0 to disable. Runs once a day.
              </RowDesc>
            </RowLabel>
            <RowControl>
              <NumberInput
                type="number"
                min={0}
                max={365}
                value={autoArchiveDays}
                onChange={(e) => void handleArchiveDays(e.target.value)}
              />
              <MutedText>days</MutedText>
              {archiveSavedAt && <MutedText>Saved.</MutedText>}
            </RowControl>
          </Row>
        </Card>

        {/* ── GitHub integration ──────────────────────────────────────── */}
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

        {/* ── Backup ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeading>Backup</CardHeading>

          <Row className="last-row">
            <RowLabel>
              <RowTitle>Export / Import</RowTitle>
              <RowDesc>
                Export saves Spaces, folders, and Live configs to a JSON file.
                Import replaces the current setup (tab references are stripped
                — tabs are session-scoped).
              </RowDesc>
            </RowLabel>
            <RowControl>
              <SecondaryButton onClick={() => void handleExport()}>
                Export…
              </SecondaryButton>
              <SecondaryButton onClick={() => fileInputRef.current?.click()}>
                Import…
              </SecondaryButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImportFile(file)
                  e.target.value = ''
                }}
              />
              {backupStatus && <MutedText>{backupStatus}</MutedText>}
            </RowControl>
          </Row>
        </Card>
      </CardList>
    </>
  )
}
