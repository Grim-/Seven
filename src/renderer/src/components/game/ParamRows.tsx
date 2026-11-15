import type { ParamSchema } from '@shared/game/core/params'
import { Fold, SettingGrid, TunableRow } from '../ui'
import { paramEditor, paramLabel, paramWide } from './params'

type Values = Record<string, unknown>

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function Rows({ schema, keys, values, onChange }: { schema: ParamSchema; keys: string[]; values: Values; onChange: (next: Values) => void }) {
  return <SettingGrid>{keys.map((key) => {
    const spec = schema[key]
    const editor = paramEditor(spec.kind)
    return (
      <TunableRow key={key} label={paramLabel(key, spec)} hint={spec.description} wide={paramWide(editor, spec)} changed={!same(values[key], spec.default)} onReset={() => onChange({ ...values, [key]: spec.default })}>
        {editor ? <editor.Editor spec={spec} value={values[key]} onChange={(v) => onChange({ ...values, [key]: v })} /> : <span className="text-[12px] text-faint">This can't be edited here yet.</span>}
      </TunableRow>
    )
  })}</SettingGrid>
}

export function ParamRows({ schema, keys, values, onChange, moreLabel }: { schema: ParamSchema; keys: string[]; values: Values; onChange: (next: Values) => void; moreLabel: string }) {
  const common = keys.filter((k) => !schema[k].more)
  const more = keys.filter((k) => schema[k].more)
  if (!common.length) return <Rows schema={schema} keys={more} values={values} onChange={onChange} />
  return (
    <>
      <Rows schema={schema} keys={common} values={values} onChange={onChange} />
      {more.length > 0 && (
        <Fold label={moreLabel} count={more.length}>
          <Rows schema={schema} keys={more} values={values} onChange={onChange} />
        </Fold>
      )}
    </>
  )
}
