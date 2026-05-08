import { describe, expect, it } from 'vitest'
import {
  defaultCustomQueryFor,
  placeholderQueryFor,
  presetToSource,
  sourceToPreset,
} from './liveFolderPreset'

const empty = { user: '', customQuery: '', repoFilter: '', rssUrl: '' }

describe('presetToSource', () => {
  it('maps pr-review-requested with user + repoFilter', () => {
    expect(
      presetToSource('pr-review-requested', {
        ...empty,
        user: ' alice ',
        repoFilter: ' org:acme ',
      }),
    ).toEqual({
      type: 'github-prs',
      preset: 'review-requested',
      user: 'alice',
      repoFilter: 'org:acme',
    })
  })

  it('maps pr-assigned without user → user undefined', () => {
    expect(presetToSource('pr-assigned', empty)).toEqual({
      type: 'github-prs',
      preset: 'assigned',
      user: undefined,
      repoFilter: undefined,
    })
  })

  it('maps pr-custom with query', () => {
    expect(
      presetToSource('pr-custom', { ...empty, customQuery: ' is:pr is:open ' }),
    ).toEqual({
      type: 'github-prs',
      preset: 'custom',
      query: 'is:pr is:open',
    })
  })

  it('returns undefined when pr-custom has no query', () => {
    expect(presetToSource('pr-custom', empty)).toBeUndefined()
  })

  it('maps issue-mentioned', () => {
    expect(
      presetToSource('issue-mentioned', { ...empty, user: 'bob' }),
    ).toEqual({
      type: 'github-issues',
      preset: 'mentioned',
      user: 'bob',
      repoFilter: undefined,
    })
  })

  it('returns undefined when issue-custom has no query', () => {
    expect(presetToSource('issue-custom', empty)).toBeUndefined()
  })

  it('maps rss when URL provided', () => {
    expect(
      presetToSource('rss', { ...empty, rssUrl: ' https://x.test/feed.xml ' }),
    ).toEqual({ type: 'rss', url: 'https://x.test/feed.xml' })
  })

  it('returns undefined when rss URL empty', () => {
    expect(presetToSource('rss', empty)).toBeUndefined()
  })
})

describe('sourceToPreset', () => {
  it('falls back to pr-review-requested when no source', () => {
    expect(sourceToPreset(undefined)).toBe('pr-review-requested')
  })

  it('maps github-prs preset → pr-<preset>', () => {
    expect(
      sourceToPreset({ type: 'github-prs', preset: 'assigned' }),
    ).toBe('pr-assigned')
  })

  it('maps github-prs custom → pr-custom', () => {
    expect(
      sourceToPreset({ type: 'github-prs', preset: 'custom', query: 'x' }),
    ).toBe('pr-custom')
  })

  it('maps github-issues preset → issue-<preset>', () => {
    expect(
      sourceToPreset({ type: 'github-issues', preset: 'mentioned' }),
    ).toBe('issue-mentioned')
  })

  it('maps github-issues custom → issue-custom', () => {
    expect(
      sourceToPreset({ type: 'github-issues', preset: 'custom', query: 'y' }),
    ).toBe('issue-custom')
  })

  it('maps rss', () => {
    expect(sourceToPreset({ type: 'rss', url: 'https://x.test' })).toBe('rss')
  })
})

describe('defaultCustomQueryFor / placeholderQueryFor', () => {
  it('issue-custom uses is:issue', () => {
    expect(defaultCustomQueryFor('issue-custom')).toContain('is:issue')
    expect(placeholderQueryFor('issue-custom')).toContain('is:issue')
  })

  it('non-issue presets use is:pr', () => {
    expect(defaultCustomQueryFor('pr-custom')).toContain('is:pr')
    expect(placeholderQueryFor('pr-custom')).toContain('is:pr')
  })
})
