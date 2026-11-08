import { Input, Select } from '../../ui'
import { useGameDefs } from '../useGameDefs'
import { registerParamEditor, type ParamEditorProps } from './registry'

function TemplatePick({ spec, value, onChange }: ParamEditorProps) {
  const defs = useGameDefs(spec.templateKind ?? '')
  const current = typeof value === 'string' ? value : ''
  if (defs.failed) return <Input value={current} onChange={(e) => onChange(e.target.value)} className="font-mono text-[12.5px]" />
  const list = defs.list ?? []
  const missing = current && !list.some((d) => d.id === current) ? [{ value: current, label: `${current} (missing)` }] : []
  return <Select value={current} options={[{ value: '', label: 'None' }, ...missing, ...list.map((d) => ({ value: d.id, label: `${d.name} · ${d.id}` }))]} onChange={onChange} />
}

registerParamEditor('template', { Editor: TemplatePick })
