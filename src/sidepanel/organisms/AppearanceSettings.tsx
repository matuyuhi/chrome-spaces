import { useEffect, useState } from 'react'
import { sendMessage, type UIFontSize } from '../../shared/messaging'
import { applyFontSize, FONT_LABELS, FONT_SCALE } from '../theme'
import { Switch } from '../atoms/Switch'
import { SecondaryButton } from '../atoms/Button'
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
  SizePicker,
  SizeBtn,
} from './SettingsShared'

export function AppearanceSettings() {
  const [fontSize, setFontSize] = useState<UIFontSize>(3)
  const [showAddRowsInNestedFolders, setShowAddRowsInNestedFolders] =
    useState(false)

  useEffect(() => {
    void sendMessage({ type: 'getUIPrefs' }).then((prefs) => {
      setFontSize(prefs.fontSize)
      setShowAddRowsInNestedFolders(prefs.showAddRowsInNestedFolders)
    })
  }, [])

  const handleSize = async (size: UIFontSize) => {
    setFontSize(size)
    applyFontSize(size)
    await sendMessage({ type: 'setUIPrefs', prefs: { fontSize: size } })
  }

  const handleNestedAddRows = async (next: boolean) => {
    setShowAddRowsInNestedFolders(next)
    await sendMessage({
      type: 'setUIPrefs',
      prefs: { showAddRowsInNestedFolders: next },
    })
  }

  return (
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
  )
}
