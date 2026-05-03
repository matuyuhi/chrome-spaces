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
  const [baseUrl, setBaseUrl] = useState('')
  const [baseUrlIsCustom, setBaseUrlIsCustom] = useState(false)
  const [baseUrlStatus, setBaseUrlStatus] = useState<string | undefined>()

  useEffect(() => {
    void sendMessage({ type: 'getGitHubToken' }).then(({ hasToken }) =>
      setHasToken(hasToken),
    )
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) =>
      setFontSize(prefs.fontSize),
    )
    void sendMessage({ type: 'getGitHubApiBaseUrl' }).then(({ url, isCustom }) => {
      setBaseUrl(isCustom ? url : '')
      setBaseUrlIsCustom(isCustom)
    })
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
        <h2>GitHub PAT</h2>
        <p className="muted">
          Used by Live Folders. Stored only in <code>chrome.storage.local</code> on
          this device.
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
