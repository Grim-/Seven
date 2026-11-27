import { Plus } from 'lucide-react'

export function SetBoxes({ values, hints = [], onChange }: { values: string[]; hints?: number[]; onChange: (values: string[]) => void }) {
  const count = Math.max(values.length, hints.length, 1)
  const set = (i: number, v: string) => {
    const next = Array.from({ length: count }, (_, j) => values[j] ?? '')
    next[i] = v.replace(/[^\d.]/g, '')
    onChange(next)
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <input
          key={i}
          value={values[i] ?? ''}
          inputMode="decimal"
          placeholder={hints[i] !== undefined ? String(hints[i]) : '—'}
          title={`Set ${i + 1}`}
          onChange={(e) => set(i, e.target.value)}
          className="h-8 w-14 border border-line/50 tone-well-60 px-1.5 text-center font-ui text-[13px] text-ink outline-none placeholder:text-faint/60 focus:border-accent/70"
        />
      ))}
      <button title="Add a set" onClick={() => onChange([...Array.from({ length: count }, (_, j) => values[j] ?? ''), ''])} className="flex h-8 items-center gap-1 border border-dashed border-line/50 px-2 text-[11.5px] text-faint hover:border-accent/60 hover:text-accent">
        <Plus className="h-3 w-3" /> set
      </button>
    </div>
  )
}

export function numbersOf(values: string[]): number[] {
  return values.map((v) => v.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n >= 0)
}
