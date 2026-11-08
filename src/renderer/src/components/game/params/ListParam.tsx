import { Plus, X } from 'lucide-react'
import { Button } from '../../ui'
import { paramEditor, registerParamEditor, type ParamEditorProps } from './registry'

function ListEdit({ spec, value, onChange }: ParamEditorProps) {
  const list = Array.isArray(value) ? value : []
  const of = spec.of
  const item = of ? paramEditor(of.kind) : null
  if (!of || !item) return <span className="text-[12px] text-faint">This list can't be edited here yet.</span>
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <item.Editor spec={of} value={entry} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} />
          </div>
          <Button size="sm" variant="ghost" icon={<X />} title="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button size="sm" variant="ghost" icon={<Plus />} className="self-start" onClick={() => onChange([...list, of.default])}>
        Add
      </Button>
    </div>
  )
}

registerParamEditor('list', { Editor: ListEdit })
