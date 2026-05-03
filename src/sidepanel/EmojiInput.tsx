import { useEffect, useState } from 'react'

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
    <div className="emoji-row">
      <input
        className="emoji-input"
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
        <button
          className="btn-link"
          onClick={() => {
            setValue('')
            onChange(undefined)
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}
