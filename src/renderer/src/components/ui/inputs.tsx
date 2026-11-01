import { forwardRef, useEffect, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from '../../lib/cn'

const base =
  'w-full border border-line bg-black/60 text-[13.5px] text-white inset-field glow-focus transition-colors placeholder:text-dim/60 hover:border-line-hover disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(base, 'h-9 px-2.5', className)} {...rest} />
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, mono, ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(base, 'min-h-24 resize-y px-2.5 py-2 leading-relaxed', mono && 'font-mono text-[12.5px]', className)}
      {...rest}
    />
  )
})

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[]
  onChange: (value: string) => void
}

export function Select({ options, onChange, className, ...rest }: SelectProps) {
  return (
    <select
      className={cn(base, 'h-9 cursor-pointer appearance-none bg-[length:12px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffc919' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")"
      }}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-card text-white">
          {o.label}
        </option>
      ))}
    </select>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2.5 disabled:opacity-40"
    >
      <span
        className={cn(
          'relative h-5 w-9 border transition-colors',
          checked ? 'border-accent bg-accent/20' : 'border-line bg-black/60'
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-3 w-3 transition-all',
            checked ? 'left-[19px] bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_60%,transparent)]' : 'left-[3px] bg-faint'
          )}
        />
      </span>
      {label && <span className="text-[13px] text-dim group-hover:text-white">{label}</span>}
    </button>
  )
}

interface NumberFieldProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  allowEmpty?: boolean
  className?: string
}

export function NumberField({ value, onChange, min, max, step, placeholder, allowEmpty, className }: NumberFieldProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value))

  useEffect(() => {
    setText(value === undefined ? '' : String(value))
  }, [value])

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      if (allowEmpty) onChange(undefined)
      else setText(value === undefined ? '' : String(value))
      return
    }
    let n = Number(raw)
    if (!Number.isFinite(n)) {
      setText(value === undefined ? '' : String(value))
      return
    }
    if (min !== undefined) n = Math.max(min, n)
    if (max !== undefined) n = Math.min(max, n)
    setText(String(n))
    onChange(n)
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      className={cn('font-mono', className)}
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
      }}
    />
  )
}

interface SliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
}

export function Slider({ value, onChange, min, max, step = 1 }: SliderProps) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 w-full cursor-pointer appearance-none bg-line accent-[var(--color-accent)]"
    />
  )
}

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  shortcut?: string
  className?: string
}

export function SearchBox({ value, onChange, placeholder = 'Search...', shortcut, className }: SearchBoxProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 pr-16" />
      {shortcut && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 border border-cyan/20 bg-cyan/5 px-1.5 py-0.5 font-mono text-[9.5px] tracking-widest text-accent">
          {shortcut}
        </span>
      )}
    </div>
  )
}
