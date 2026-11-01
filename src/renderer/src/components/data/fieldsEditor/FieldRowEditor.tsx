import { X } from 'lucide-react'
import { ChipInput, Input, Toggle } from '../../ui'
import { FieldTypePicker } from './FieldTypePicker'
import type { FieldRow } from './fieldChanges'

export function FieldRowEditor({ row, onChange, onRemove }: { row: FieldRow; onChange: (patch: Partial<FieldRow>) => void; onRemove: () => void }) {
  const renamed = row.original && row.name.trim() && row.original.name !== row.name.trim()
  const retyped = row.original && row.original.type !== row.type
  return (
    <div className="group flex flex-col gap-2 border border-line/40 bg-black/40 p-2.5">
      <div className="flex items-center gap-2">
        <Input value={row.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Field name, e.g. priority" className="flex-1" />
        <FieldTypePicker value={row.type} onChange={(type) => onChange({ type })} />
        <Toggle checked={row.required} onChange={(required) => onChange({ required })} label="Required" />
        <button title="Remove this field" onClick={onRemove} className="flex h-8 w-8 items-center justify-center text-dim hover:text-alert">
          <X className="h-4 w-4" />
        </button>
      </div>
      {row.type === 'select' && <ChipInput value={row.options} onChange={(options) => onChange({ options })} placeholder="Options: type one and press Enter, e.g. low, medium, high" />}
      {(renamed || retyped) && (
        <div className="font-mono text-[10.5px] text-faint">
          {renamed ? `was ${row.original!.name}` : ''}
          {renamed && retyped ? ' · ' : ''}
          {retyped ? `items are converted from ${row.original!.type}; ones that don't fit stop the save` : ''}
        </div>
      )}
    </div>
  )
}
