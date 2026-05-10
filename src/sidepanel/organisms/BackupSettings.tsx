import { useRef, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import { type SpaceStore } from '../../shared/types'
import { SecondaryButton } from '../atoms/Button'
import {
  Card,
  CardHeading,
  Row,
  RowLabel,
  RowTitle,
  RowDesc,
  RowControl,
  MutedText,
} from './SettingsShared'

export function BackupSettings() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [backupStatus, setBackupStatus] = useState<string | undefined>()

  const handleExport = async () => {
    const store = await sendMessage({ type: 'getStore' })
    const liveTabs = await chrome.tabs.query({})
    const liveById = new Map<number, chrome.tabs.Tab>()
    for (const t of liveTabs) {
      if (typeof t.id === 'number') liveById.set(t.id, t)
    }
    const enrichedTabs: typeof store.tabs = {}
    for (const [key, rec] of Object.entries(store.tabs)) {
      const live = liveById.get(Number(key))
      enrichedTabs[Number(key)] = {
        ...rec,
        url: live?.url || live?.pendingUrl || rec.url,
        title: live?.title || rec.title,
      }
    }
    const enrichedStore = { ...store, tabs: enrichedTabs }
    const json = JSON.stringify(enrichedStore, null, 2)
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
        'Replace ALL Spaces with the backup file? Every tab currently open in this window will be closed, and the tabs from the backup will be reopened in their place. All Spaces in the backup are restored into THIS window — multi-window setups collapse to a single window. Live folders will repopulate on the next sync.',
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
    <Card>
      <CardHeading>Backup</CardHeading>

      <Row className="last-row">
        <RowLabel>
          <RowTitle>Export / Import</RowTitle>
          <RowDesc>
            Export saves Spaces, folders, Live configs and a snapshot
            of every tab's URL and title to a JSON file. Import
            replaces the current setup, closes the existing tabs in
            this window, and reopens the saved tabs from their URLs.
            All Spaces are restored into the current window.
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
  )
}
