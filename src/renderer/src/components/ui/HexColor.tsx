import { useEffect, useState } from 'react'
import { Input } from './inputs'
import { SliderNumber } from './SliderNumber'

const HEX = /^#[0-9a-fA-F]{6}$/
const HEX_ALPHA = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/

export function HexColor({ value, onChange, alpha = false, disabled = false, placeholder }: { value: string | null; onChange: (v: string) => void; alpha?: boolean; disabled?: boolean; placeholder?: string }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const valid = alpha ? HEX_ALPHA : HEX
  const shown = value ?? placeholder ?? '#000000'
  const tail = alpha && shown.length === 9 ? shown.slice(7) : ''
  const opacity = Math.round((parseInt(tail || 'ff', 16) / 255) * 100)
  const setOpacity = (pct: number) => {
    const a = Math.round((pct / 100) * 255)
    onChange(shown.slice(0, 7) + (a >= 255 ? '' : a.toString(16).padStart(2, '0')))
  }
  return (
    <span className="flex items-center gap-1.5">
      <label title="Pick a colour" className="relative h-7 w-7 shrink-0 cursor-pointer border border-line" style={{ background: shown }}>
        <input type="color" value={shown.slice(0, 7)} disabled={disabled} onChange={(e) => onChange(e.target.value + tail)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
      </label>
      <Input
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        maxLength={alpha ? 9 : 7}
        onChange={(e) => {
          const v = e.target.value.trim()
          setText(v)
          if (valid.test(v)) onChange(v.toLowerCase())
        }}
        onBlur={() => setText(value ?? '')}
        className="h-7 w-[6.5rem] px-2 font-data text-[12px]"
      />
      {alpha && <SliderNumber value={opacity} min={0} max={100} step={1} onChange={setOpacity} className="w-40" />}
    </span>
  )
}
