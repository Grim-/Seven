import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface TokenTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onValue: (value: string) => void
  tokens: { value: string; label?: string; hint?: string }[]
  open?: string
  close?: string
}

export const TokenTextarea = forwardRef<HTMLTextAreaElement | null, TokenTextareaProps>(function TokenTextarea({ value, onValue, tokens, open = '{', close = '}', className, onKeyDown, onBlur, ...rest }, ref) {
  const box = useRef<HTMLTextAreaElement | null>(null)
  useImperativeHandle(ref, () => box.current as HTMLTextAreaElement, [])
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null)
  const [pick, setPick] = useState(0)
  const matches = useMemo(() => (query ? tokens.filter((t) => !query.text || t.value.toLowerCase().includes(query.text.toLowerCase()) || t.label?.toLowerCase().includes(query.text.toLowerCase())).slice(0, 8) : []), [query, tokens])
  const look = (el: HTMLTextAreaElement) => {
    const at = el.selectionStart ?? 0
    const before = el.value.slice(0, at)
    const start = before.lastIndexOf(open)
    if (start === -1 || before.slice(start).includes(close) || /\s/.test(before.slice(start + open.length))) return setQuery(null)
    setQuery({ start, text: before.slice(start + open.length) })
    setPick(0)
  }
  const insert = (token: string) => {
    const el = box.current
    if (!el || !query) return
    const at = el.selectionStart ?? value.length
    const next = `${value.slice(0, query.start)}${open}${token}${close}${value.slice(at)}`
    const caret = query.start + open.length + token.length + close.length
    onValue(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }
  return (
    <div className="relative">
      <textarea
        ref={box}
        value={value}
        onChange={(e) => {
          onValue(e.target.value)
          look(e.target)
        }}
        onClick={(e) => look(e.currentTarget)}
        onKeyDown={(e) => {
          if (query && matches.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setPick((p) => (p + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              insert(matches[pick].value)
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setQuery(null)
              return
            }
          }
          onKeyDown?.(e)
        }}
        onBlur={(e) => {
          setQuery(null)
          onBlur?.(e)
        }}
        className={cn('w-full resize-y border border-line tone-well-60 px-2.5 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-dim/60 focus:border-accent/60', className)}
        {...rest}
      />
      {query && matches.length > 0 && (
        <div className="absolute left-2 right-2 top-full z-30 -mt-1 border border-accent/60 tone-panel-95 py-0.5 shadow-lg">
          {matches.map((m, i) => (
            <button
              key={m.value}
              onMouseDown={(e) => {
                e.preventDefault()
                insert(m.value)
              }}
              className={cn('flex w-full items-baseline gap-2 px-2.5 py-1 text-left', i === pick ? 'bg-accent/15' : 'hover:bg-ink/[0.04]')}
            >
              <span className="font-ui text-[12px] text-ink">
                {open}
                {m.value}
                {close}
              </span>
              {m.hint && <span className="truncate text-[11px] text-dim">{m.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
