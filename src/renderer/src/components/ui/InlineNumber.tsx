import { InlineEdit } from './InlineEdit'
import { cn } from '../../lib/cn'

export function InlineNumber({ value, onSave, min = -Infinity, max = Infinity, title, className }: { value: number; onSave: (next: number) => void; min?: number; max?: number; title?: string; className?: string }) {
  return (
    <InlineEdit
      value={String(value)}
      numeric
      required
      title={title}
      className={cn('font-data', className)}
      onSave={(text) => {
        const n = Math.round(Number(text))
        if (Number.isFinite(n)) onSave(Math.min(max, Math.max(min, n)))
      }}
    />
  )
}
