import { Plus, X } from 'lucide-react'
import type { ComponentType } from 'react'
import type { FieldDef } from '@shared/types'
import { BOOLEAN, CHOICE, FIELD, FIELDS, FILTER, NUMBER, type OptionType, type ViewOptionDef } from '@shared/widgets'
import { Button, Input, Select, Toggle } from '../ui'
import { cn } from '../../lib/cn'

export interface OptionInputProps {
  def: ViewOptionDef
  value: unknown
  fields: FieldDef[]
  onChange: (value: unknown) => void
}

const inputs = new Map<string, ComponentType<OptionInputProps>>()

function registerOptionInput(type: OptionType, input: ComponentType<OptionInputProps>): void {
  inputs.set(type.name, input)
}

export function OptionInput(props: OptionInputProps) {
  const Control = inputs.get(props.def.type.name)
  return Control ? <Control {...props} /> : null
}

function BooleanInput({ value, onChange }: OptionInputProps) {
  return <Toggle checked={value === true} onChange={onChange} label={value === true ? 'Yes' : 'No'} />
}

registerOptionInput(BOOLEAN, BooleanInput)

function NumberInput({ value, onChange }: OptionInputProps) {
  return <Input type="number" min={1} value={typeof value === 'number' ? String(value) : ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} />
}

registerOptionInput(NUMBER, NumberInput)

function ChoiceInput({ def, value, onChange }: OptionInputProps) {
  return (
    <Select
      value={typeof value === 'string' ? value : ''}
      options={[{ value: '', label: 'Automatic' }, ...(def.choices ?? []).map((c) => ({ value: c, label: c }))]}
      onChange={(v) => onChange(v || null)}
    />
  )
}

registerOptionInput(CHOICE, ChoiceInput)

function FieldInput({ def, value, fields, onChange }: OptionInputProps) {
  const usable = def.fieldTypes ? fields.filter((f) => def.fieldTypes!.includes(f.type)) : fields
  return (
    <Select
      value={typeof value === 'string' ? value : ''}
      options={[{ value: '', label: 'Automatic' }, ...usable.map((f) => ({ value: f.name, label: `${f.name} (${f.type})` }))]}
      onChange={(v) => onChange(v || null)}
    />
  )
}

registerOptionInput(FIELD, FieldInput)

function FieldsInput({ value, fields, onChange }: OptionInputProps) {
  const picked = Array.isArray(value) ? (value as string[]) : []
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const on = picked.includes(f.name)
        return (
          <button
            key={f.name}
            type="button"
            onClick={() => onChange(on ? picked.filter((p) => p !== f.name) : [...picked, f.name])}
            className={cn('h-7 border px-2 font-ui text-[11px] transition-colors', on ? 'border-accent bg-accent/15 text-ink' : 'border-line/60 text-dim hover:border-accent hover:text-ink')}
          >
            {f.name}
          </button>
        )
      })}
    </div>
  )
}

registerOptionInput(FIELDS, FieldsInput)

function FilterInput({ value, fields, onChange }: OptionInputProps) {
  const entries = Object.entries(value && typeof value === 'object' ? (value as Record<string, unknown>) : {})
  const set = (next: [string, unknown][]) => onChange(next.length ? Object.fromEntries(next) : null)
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-2">
          <Select value={k} options={fields.map((f) => ({ value: f.name, label: f.name }))} onChange={(nk) => set(entries.map((e, j) => (j === i ? [nk, e[1]] : e)))} className="w-40" />
          <span className="font-ui text-[11px] text-faint">=</span>
          <Input value={String(v ?? '')} onChange={(e) => set(entries.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="flex-1" />
          <button type="button" className="text-dim hover:text-alert" onClick={() => set(entries.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {fields.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus />}
          className="self-start"
          onClick={() => set([...entries, [fields.find((f) => !entries.some(([k]) => k === f.name))?.name ?? fields[0].name, '']])}
        >
          Add condition
        </Button>
      )}
    </div>
  )
}

registerOptionInput(FILTER, FilterInput)
