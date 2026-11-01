import { cn } from '../../lib/cn'

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex border border-line/60">
      {options.map((o) => (
        <button
          key={o.value}
          title={o.hint}
          onClick={() => o.value !== value && onChange(o.value)}
          className={cn('flex-1 px-3 py-1.5 text-[12px] transition-colors', o.value === value ? 'bg-accent/15 text-white shadow-[inset_0_-2px_0_rgb(255,201,25)]' : 'text-dim hover:bg-white/[0.04] hover:text-white')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

