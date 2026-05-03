import { useEffect, useRef, useState } from 'react'
import { sendMessage, type UIFontSize } from '../shared/messaging'
import { type SpaceStore } from '../shared/types'
import { applyFontSize, FONT_LABELS, FONT_SCALE } from './theme'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState<boolean | undefined>(undefined)
  const [saved, setSaved] = useState(false)
  const [fontSize, setFontSize] = useState<UIFontSize>(3)

  useEffect(() => {
    void sendMessage({ type: 'getGitHubToken' }).then(({ hasToken }) =>
      setHasToken(hasToken),
    )
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) =>
      setFontSize(prefs.fontSize),
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
      <header className="header">
        <button className="btn-link" onClick={onClose}>
          ← Back
        </button>
        <h1>Settings</h1>
        <span />
      </header>
      <section className="settings-section">
        <h2>Font size</h2>
        <div className="size-picker">
          {([1, 2, 3, 4, 5] as UIFontSize[]).map((s) => (
            <button
              key={s}
              className={`size-btn ${s === fontSize ? 'is-current' : ''}`}
              onClick={() => void handleSize(s)}
              title={`Scale ×${FONT_SCALE[s]}`}
            >
              {FONT_LABELS[s]}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>Backup</h2>
        <p className="muted">
          Export saves Spaces / folders / Live configs to a JSON file. Import
          replaces the current setup with the file's contents (tab references
          are stripped — tabs themselves are session-scoped).
        </p>
        <div className="settings-actions">
          <button className="btn-secondary" onClick={() => void handleExport()}>
            Export…
          </button>
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Import…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
              e.target.value = '' // allow re-selecting the same file later
            }}
          />
          {backupStatus && <span className="muted">{backupStatus}</span>}
        </div>
      </section>

      <section className="settings-section">
        <h2>GitHub PAT</h2>
        <p className="muted">
          Used by Live Folders. Stored only in <code>chrome.storage.local</code> on
          this device.
        </p>
        <p className="muted">
          Status: {hasToken === undefined ? '…' : hasToken ? '✓ token saved' : '— no token'}
        </p>
        <input
          type="password"
          autoComplete="off"
          placeholder="ghp_..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <div className="settings-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!token && !hasToken}
          >
            {token ? 'Save token' : hasToken ? 'Clear token' : 'Save'}
          </button>
          {saved && <span className="muted">Saved.</span>}
        </div>
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
      </section>
    </>
  )
}
