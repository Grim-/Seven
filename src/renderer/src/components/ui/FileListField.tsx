import { Plus, X } from 'lucide-react'
import type { WeightedFile } from '@shared/modelParams'
import { Button } from './Button'
import { NumberField } from './inputs'
import { fileName, pickFile, type FileFilter } from './FileField'

export function FileListField({ items, onChange, filters, min = -4, max = 4, step = 0.05 }: { items: WeightedFile[]; onChange: (items: WeightedFile[]) => void; filters: FileFilter[]; min?: number; max?: number; step?: number }) {
  const change = (i: number, patch: Partial<WeightedFile>) => onChange(items.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  return (
    <div className="flex w-full flex-col gap-1">
      {items.map((f, i) => (
        <div key={`${f.path}-${i}`} className="flex items-center gap-1.5">
          <span title={f.path} className="min-w-0 flex-1 truncate font-mono text-[12px] text-white">
            {fileName(f.path)}
          </span>
          <NumberField value={f.scale} min={min} max={max} step={step} onChange={(v) => v !== undefined && change(i, { scale: v })} className="h-7 w-20 text-[12px]" />
          <Button size="sm" variant="ghost" icon={<X />} title="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => pickFile(filters, (path) => onChange([...items, { path, scale: 1 }]))}>
          Add file
        </Button>
      </div>
    </div>
  )
}
