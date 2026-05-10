import { AppearanceSettings } from './AppearanceSettings'
import { BackupSettings } from './BackupSettings'
import { GitHubSettings } from './GitHubSettings'
import { PageHeader, BackBtn, PageTitle, CardList } from './SettingsShared'
import { TabsSettings } from './TabsSettings'

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader>
        <BackBtn onClick={onClose}>← Back</BackBtn>
        <PageTitle>Settings</PageTitle>
      </PageHeader>

      <CardList>
        <AppearanceSettings />
        <TabsSettings />
        <GitHubSettings />
        <BackupSettings />
      </CardList>
    </>
  )
}
