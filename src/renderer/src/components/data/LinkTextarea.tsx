import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import { referencesIn } from '@shared/text'
import { Textarea } from '../ui'
import { textareaClass } from '../ui/inputs'
import { Pressable } from '../ui/Pressable'
import { cn } from '../../lib/cn'
import { useRolls } from './useRolls'
import { FloatingHints, useReferenceHints } from '../chat/Commands'
import { withReferences } from '../chat/References'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onValue: (text: string) => void
  mono?: boolean
  rolls?: boolean
}

export const LinkTextarea = forwardRef<HTMLTextAreaElement | null, Props>(function LinkTextarea({ value, onValue, onKeyDown, onSelect, onBlur, mono, rolls = true, ...rest }, ref) {
  const box = useRef<HTMLTextAreaElement>(null)
  const area = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => box.current as HTMLTextAreaElement)
  const [editing, setEditing] = useState(Boolean(rest.autoFocus))
  const [caret, setCaret] = useState(0)
  const [pick, setPick] = useState(0)
  const [hiddenAt, setHiddenAt] = useState<string | null>(null)
  const found = useReferenceHints(value.slice(0, caret), (next) => {
    onValue(next + value.slice(caret))
    setCaret(next.length)
    requestAnimationFrame(() => {
      box.current?.focus()
      box.current?.setSelectionRange(next.length, next.length)
    })
  })
  const keys = found.map((h) => h.key).join('|')
  useEffect(() => setPick(0), [keys])
  const hints = hiddenAt !== `${caret}:${keys}` ? found : []
  const current = Math.min(pick, Math.max(0, hints.length - 1))

  const roll = useRolls(rolls, value, onValue)
  const showChips = !editing && referencesIn(value).length > 0

  const edit = () => {
    if (rest.disabled || rest.readOnly) return
    setEditing(true)
    requestAnimationFrame(() => {
      box.current?.focus()
      box.current?.setSelectionRange(value.length, value.length)
    })
  }

  const keys2 = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (hints.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setPick((current + (e.key === 'ArrowDown' ? 1 : hints.length - 1)) % hints.length)
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        hints[current].apply()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setHiddenAt(`${caret}:${keys}`)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div ref={area} className="flex min-h-0 flex-1 flex-col gap-1">
      {showChips && (
        <Pressable onClick={edit} title={rest.title} className={textareaClass(mono, cn('cursor-text overflow-y-auto whitespace-pre-wrap', rest.className))}>
          {withReferences(value)}
        </Pressable>
      )}
      {!showChips && <FloatingHints anchor={area} hints={hints} selected={current} onSelect={setPick} onClose={() => setHiddenAt(`${caret}:${keys}`)} />}
      <Textarea
        {...rest}
        ref={box}
        mono={mono}
        value={value}
        onChange={(e) => {
          onValue(e.target.value)
          setCaret(e.target.selectionStart ?? e.target.value.length)
          roll(e.target.value)
        }}
        onSelect={(e) => {
          setCaret(e.currentTarget.selectionStart ?? 0)
          onSelect?.(e)
        }}
        onFocus={(e) => {
          setEditing(true)
          rest.onFocus?.(e)
        }}
        onBlur={(e) => {
          setEditing(false)
          onBlur?.(e)
        }}
        onKeyDown={keys2}
        className={cn(rest.className, showChips && 'hidden')}
      />
    </div>
  )
})
