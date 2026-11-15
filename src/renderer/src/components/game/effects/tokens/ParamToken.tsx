import { paramEditor } from '../../params'
import type { EffectToken, TokenEditProps, TokenProps } from './registry'

function shownOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.every((v) => typeof v === 'string' || typeof v === 'number') ? value.join(', ') : `${value.length}`
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k} ${String(v)}`).join(', ')
  return ''
}

function Text({ value }: TokenProps) {
  return <>{shownOf(value) || 'none'}</>
}

function Edit({ spec, value, onChange }: TokenEditProps) {
  const editor = paramEditor(spec.kind)
  return editor ? <editor.Editor spec={spec} value={value} onChange={onChange} /> : <span className="text-[12px] text-faint">This can't be edited here yet.</span>
}

export const PARAM_TOKEN: EffectToken = { Text, Edit }
