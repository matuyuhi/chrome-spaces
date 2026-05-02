import { describe, it, expect } from 'vitest'
import { diff } from './diff'
import { type ManagedTab } from '../../shared/types'
import { type PullRequestRef } from './sources/github'

const makeManaged = (externalId: string, tabId: number): ManagedTab => ({
  externalId,
  url: `https://github.com/${externalId.replace('#', '/pull/')}`,
  tabId,
  addedAt: 0,
})

const makeRef = (externalId: string): PullRequestRef => {
  const [repo, num] = externalId.split('#')
  return {
    externalId,
    url: `https://github.com/${repo}/pull/${num}`,
    title: `PR ${num}`,
    number: Number(num),
    repo: repo!,
    state: 'open',
    isDraft: false,
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('diff', () => {
  it('classifies all items as toAdd when no managed tabs exist', () => {
    const result = diff([], [makeRef('a/b#1'), makeRef('a/b#2')])
    expect(result.toAdd).toHaveLength(2)
    expect(result.toRemove).toHaveLength(0)
    expect(result.toKeep).toHaveLength(0)
  })

  it('classifies removed items as toRemove', () => {
    const result = diff([makeManaged('a/b#1', 100)], [])
    expect(result.toRemove.map((t) => t.externalId)).toEqual(['a/b#1'])
  })

  it('keeps items present in both', () => {
    const result = diff(
      [makeManaged('a/b#1', 100), makeManaged('a/b#2', 200)],
      [makeRef('a/b#1'), makeRef('a/b#3')],
    )
    expect(result.toKeep.map((p) => p.managed.externalId)).toEqual(['a/b#1'])
    expect(result.toAdd.map((r) => r.externalId)).toEqual(['a/b#3'])
    expect(result.toRemove.map((t) => t.externalId)).toEqual(['a/b#2'])
  })
})
