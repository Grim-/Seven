import { RotateCcw } from 'lucide-react'
import { Resource } from '@shared/game/components'
import { signalLabel, type Catalog, type GameEntity } from '@shared/game/core'
import { Button } from '../../components/ui'
import { EffectTokenButton } from '../../components/game/effects/EffectTokenButton'
import { cn } from '../../lib/cn'
import { GameBar } from './GameBar'
import { GamePanel } from './GamePanel'
import { combatVitalsOf } from './gameVisuals'

export function VitalsPanel({
  entity,
  catalog,
  changed,
  className
}: {
  entity: GameEntity
  catalog: Catalog
  changed?: () => void
  className?: string
}) {
  const resources = entity.comps.filter((c): c is Resource => c instanceof Resource)
  const vitals = combatVitalsOf(entity, catalog)

  const restoreAll = () => {
    for (const r of resources) r.set(r.max())
    changed?.()
  }

  return (
    <GamePanel
      title="Vitals & Combat"
      className={className}
      bodyClassName="gap-2 p-2.5"
      action={
        changed && resources.some((r) => r.get() < r.max()) ? (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={restoreAll} title="Restore all vitals to full">
            Refill all
          </Button>
        ) : undefined
      }
    >
      {resources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {resources.map((r) => {
            const def = catalog.stat(r.stat)
            const max = r.max()
            const now = r.get()
            const refills = (def?.refill.on ?? []).map(signalLabel).join(', ')
            const roundedNow = Math.round(now * 100) / 100
            const roundedMax = Math.round(max)
            return (
              <div key={r.uid} className="flex items-center gap-2">
                <span
                  className="w-20 shrink-0 truncate font-label text-[10.5px] font-bold caps-10 text-ink"
                  title={refills ? `Refills on: ${refills}` : def?.label ?? r.stat}
                >
                  {def?.label ?? r.stat}
                </span>
                <GameBar value={now} max={max} colour={def?.colour ?? null} size="sm" className="flex-1" />
                {changed ? (
                  <div className="flex shrink-0 items-center gap-1 [--tone:var(--color-accent)]">
                    <EffectTokenButton
                      name={def?.label ?? r.stat}
                      spec={{ kind: 'number', default: roundedMax, min: 0, max: max || undefined, description: `Current ${def?.label ?? r.stat}` }}
                      value={roundedNow}
                      onChange={(v) => {
                        r.set(typeof v === 'number' ? v : now)
                        changed()
                      }}
                    />
                    <span className="font-data text-[11px] tabular-nums text-dim">/ {roundedMax}</span>
                  </div>
                ) : (
                  <span className="shrink-0 font-data text-[11.5px] tabular-nums text-ink">
                    {roundedNow} / {roundedMax}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 border-t border-line/35 pt-1.5 sm:grid-cols-5">
        {vitals.map(({ key, label, value, Icon, toneClass }) => (
          <div key={key} className="flex items-center gap-1.5 border border-line/40 tone-panel-40 px-2 py-1">
            <Icon className={cn('h-3.5 w-3.5 shrink-0 bg-transparent border-0', toneClass)} />
            <div className="min-w-0">
              <div className="font-label text-[9px] caps-10 text-dim">{label}</div>
              <div className="truncate font-data text-[12px] font-semibold leading-tight tabular-nums text-ink">{value}</div>
            </div>
          </div>
        ))}
      </div>
    </GamePanel>
  )
}
