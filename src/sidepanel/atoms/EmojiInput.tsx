import styled from '@emotion/styled'
import { useEffect, useState } from 'react'
import { tokens } from '../theme'
import { LinkButton } from './Button'

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px 6px;
`

const Input = styled.input`
  width: 44px;
  text-align: center;
  font-size: 14px;
  padding: 4px 6px;
  background: ${tokens.bg};
  color: ${tokens.fg};
  border: 1px solid ${tokens.border};
  border-radius: ${tokens.radius.md};
  outline: none;

  &:focus {
    border-color: ${tokens.accent};
  }
`

function firstGrapheme(input: string): string {
  if (!input) return ''
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const first = seg.segment(input)[Symbol.iterator]().next().value
  return first?.segment ?? ''
}

export function EmojiInput({
  initial,
  onChange,
}: {
  initial: string | undefined
  onChange: (emoji: string | undefined) => void
}) {
  const [value, setValue] = useState(initial ?? '')
  useEffect(() => setValue(initial ?? ''), [initial])
  return (
    <Row>
      <Input
        value={value}
        placeholder="🚀"
        onChange={(e) => setValue(firstGrapheme(e.target.value))}
        onBlur={(e) => {
          const v = firstGrapheme(e.target.value.trim())
          onChange(v === '' ? undefined : v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {initial && (
        <LinkButton
          onClick={() => {
            setValue('')
            onChange(undefined)
          }}
        >
          Clear
        </LinkButton>
      )}
    </Row>
  )
}
