import { describe, expect, it } from 'vitest'
import { detectInsertPosition } from './dnd'

function fakeEvent(opts: {
  clientX: number
  clientY: number
  rect: { left: number; top: number; width: number; height: number }
}) {
  const { clientX, clientY, rect } = opts
  const currentTarget = {
    getBoundingClientRect: () => ({
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }),
  } as unknown as Element
  return { clientX, clientY, currentTarget }
}

describe('detectInsertPosition vertical', () => {
  const rect = { left: 0, top: 100, width: 200, height: 40 }

  it('top quarter → before', () => {
    expect(
      detectInsertPosition(fakeEvent({ clientX: 50, clientY: 110, rect }), 'vertical'),
    ).toBe('before')
  })

  it('bottom quarter → after', () => {
    expect(
      detectInsertPosition(fakeEvent({ clientX: 50, clientY: 135, rect }), 'vertical'),
    ).toBe('after')
  })

  it('exactly on midpoint → after (boundary is exclusive of before)', () => {
    expect(
      detectInsertPosition(fakeEvent({ clientX: 50, clientY: 120, rect }), 'vertical'),
    ).toBe('after')
  })
})

describe('detectInsertPosition horizontal', () => {
  const rect = { left: 50, top: 0, width: 100, height: 30 }

  it('left half → before', () => {
    expect(
      detectInsertPosition(fakeEvent({ clientX: 70, clientY: 10, rect }), 'horizontal'),
    ).toBe('before')
  })

  it('right half → after', () => {
    expect(
      detectInsertPosition(fakeEvent({ clientX: 130, clientY: 10, rect }), 'horizontal'),
    ).toBe('after')
  })

  it('exactly on midpoint → after', () => {
    expect(
      detectInsertPosition(fakeEvent({ clientX: 100, clientY: 10, rect }), 'horizontal'),
    ).toBe('after')
  })
})
