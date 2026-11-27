import { compendiumInfo, type CompendiumEntry, type CompendiumKind, type FactDef } from '@shared/compendium'
import { DND_STATS, modifier } from '@shared/dnd'
import { Eyebrow } from '../ui'
import { openEntry } from '../../lib/library'
import { useCompendiumList } from './useCompendiumList'

const ABILITIES: readonly string[] = DND_STATS

function FactLinks({ kind, value }: { kind: CompendiumKind; value: string }) {
  const list = useCompendiumList(kind)
  const names = value.split(/,\s*/).filter(Boolean)
  return (
    <span className="text-[13.5px] text-ink">
      {names.map((name, i) => {
        const ref = list.find(name)
        return (
          <span key={`${name}${i}`}>
            {ref ? (
              <button onClick={() => openEntry(kind, ref.id)} className="underline decoration-accent/50 decoration-dotted underline-offset-[3px] hover:text-accent">
                {name}
              </button>
            ) : (
              name
            )}
            {i < names.length - 1 && ', '}
          </span>
        )
      })}
    </span>
  )
}

function Fact({ f, value }: { f: FactDef; value: string }) {
  return (
    <div className="flex min-w-[7rem] max-w-[26rem] flex-col gap-0.5 border border-line/40 tone-panel-40 px-3 py-1.5">
      <Eyebrow className="text-[10px]">{f.label}</Eyebrow>
      {f.link ? <FactLinks kind={f.link} value={value} /> : <span className="text-[13.5px] text-ink">{value}</span>}
    </div>
  )
}

export function FactTable({ kind, entry }: { kind: CompendiumKind; entry: CompendiumEntry }) {
  const defs = (compendiumInfo(kind)?.facts ?? []).filter((f) => entry.facts[f.key] !== undefined && entry.facts[f.key] !== false && entry.facts[f.key] !== '')
  const abilities = defs.filter((f) => ABILITIES.includes(f.key))
  const checks = defs.filter((f) => f.type === 'check')
  const rest = defs.filter((f) => !abilities.includes(f) && !checks.includes(f))
  if (!defs.length) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-stretch gap-2">
        {rest.map((f) => (
          <Fact key={f.key} f={f} value={String(entry.facts[f.key])} />
        ))}
        {checks.map((f) => (
          <span key={f.key} className="self-center border border-accent/50 bg-accent/10 px-2 py-0.5 font-label text-[10.5px] caps-12 text-accent">
            {f.label}
          </span>
        ))}
      </div>
      {abilities.length > 0 && (
        <div className="grid max-w-xl grid-cols-6 border border-line/40 tone-panel-40">
          {abilities.map((f) => (
            <div key={f.key} className="flex flex-col items-center py-1.5">
              <Eyebrow className="text-[10px]">{f.key}</Eyebrow>
              <span className="font-ui text-[16px] font-bold text-ink">{String(entry.facts[f.key])}</span>
              <span className="font-ui text-[11px] text-secondary-ink">{modifier(Number(entry.facts[f.key]))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
