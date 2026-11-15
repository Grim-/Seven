import type { ParamSchema, ParamSpec } from '@shared/game/core/params'
import { EffectTokenButton } from './effects/EffectTokenButton'
import { paramEditor, paramLabel, paramWide } from './params'
import { effectToken } from './effects/tokens'

export function shownInline(spec: ParamSpec): boolean {
  const editor = paramEditor(spec.kind)
  return Boolean(editor && !effectToken(spec.kind) && paramWide(editor, spec))
}

const same = (a: string, b?: string): boolean => !!b && a.toLowerCase() === b.toLowerCase()

export function ParamTokens({ schema, values, onChange, title }: { schema: ParamSchema; values: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void; title?: string }) {
  const set = (key: string) => (v: unknown) => onChange({ ...values, [key]: v })
  const entries = Object.entries(schema)
  const chips = entries.filter(([, spec]) => !shownInline(spec))
  const blocks = entries.filter(([, spec]) => shownInline(spec))
  const label = (key: string, spec: ParamSpec) =>
    same(paramLabel(key, spec), title) ? null : (
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim" title={spec.description}>
        {paramLabel(key, spec)}
      </span>
    )
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 [--tone:var(--color-accent)]">
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {chips.map(([key, spec]) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              {label(key, spec)}
              <EffectTokenButton name={key} spec={spec} value={values[key] ?? spec.default} onChange={set(key)} />
            </span>
          ))}
        </div>
      )}
      {blocks.map(([key, spec]) => {
        const editor = paramEditor(spec.kind)
        return editor ? (
          <div key={key} className="flex min-w-0 flex-col gap-1.5">
            {label(key, spec)}
            <editor.Editor spec={spec} value={values[key]} onChange={set(key)} />
          </div>
        ) : null
      })}
    </div>
  )
}
