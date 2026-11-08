import { X } from 'lucide-react'
import { Button, Input, NumberField, Select } from '../../ui'
import { useGameDefs } from '../useGameDefs'
import { registerParamEditor, type ParamEditorProps } from './registry'

function ValuesEdit({ spec, value, onChange }: ParamEditorProps) {
  const values = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, number>) : {}
  const defs = useGameDefs(spec.templateKind ?? '')
  const names = new Map((defs.list ?? []).map((d) => [d.id, d.name]))
  const set = (next: Record<string, number>) => onChange(next)
  const free = (defs.list ?? []).filter((d) => !(d.id in values))
  return (
    <div className="flex flex-col gap-1.5">
      {Object.entries(values).map(([key, n]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/90" title={key}>
            {names.get(key) ?? key}
          </span>
          <NumberField value={n} onChange={(v) => set({ ...values, [key]: v ?? 0 })} className="h-8 w-24" />
          <Button size="sm" variant="ghost" icon={<X />} title="Remove" onClick={() => set(Object.fromEntries(Object.entries(values).filter(([k]) => k !== key)))} />
        </div>
      ))}
      {defs.failed || !spec.templateKind ? (
        <Input
          placeholder="Add an id, then Enter"
          className="h-8 font-mono text-[12.5px]"
          onKeyDown={(e) => {
            const id = e.currentTarget.value.trim()
            if (e.key !== 'Enter' || !id) return
            set({ ...values, [id]: 0 })
            e.currentTarget.value = ''
          }}
        />
      ) : (
        free.length > 0 && <Select value="" options={[{ value: '', label: 'Add…' }, ...free.map((d) => ({ value: d.id, label: d.name }))]} onChange={(id) => id && set({ ...values, [id]: 0 })} className="h-8" />
      )}
    </div>
  )
}

registerParamEditor('values', { Editor: ValuesEdit })
