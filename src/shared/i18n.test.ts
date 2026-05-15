import { describe, expect, it } from 'vitest'
import { plural, applyI18nSubs, t } from './i18n'

describe('i18n', () => {
  describe('applyI18nSubs', () => {
    it('returns template if no substitutions are provided', () => {
      expect(applyI18nSubs('Hello')).toBe('Hello')
    })

    it('replaces $1 with substitution', () => {
      expect(applyI18nSubs('Hello $1', 'World')).toBe('Hello World')
    })

    it('replaces multiple substitutions', () => {
      expect(applyI18nSubs('$1 $2', ['Hello', 'World'])).toBe('Hello World')
    })

    it('handles out of bounds indices', () => {
      expect(applyI18nSubs('$1 $2', ['Hello'])).toBe('Hello ')
    })
  })

  describe('t', () => {
    it('returns message from en fallback', () => {
      expect(t('header_newSpace')).toBe('New Space')
    })

    it('applies substitutions', () => {
      expect(t('orphan_count_one', 1)).toBe('1 tab not in any Space')
      expect(t('orphan_count_other', [5])).toBe('5 tabs not in any Space')
    })

    it('falls back to key if not found', () => {
      // @ts-expect-error Testing invalid key
      expect(t('invalid_key_that_does_not_exist')).toBe('invalid_key_that_does_not_exist')
    })
  })

  describe('plural', () => {
    it('uses singular key when count is 1', () => {
      expect(plural(1, 'orphan_count_one', 'orphan_count_other')).toBe('1 tab not in any Space')
    })

    it('uses other key when count is not 1', () => {
      expect(plural(0, 'orphan_count_one', 'orphan_count_other')).toBe('0 tabs not in any Space')
      expect(plural(2, 'orphan_count_one', 'orphan_count_other')).toBe('2 tabs not in any Space')
      expect(plural(-1, 'orphan_count_one', 'orphan_count_other')).toBe('-1 tabs not in any Space')
    })

    it('passes substitutions array overriding default count', () => {
      expect(plural(1, 'orphan_addToCurrent_title_one', 'orphan_addToCurrent_title_other', [1, 'Work'])).toBe('Add 1 tab to "Work"')
      expect(plural(3, 'orphan_addToCurrent_title_one', 'orphan_addToCurrent_title_other', [3, 'Work'])).toBe('Add 3 tabs to "Work"')
    })

    it('passes specific string as substitution', () => {
      expect(plural(2, 'header_convertGroups_one', 'header_convertGroups_other', 'Two')).toBe('Convert Two Chrome Tab Groups to Spaces')
    })
  })
})
