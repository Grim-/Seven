import { ValuesEdit } from '../../params/ValuesParam'
import { useGameDefs } from '../../useGameDefs'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ spec, value }: TokenProps) {
  const defs = useGameDefs(spec.templateKind ?? '')
  const names = new Map((defs.list ?? []).map((d) => [d.id, d.name]))
  const entries = value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, number>) : []
  return <>{entries.length ? entries.map(([k, n]) => `${names.get(k) ?? k} ${n}`).join(', ') : 'none'}</>
}

function Edit({ spec, value, onChange }: TokenEditProps) {
  return <ValuesEdit spec={spec} value={value} onChange={onChange} />
}

registerEffectToken('values', { Text, Edit, wide: true })
