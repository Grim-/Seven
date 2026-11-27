import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { FIELD_TYPES, type FieldType } from '@shared/types'
import { cn } from '../../../lib/cn'
import { FIELD_TYPE_INFO } from './fieldTypes'

export function FieldTypePicker({ value, onChange }: { value: FieldType; onChange: (type: FieldType) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const info = FIELD_TYPE_INFO[value]
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-9 w-36 items-center gap-2 border border-line tone-well-60 px-2.5 text-[12.5px] text-ink hover:border-accent/60">
        <span className="text-accent-soft">{info.icon}</span>
        <span className="flex-1 text-left">{info.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-dim" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-0.5 w-72 border border-line tone-panel-95 py-1 shadow-lg">
          {FIELD_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => {
                onChange(t)
                setOpen(false)
              }}
              className={cn('flex w-full items-start gap-2.5 px-2.5 py-1.5 text-left', t === value ? 'bg-accent/15' : 'hover:bg-ink/[0.04]')}
            >
              <span className="mt-0.5 text-accent-soft">{FIELD_TYPE_INFO[t].icon}</span>
              <span className="flex flex-col">
                <span className="text-[12.5px] text-ink">{FIELD_TYPE_INFO[t].label}</span>
                <span className="text-[11px] text-dim">{FIELD_TYPE_INFO[t].description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
