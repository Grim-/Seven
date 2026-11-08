import { defType, splitDefRef } from '@shared/game/defs'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { EntryCard, Facts, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'
import { useResolvedRuleSet } from './ruleSet'

function shown(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map((v) => (v && typeof v === 'object' && 'type' in v ? String((v as { type: unknown }).type) : shown(v))).join(', ') : 'none'
  if (value && typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k} ${shown(v)}`).join(', ') || 'none'
  return String(value)
}

function DefCard({ kind, id, short }: { kind: string; id: string; short: boolean }) {
  const parts = splitDefRef(id)
  const ruleSet = useResolvedRuleSet(parts.ruleSet)
  return ruleSet ? <LoadedCard key={ruleSet} kind={kind} ruleSet={ruleSet} id={parts.id} short={short} /> : <Loading />
}

function LoadedCard({ kind, ruleSet, id, short }: { kind: string; ruleSet: string; id: string; short: boolean }) {
  const def = useLive(() => engine('game.get', { ruleSet, type: kind, id }), 'game.changed')
  const type = defType(kind)
  if (!def || !type) return <Loading />
  const rows: [string, string][] = Object.entries(type.params)
    .filter(([key]) => def.values[key] !== '' && def.values[key] !== undefined)
    .map(([key, spec]) => [spec.label ?? key, shown(def.values[key])])
  return (
    <EntryCard title={def.name} tag={type.label} aside={<span className="font-mono text-[11px] text-faint">{def.id}</span>}>
      <Facts rows={short ? rows.slice(0, 4) : rows} />
      {def.notes && !short && <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/80">{def.notes}</p>}
    </EntryCard>
  )
}

export function GameDefChat({ kind, id }: EntrySurfaceProps) {
  return <DefCard kind={kind} id={id} short={false} />
}

export function GameDefWidget({ kind, id }: EntrySurfaceProps) {
  return <DefCard kind={kind} id={id} short />
}
