import { describe, it, expect, beforeEach } from 'vitest'
import { getUIPrefs, setUIPrefs } from './ui-prefs'
import { DEFAULT_UI_PREFS } from '../shared/messaging'
import { setupChromeMock } from './test-utils'

describe('ui-prefs', () => {
  let mockLocal: Record<string, unknown>

  beforeEach(() => {
    const mock = setupChromeMock()
    mockLocal = mock.local
  })

  describe('getUIPrefs', () => {
    it('returns default preferences when nothing is stored', async () => {
      const prefs = await getUIPrefs()
      expect(prefs).toEqual(DEFAULT_UI_PREFS)
    })

    it('merges stored preferences with defaults', async () => {
      mockLocal.uiPrefs = { fontSize: 5, unknownKey: 'ignored' }
      const prefs = await getUIPrefs()
      expect(prefs).toEqual({
        ...DEFAULT_UI_PREFS,
        fontSize: 5,
        unknownKey: 'ignored'
      })
    })

    it('handles partially stored preferences', async () => {
      mockLocal.uiPrefs = { autoArchiveDays: 7 }
      const prefs = await getUIPrefs()
      expect(prefs).toEqual({
        ...DEFAULT_UI_PREFS,
        autoArchiveDays: 7
      })
    })
  })

  describe('setUIPrefs', () => {
    it('merges new preferences with defaults when nothing is stored', async () => {
      await setUIPrefs({ fontSize: 1 })

      const stored = mockLocal.uiPrefs
      expect(stored).toEqual({
        ...DEFAULT_UI_PREFS,
        fontSize: 1
      })

      const prefs = await getUIPrefs()
      expect(prefs).toEqual({
        ...DEFAULT_UI_PREFS,
        fontSize: 1
      })
    })

    it('merges new preferences with existing stored preferences', async () => {
      mockLocal.uiPrefs = { autoArchiveDays: 14 }

      await setUIPrefs({ fontSize: 2, showAddRowsInNestedFolders: true })

      const stored = mockLocal.uiPrefs
      expect(stored).toEqual({
        ...DEFAULT_UI_PREFS,
        autoArchiveDays: 14,
        fontSize: 2,
        showAddRowsInNestedFolders: true
      })
    })

    it('can override previously set preferences', async () => {
      mockLocal.uiPrefs = { fontSize: 4 }

      await setUIPrefs({ fontSize: 5 })

      const stored = mockLocal.uiPrefs
      expect(stored).toEqual({
        ...DEFAULT_UI_PREFS,
        fontSize: 5
      })
    })
  })
})
