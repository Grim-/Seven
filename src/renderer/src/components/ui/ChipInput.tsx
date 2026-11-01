import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { SuggestList, useSuggest } from './Suggest'

export function ChipInput({
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add',
  prefix = '',
  normalize = (raw) => raw.trim()
}: {
  value: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  placeholder?: string
  prefix?: string
  normalize?: (raw: string) => string
}) {
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const q = normalize(text)
  const { options, pick, current, move } = useSuggest(suggestions, q, value)
  const add = (raw: string) => {
    const items = raw.split(/[,\n]/).map(normalize).filter(Boolean)
    const next = [...value, ...items.filter((t) => !value.includes(t))]
    if (next.length !== value.length) onChange([...new Set(next)])
    setText('')
  }
  return (
    <div className="relative">
      <div
        onClick={() => input.current?.focus()}
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 border bg-black/60 px-1.5 py-1',
          focus ? 'border-accent/60' : 'border-line'
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 border border-accent/40 bg-accent/10 py-0.5 pl-1.5 pr-0.5 font-mono text-[11.5px] text-white"
          >
            {prefix}
            {t}
            <button
              title={`Remove ${prefix}${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="flex h-4 w-4 items-center justify-center text-dim hover:text-alert"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false)
            if (q) add(text)
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            if (/[,\n]/.test(pasted)) {
              e.preventDefault()
              add(pasted)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
              if (!q && !(e.key === 'Enter' && current)) return
              e.preventDefault()
              add(current && e.key !== ',' ? current : text)
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
            else if (!move(e) && e.key === 'Escape') setText('')
          }}
          placeholder={value.length ? '' : placeholder}
          className="h-6 min-w-[8ch] flex-1 bg-transparent px-1 text-[12.5px] text-white outline-none placeholder:text-dim/60"
        />
      </div>
      {focus && (
        <SuggestList
          options={options}
          pick={pick}
          onPick={add}
          prefix={prefix}
          className="right-0"
        />
      )}
    </div>
  )
}

export function cleanTag(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '_')
}

export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Add a tag'
}: {
  value: string[]
  onChange: (next: string[]) => void
  suggestions?: string[]
  placeholder?: string
}) {
  return (
    <ChipInput
      value={value}
      onChange={onChange}
      suggestions={suggestions}
      placeholder={placeholder}
      prefix="#"
      normalize={cleanTag}
    />
  )
}
