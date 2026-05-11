import { useEffect, useState } from 'react'
import { sendMessage } from '../../shared/messaging'
import {
  Card,
  CardHeading,
  Row,
  RowLabel,
  RowTitle,
  RowDesc,
  RowControl,
  NumberInput,
  MutedText,
} from './SettingsShared'

export function TabsSettings() {
  const [autoArchiveDays, setAutoArchiveDays] = useState(0)
  const [archiveSavedAt, setArchiveSavedAt] = useState<number | undefined>()

  useEffect(() => {
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) => {
      setAutoArchiveDays(prefs.autoArchiveDays)
    })
  }, [])

  const handleArchiveDays = async (raw: string) => {
    const n = Math.max(0, Math.min(365, Math.floor(Number(raw) || 0)))
    setAutoArchiveDays(n)
    await sendMessage({ type: 'setUIPrefs', prefs: { autoArchiveDays: n } })
    setArchiveSavedAt(Date.now())
    setTimeout(() => setArchiveSavedAt(undefined), 1500)
  }

  return (
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
  )
}
