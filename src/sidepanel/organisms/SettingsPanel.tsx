import styled from '@emotion/styled'
import { useEffect, useRef, useState } from 'react'
import { sendMessage, type UIFontSize } from '../../shared/messaging'
import { type SpaceStore } from '../../shared/types'
import { applyFontSize, FONT_LABELS, FONT_SCALE, tokens } from '../theme'
import { LinkButton, PrimaryButton, SecondaryButton } from '../atoms/Button'

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;

  h2 {
    font-size: 11px;
    margin: 0;
    font-weight: 600;
    color: ${tokens.muted};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input[type='password'],
  input[type='text'] {
    background: ${tokens.bg};
    color: ${tokens.fg};
    border: 1px solid ${tokens.border};
    border-radius: ${tokens.radius.md};
    padding: 6px 8px;
    font: inherit;
    outline: none;
  }

  a {
    color: ${tokens.accent};
  }

  code {
    background: ${tokens.bgSoft};
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .muted {
    font-size: 11px;
    color: ${tokens.muted};
    margin: 0;
    line-height: 1.5;
  }
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SizePicker = styled.div`
  display: flex;
  gap: 4px;
`

const SizeBtn = styled.button<{ isCurrent?: boolean }>`
  flex: 1;
  background: ${(p) => (p.isCurrent ? tokens.accentSoft : tokens.bgSoft)};
  color: ${(p) => (p.isCurrent ? tokens.accent : tokens.muted)};
  border: none;
  border-radius: ${tokens.radius.md};
  padding: 8px 0;
  cursor: pointer;
  font-weight: 500;
  font-size: 12px;
  transition:
    background ${tokens.duration.fast} ease,
    color ${tokens.duration.fast} ease;

  &:hover {
    background: ${tokens.bgHover};
    color: ${tokens.fg};
  }
`

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;

  h1 {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin: 0;
    flex: 1;
    color: ${tokens.subtle};
    text-transform: uppercase;
  }
`

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState<boolean | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [fontSize, setFontSize] = useState<UIFontSize>(3)
  const [autoArchiveDays, setAutoArchiveDays] = useState(0)
  const [archiveSavedAt, setArchiveSavedAt] = useState<number | undefined>()
  const [baseUrl, setBaseUrl] = useState('')
  const [baseUrlIsCustom, setBaseUrlIsCustom] = useState(false)
  const [baseUrlStatus, setBaseUrlStatus] = useState<string | undefined>()
  const [clientId, setClientId] = useState('')
  const [hasClientId, setHasClientId] = useState<boolean | undefined>(undefined)
  const [oauthState, setOauthState] = useState<
    | { phase: 'idle' }
    | {
        phase: 'awaiting'
        userCode: string
        verificationUri: string
      }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  useEffect(() => {
    void sendMessage({ type: 'getGitHubToken' }).then(({ hasToken }) =>
      setHasToken(hasToken),
    )
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) => {
      setFontSize(prefs.fontSize)
      setAutoArchiveDays(prefs.autoArchiveDays)
    })
    void sendMessage({ type: 'getGitHubApiBaseUrl' }).then(({ url, isCustom }) => {
      setBaseUrl(isCustom ? url : '')
      setBaseUrlIsCustom(isCustom)
    })
    void sendMessage({ type: 'getGitHubClientId' }).then(({ hasClientId }) =>
      setHasClientId(hasClientId),
    )
  }, [])

  const handleSave = async () => {
    await sendMessage({ type: 'setGitHubToken', token: token || undefined })
    setHasToken(!!token)
    setToken('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
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
    setHasClientId(!!clientId.trim())
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
    setOauthState({
      phase: 'awaiting',
      userCode: device.userCode,
      verificationUri: device.verificationUri,
    })
    void chrome.tabs.create({ url: device.verificationUri })
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
        setHasToken(true)
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
      <Header>
        <LinkButton onClick={onClose}>← Back</LinkButton>
        <h1>Settings</h1>
        <span />
      </Header>

      <Section>
        <h2>Font size</h2>
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
      </Section>

      <Section>
        <h2>Auto-archive</h2>
        <p className="muted">
          Move tabs you haven't touched in N days into a per-Space{' '}
          <code>Archive</code> folder. Live folder tabs are never archived.
          Set 0 to disable. Runs once a day.
        </p>
        <Actions>
          <input
            type="number"
            min={0}
            max={365}
            value={autoArchiveDays}
            onChange={(e) => void handleArchiveDays(e.target.value)}
            style={{ width: 80 }}
          />
          <span className="muted">days (0 = disabled)</span>
          {archiveSavedAt && <span className="muted">Saved.</span>}
        </Actions>
      </Section>

      <Section>
        <h2>Backup</h2>
        <p className="muted">
          Export saves Spaces / folders / Live configs to a JSON file. Import
          replaces the current setup with the file's contents (tab references
          are stripped — tabs themselves are session-scoped).
        </p>
        <Actions>
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
          {backupStatus && <span className="muted">{backupStatus}</span>}
        </Actions>
      </Section>

      <Section>
        <h2>GitHub credential</h2>
        <p className="muted">
          Live folders need a GitHub credential. Pick whichever option fits —
          OAuth gives revocable, per-app access; a PAT is faster to set up if
          you already have one.
        </p>
      </Section>

      <Section>
        <h2>Option A — Sign in with OAuth (Device Flow)</h2>
        <p className="muted">
          Sign in via a GitHub OAuth App you control. Create one at{' '}
          <a
            href="https://github.com/settings/applications/new"
            target="_blank"
            rel="noreferrer"
          >
            github.com/settings/applications/new
          </a>{' '}
          (any name and homepage URL work), then enable{' '}
          <strong>Device Flow</strong> on the app's settings page and paste the{' '}
          <code>Client ID</code> here. No client secret is needed.
        </p>
        <p className="muted">
          Status:{' '}
          {hasClientId === undefined
            ? '…'
            : hasClientId
              ? '✓ client_id saved'
              : '— client_id not set'}
        </p>
        <input
          type="text"
          autoComplete="off"
          placeholder="Iv1.xxxxxxxxxxxx"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <Actions>
          <SecondaryButton onClick={() => void handleSaveClientId()}>
            {clientId.trim() ? 'Save client_id' : hasClientId ? 'Clear' : 'Save'}
          </SecondaryButton>
          <PrimaryButton
            onClick={() => void handleStartOAuth()}
            disabled={!hasClientId || oauthState.phase === 'awaiting'}
          >
            {oauthState.phase === 'awaiting' ? 'Waiting…' : 'Sign in with GitHub'}
          </PrimaryButton>
        </Actions>
        {oauthState.phase === 'awaiting' && (
          <p className="muted">
            Enter <code>{oauthState.userCode}</code> at{' '}
            <a href={oauthState.verificationUri} target="_blank" rel="noreferrer">
              {oauthState.verificationUri}
            </a>{' '}
            (a tab was opened for you). Keep this side panel open until the flow
            completes.
          </p>
        )}
        {oauthState.phase === 'error' && (
          <p className="muted" style={{ color: 'tomato' }}>
            {oauthState.message}
          </p>
        )}
      </Section>

      <Section>
        <h2>Option B — Personal Access Token</h2>
        <p className="muted">
          Paste a PAT directly. Stored only in{' '}
          <code>chrome.storage.local</code> on this device — never synced.
        </p>
        <p className="muted">
          Status:{' '}
          {hasToken === undefined ? '…' : hasToken ? '✓ token saved' : '— no token'}
        </p>
        <input
          type="password"
          autoComplete="off"
          placeholder="ghp_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Actions>
          <PrimaryButton onClick={handleSave} disabled={!token && !hasToken}>
            {token ? 'Save token' : hasToken ? 'Clear token' : 'Save'}
          </PrimaryButton>
          {saved && <span className="muted">Saved.</span>}
        </Actions>
        <p className="muted">
          Required scopes: <code>repo</code> (private PRs/issues) or{' '}
          <code>public_repo</code>. Generate at{' '}
          <a
            href="https://github.com/settings/tokens?type=beta"
            target="_blank"
            rel="noreferrer"
          >
            github.com/settings/tokens
          </a>
          .
        </p>
      </Section>

      <Section>
        <h2>GitHub Enterprise (optional)</h2>
        <p className="muted">
          Point Live folders at a GHES instance. Leave empty to use{' '}
          <code>api.github.com</code>. Format:{' '}
          <code>https://ghe.example.com/api/v3</code>. Saving prompts Chrome
          for permission to fetch from that origin.
        </p>
        <p className="muted">
          Status:{' '}
          {baseUrlIsCustom ? '✓ custom base URL' : '— using api.github.com'}
        </p>
        <input
          type="text"
          autoComplete="off"
          placeholder="https://ghe.example.com/api/v3"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
        <Actions>
          <PrimaryButton onClick={() => void handleSaveBaseUrl()}>
            {baseUrl.trim() ? 'Save base URL' : baseUrlIsCustom ? 'Revert' : 'Save'}
          </PrimaryButton>
          {baseUrlStatus && <span className="muted">{baseUrlStatus}</span>}
        </Actions>
      </Section>
    </>
  )
}
