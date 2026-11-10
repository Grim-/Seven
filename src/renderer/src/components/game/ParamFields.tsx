import type { ParamSchema } from '@shared/game/core/params'
import { Field, FieldGrid } from '../ui'
import { cn } from '../../lib/cn'
import { paramEditor, paramLabel, paramWide } from './params'

export function ParamFields({ schema, values, onChange, dense = false }: { schema: ParamSchema; values: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void; dense?: boolean }) {
  return (
    <FieldGrid dense={dense}>
      {Object.entries(schema).map(([key, spec]) => {
        const editor = paramEditor(spec.kind)
        return (
          <Field key={key} label={paramLabel(key, spec)} hint={dense ? undefined : spec.description} tip={dense ? spec.description : undefined} group className={cn(paramWide(editor, spec) && 'col-span-full')}>
            {editor ? <editor.Editor spec={spec} value={values[key]} onChange={(v) => onChange({ ...values, [key]: v })} /> : <span className="text-[12px] text-faint">This can't be edited here yet.</span>}
          </Field>
        )
      })}
    </FieldGrid>
  )
}
