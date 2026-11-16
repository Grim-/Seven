import { RotateCcw } from 'lucide-react'
import { Resource } from '@shared/game/components'
import type { Catalog, GameEntity } from '@shared/game/core'
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
      bodyClassName="gap-2.5 p-3"
      action={
        changed && resources.some((r) => r.get() < r.max()) ? (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={restoreAll} title="Restore all vitals to full">
            Refill all
          </Button>
        ) : undefined
      }
    >
      {resources.length > 0 && (
        <div className="flex flex-col gap-2">
          {resources.map((r) => {
            const def = catalog.stat(r.stat)
            const max = r.max()
            const now = r.get()
            const per = Math.round((def?.regenPerSecond ?? 0) * 3600 * 100) / 100
            const roundedNow = Math.round(now * 100) / 100
            const roundedMax = Math.round(max)
            return (
              <div key={r.uid} className="flex items-center gap-2.5">
                <div className="w-24 shrink-0">
                  <div className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                    {def?.label ?? r.stat}
                  </div>
                  {per !== 0 && (
                    <div className="font-mono text-[10px] text-dim">{`${per > 0 ? '+' : ''}${per}/hr`}</div>
                  )}
                </div>
                <GameBar value={now} max={max} colour={def?.colour ?? null} size="md" className="flex-1" />
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
                    <span className="font-mono text-[11px] text-dim">/ {roundedMax}</span>
                  </div>
                ) : (
                  <span className="shrink-0 font-mono text-[11.5px] text-white">
                    {roundedNow} / {roundedMax}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 border-t border-line/35 pt-2 sm:grid-cols-5">
        {vitals.map(({ key, label, value, Icon, toneClass }) => (
          <div key={key} className="flex items-center gap-2 border border-line/50 bg-black/55 px-2 py-1.5">
            <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center border', toneClass)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-dim">{label}</div>
              <div className="truncate font-mono text-[12px] font-bold leading-tight text-white">{value}</div>
            </div>
          </div>
        ))}
      </div>
    </GamePanel>
  )
}
