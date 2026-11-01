import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import { Textarea } from '../ui'
import { useRolls } from './useRolls'
import { ComposerHints, useReferenceHints } from '../chat/Commands'


type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onValue: (text: string) => void
  mono?: boolean
  rolls?: boolean
}

export const LinkTextarea = forwardRef<HTMLTextAreaElement | null, Props>(function LinkTextarea({ value, onValue, onKeyDown, onSelect, mono, rolls = true, ...rest }, ref) {
  const box = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => box.current as HTMLTextAreaElement)
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
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <ComposerHints hints={hints} selected={current} onSelect={setPick} inline />
      <Textarea
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
        onKeyDown={keys2}
        {...rest}
      />
    </div>
  )
})
