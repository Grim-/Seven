import { compendiumInfo, type CompendiumKind } from '@shared/compendium'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { Markdown } from '../chat/Markdown'
import { EntryCard, Facts, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useEntry(kind: string, id: string) {
  return useLive(() => engine('dnd.get', { kind: kind as CompendiumKind, id }), 'dnd.changed')
}

function factRows(kind: string, facts: Record<string, string | number | boolean>, limit: number): [string, string][] {
  return (compendiumInfo(kind)?.facts ?? [])
    .filter((f) => facts[f.key] !== undefined && facts[f.key] !== '' && facts[f.key] !== false)
    .slice(0, limit)
    .map((f) => [f.label, f.type === 'check' ? 'yes' : String(facts[f.key])])
}

function EntryView({ kind, id, short }: { kind: string; id: string; short: boolean }) {
  const got = useEntry(kind, id)
  if (!got) return <Loading />
  const e = got.entry
  return (
    <EntryCard title={e.name} tag={compendiumInfo(kind)?.label ?? kind} aside={<span className="font-ui text-[11px] text-faint">{e.source}</span>}>
      <Facts rows={factRows(kind, e.facts, short ? 4 : 99)} />
      {e.text && (
        <div className={short ? 'max-h-40 overflow-hidden' : ''}>
          <Markdown text={e.text} />
        </div>
      )}
    </EntryCard>
  )
}

export function CompendiumChat({ kind, id }: EntrySurfaceProps) {
  return <EntryView kind={kind} id={id} short={false} />
}

export function CompendiumWidget({ kind, id }: EntrySurfaceProps) {
  return <EntryView kind={kind} id={id} short={false} />
}
