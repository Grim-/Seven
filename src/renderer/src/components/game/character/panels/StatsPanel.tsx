import { Stats } from '@shared/game/components'
import { Fold } from '../../../ui'
import { GamePanel } from '../../../../game/ui'
import { cn } from '../../../../lib/cn'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { registerComponentPanel, type PanelProps } from './registry'

const round = (n: number) => Math.round(n * 100) / 100
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`

function StatsPanel({ comp, catalog, changed }: PanelProps<Stats>) {
  const all = catalog.stats()
  const attributes = all.filter((d) => d.domain.toLowerCase() === 'attribute')
  const resists = all.filter((d) => d.domain.toLowerCase() === 'resist')
  const otherDomains = new Map<string, typeof all>()
  for (const def of all) {
    const d = def.domain.toLowerCase()
    if (d === 'attribute' || d === 'resist' || d === 'resource') continue
    otherDomains.set(def.domain, [...(otherDomains.get(def.domain) ?? []), def])
  }

  const activeResists = resists.filter((r) => comp.value(r.id) !== 0)

  const editBase = (id: string, defDefault: number, v: unknown) => {
    comp.setBase(id, typeof v === 'number' ? v : defDefault)
    changed()
  }

  return (
    <GamePanel title="Stats & Attributes" aside="base → live" bodyClassName="gap-3 p-3 [--tone:var(--color-accent)]">
      {attributes.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {attributes.map((def) => {
            const base = comp.baseValue(def.id)
            const now = comp.value(def.id)
            const mod = Math.floor((now - 10) / 2)
            const modText = signed(mod)
            return (
              <div key={def.id} className="flex flex-col gap-1 border border-line/50 bg-black/55 px-2.5 py-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cyan" title={def.label}>
                    {def.label.slice(0, 3)}
                  </span>
                  <span className="border border-cyan/35 bg-cyan/10 px-1.5 font-mono text-[10.5px] font-bold text-cyan">
                    {modText}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="min-w-0 truncate text-[11.5px] text-dim">{def.label}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <EffectTokenButton
                      name={def.label}
                      spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                      value={base}
                      onChange={(v) => editBase(def.id, def.default, v)}
                    />
                    {now !== base && (
                      <span className={cn('font-mono text-[11px] font-bold', now > base ? 'text-ok' : 'text-alert')}>
                        →{round(now)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {[...otherDomains.entries()].map(([domain, defs]) => (
        <div key={domain} className="flex flex-col gap-1 border-t border-line/30 pt-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{domain}</span>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {defs.map((def) => {
              const base = comp.baseValue(def.id)
              const now = comp.value(def.id)
              return (
                <div key={def.id} className="flex items-center gap-2 border-b border-line/20 py-0.5">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/90" title={def.id}>
                    {def.label}
                  </span>
                  <EffectTokenButton
                    name={def.label}
                    spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                    value={base}
                    onChange={(v) => editBase(def.id, def.default, v)}
                  />
                  {now !== base && (
                    <span className={cn('font-mono text-[11.5px]', now > base ? 'text-ok' : 'text-alert')}>
                      → {round(now)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {resists.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line/30 pt-2">
          {activeResists.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeResists.map((r) => {
                const val = round(comp.value(r.id))
                const label = r.label.replace(/\s*resist$/i, '').trim()
                return (
                  <span
                    key={r.id}
                    className={cn(
                      'border px-2 py-0.5 font-mono text-[11px] font-bold',
                      val > 0 ? 'border-ok/50 bg-ok/10 text-ok' : 'border-alert/50 bg-alert/10 text-alert'
                    )}
                  >
                    {label} {signed(val)}
                  </span>
                )
              })}
            </div>
          )}
          <Fold label="Damage resistances" count={resists.length} note={activeResists.length ? `${activeResists.length} active` : 'all neutral'}>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 pt-1 sm:grid-cols-2">
              {resists.map((def) => {
                const base = comp.baseValue(def.id)
                const now = comp.value(def.id)
                return (
                  <div key={def.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-white/85" title={def.id}>
                      {def.label.replace(/\s*resist$/i, '').trim()}
                    </span>
                    <EffectTokenButton
                      name={def.label}
                      spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                      value={base}
                      onChange={(v) => editBase(def.id, def.default, v)}
                    />
                    {now !== base && (
                      <span className={cn('font-mono text-[11px]', now > base ? 'text-ok' : 'text-alert')}>
                        →{round(now)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Fold>
        </div>
      )}
    </GamePanel>
  )
}

registerComponentPanel(Stats.type, { Panel: StatsPanel })
