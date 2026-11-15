import { Stats } from '@shared/game/components'
import { cn } from '../../../../lib/cn'
import { Section } from '../../../data/sheet/dnd/Section'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { registerComponentPanel, type PanelProps } from './registry'

function StatsPanel({ comp, catalog, changed }: PanelProps<Stats>) {
  const groups = new Map<string, ReturnType<typeof catalog.stats>>()
  for (const def of catalog.stats()) groups.set(def.domain, [...(groups.get(def.domain) ?? []), def])
  return (
    <Section title="Stats" aside="base → now, with equipment and buffs">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-5 gap-y-3 [--tone:var(--color-accent)]">
        {[...groups.entries()].map(([domain, defs]) => (
          <div key={domain} className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{domain}</span>
            {defs.map((def) => {
              const base = comp.baseValue(def.id)
              const now = comp.value(def.id)
              return (
                <div key={def.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-white/90" title={def.id}>
                    {def.label}
                  </span>
                  <EffectTokenButton
                    name={def.label}
                    spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                    value={base}
                    onChange={(v) => {
                      comp.setBase(def.id, typeof v === 'number' ? v : def.default)
                      changed()
                    }}
                  />
                  <span className={cn('w-12 text-right font-mono text-[12.5px]', now > base ? 'text-ok' : now < base ? 'text-alert' : 'text-faint')}>{now === base ? '' : `→ ${Math.round(now * 100) / 100}`}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Section>
  )
}

registerComponentPanel(Stats.type, { Panel: StatsPanel, wide: true })
