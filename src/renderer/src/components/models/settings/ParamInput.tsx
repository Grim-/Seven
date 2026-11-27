import type { ParamDef, ThinkingLevel } from '@shared/types'
import { fileList, fileListText } from '@shared/modelParams'
import { FileField, FileListField, Input, NumberField, Select, SliderNumber, Toggle } from '../../ui'
import { thinkingLabel } from '../../../lib/thinking'

function optionLabel(def: ParamDef, o: string): string {
  return def.key === 'thinking' ? thinkingLabel(o as ThinkingLevel) : o
}

export function ParamInput({ def, value, onChange }: { def: ParamDef; value: number | boolean | string; onChange: (v: number | boolean | string) => void }) {
  if (def.type === 'bool') return <Toggle checked={value === true} onChange={onChange} label={value ? 'On' : 'Off'} />
  if (def.type === 'select') return <Select value={String(value)} options={(def.options ?? []).map((o) => ({ value: o, label: optionLabel(def, o) }))} onChange={onChange} className="h-7 w-36 text-[12px]" />
  if (def.type === 'text') return <Input value={String(value)} onChange={(e) => onChange(e.target.value)} className="h-7 w-72 font-ui text-[12px]" />
  if (def.type === 'file') return <FileField value={String(value)} onChange={onChange} filters={def.files ? [def.files] : []} />
  if (def.type === 'files') return <FileListField items={fileList(value)} onChange={(items) => onChange(fileListText(items))} filters={def.files ? [def.files] : []} />
  const min = def.min ?? 0
  const max = def.max ?? 100
  const step = def.step ?? 1
  if ((max - min) / step <= 4000) return <SliderNumber value={Number(value)} min={min} max={max} step={step} onChange={onChange} />
  return <NumberField value={value as number} onChange={(v) => v !== undefined && onChange(v)} min={def.min} max={def.max} step={def.step} className="h-7 w-32 text-[12px]" />
}

