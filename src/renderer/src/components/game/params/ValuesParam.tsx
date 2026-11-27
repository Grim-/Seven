import { X } from 'lucide-react'
import { Button, CountStepper, Input, Select } from '../../ui'
import { useGameDefs } from '../useGameDefs'
import { registerParamEditor, type ParamEditorProps } from './registry'

type Values = Record<string, number>

function valuesOf(value: unknown): Values {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : {}
}

function ValueRows({ values, names, onChange }: { values: Values; names?: Map<string, string>; onChange: (next: Values) => void }) {
  return Object.entries(values).map(([key, n]) => (
    <div key={key} className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink/90" title={key}>
        {names?.get(key) ?? key}
      </span>
      <CountStepper value={n} min={-999} onChange={(v) => onChange({ ...values, [key]: v })} />
      <Button size="sm" variant="ghost" icon={<X />} title="Remove" onClick={() => onChange(Object.fromEntries(Object.entries(values).filter(([k]) => k !== key)))} />
    </div>
  ))
}

function AddKey({ placeholder, onAdd }: { placeholder: string; onAdd: (key: string) => void }) {
  return (
    <Input
      placeholder={placeholder}
      className="h-8 font-ui text-[12.5px]"
      onKeyDown={(e) => {
        const key = e.currentTarget.value.trim()
        if (e.key !== 'Enter' || !key) return
        onAdd(key)
        e.currentTarget.value = ''
      }}
    />
  )
}

function FreeValues({ value, onChange }: ParamEditorProps) {
  const values = valuesOf(value)
  return (
    <div className="flex flex-col gap-1.5">
      <ValueRows values={values} onChange={onChange} />
      <AddKey placeholder="Add a key, then Enter" onAdd={(key) => onChange({ ...values, [key]: 0 })} />
    </div>
  )
}

export function ValuesEdit(props: ParamEditorProps) {
  return props.spec.templateKind ? <DefValues {...props} /> : <FreeValues {...props} />
}

function DefValues({ spec, value, onChange }: ParamEditorProps) {
  const values = valuesOf(value)
  const defs = useGameDefs(spec.templateKind ?? '')
  const names = new Map((defs.list ?? []).map((d) => [d.id, d.name]))
  const free = (defs.list ?? []).filter((d) => !(d.id in values))
  const add = (id: string) => onChange({ ...values, [id]: 0 })
  return (
    <div className="flex flex-col gap-1.5">
      <ValueRows values={values} names={names} onChange={onChange} />
      {defs.failed ? <AddKey placeholder="Add an id, then Enter" onAdd={add} /> : free.length > 0 && <Select value="" options={[{ value: '', label: 'Add…' }, ...free.map((d) => ({ value: d.id, label: d.name }))]} onChange={(id) => id && add(id)} className="h-8" />}
    </div>
  )
}

registerParamEditor('values', { Editor: ValuesEdit })
