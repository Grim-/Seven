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
    <GamePanel title="Stats & Attributes" aside="base / total" bodyClassName="gap-2 p-2.5 [--tone:var(--color-accent)]">
      {attributes.length > 0 && (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {attributes.map((def) => {
            const base = comp.baseValue(def.id)
            const now = comp.value(def.id)
            const mod = Math.floor((now - 10) / 2)
            const modText = signed(mod)
            return (
              <div key={def.id} className="flex items-center gap-1.5 border border-line/40 tone-panel-40 px-2 py-1">
                <span className="w-7 shrink-0 font-label text-[10px] font-bold caps-10 text-tint-cyan" title={def.label}>
                  {def.label.slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{def.label}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <EffectTokenButton
                    name={def.label}
                    spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                    value={base}
                    onChange={(v) => editBase(def.id, def.default, v)}
                  />
                  <span className="text-[10.5px] text-faint">/</span>
                  <span
                    className={cn(
                      'min-w-[2ch] text-right font-data text-[12px] font-semibold tabular-nums',
                      now > base ? 'text-ok' : now < base ? 'text-alert' : 'text-ink'
                    )}
                    title={`Total ${def.label} (base ${round(base)})`}
                  >
                    {round(now)}
                  </span>
                  <span className="w-7 text-right font-data text-[11px] font-semibold tabular-nums text-tint-cyan" title="Modifier">
                    {modText}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {[...otherDomains.entries()].map(([domain, defs]) => {
        const isCustom = domain.toLowerCase() === 'custom'
        return (
          <div key={domain} className="flex flex-col gap-1 border-t border-line/30 pt-1.5">
            <span className="font-label text-[10px] caps-14 text-faint">{domain}</span>
            <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {defs.map((def) => {
                const base = comp.baseValue(def.id)
                const now = comp.value(def.id)
                const mod = isCustom ? Math.floor((now - 10) / 2) : round(now - base)
                return (
                  <div key={def.id} className="flex items-center gap-1.5 border-b border-line/20 py-0.5">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink/90" title={def.id}>
                      {def.label}
                    </span>
                    <EffectTokenButton
                      name={def.label}
                      spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                      value={base}
                      onChange={(v) => editBase(def.id, def.default, v)}
                    />
                    <span className="text-[10.5px] text-faint">/</span>
                    <span
                      className={cn(
                        'min-w-[2.5ch] shrink-0 text-right font-data text-[12px] font-semibold tabular-nums',
                        now > base ? 'text-ok' : now < base ? 'text-alert' : 'text-dim'
                      )}
                      title={`Total ${def.label}`}
                    >
                      {round(now)}
                    </span>
                    {(isCustom || now !== base) && (
                      <span
                        className={cn(
                          'w-7 shrink-0 text-right font-data text-[11px] font-semibold tabular-nums',
                          isCustom ? 'text-tint-cyan' : now > base ? 'text-ok' : 'text-alert'
                        )}
                        title={isCustom ? 'Modifier' : 'Bonus from gear & buffs'}
                      >
                        {signed(mod)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {resists.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line/30 pt-1.5">
          {activeResists.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeResists.map((r) => {
                const val = round(comp.value(r.id))
                const label = r.label.replace(/\s*resist$/i, '').trim()
                return (
                  <span
                    key={r.id}
                    className={cn(
                      'border px-1.5 py-0.5 font-data text-[11px] font-semibold tabular-nums',
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
            <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 pt-1 sm:grid-cols-2">
              {resists.map((def) => {
                const base = comp.baseValue(def.id)
                const now = comp.value(def.id)
                return (
                  <div key={def.id} className="flex items-center gap-1.5 border-b border-line/15 py-0.5">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink/85" title={def.id}>
                      {def.label.replace(/\s*resist$/i, '').trim()}
                    </span>
                    <EffectTokenButton
                      name={def.label}
                      spec={{ kind: 'number', default: def.default, min: def.min, max: def.max, description: `Base ${def.label}` }}
                      value={base}
                      onChange={(v) => editBase(def.id, def.default, v)}
                    />
                    <span className="text-[10.5px] text-faint">/</span>
                    <span
                      className={cn(
                        'min-w-[2.5ch] shrink-0 text-right font-data text-[12px] font-semibold tabular-nums',
                        now > base ? 'text-ok' : now < base ? 'text-alert' : 'text-dim'
                      )}
                      title={`Total ${def.label}`}
                    >
                      {round(now)}
                    </span>
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
