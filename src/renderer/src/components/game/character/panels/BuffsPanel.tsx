import { X } from 'lucide-react'
import { Buffs } from '@shared/game/components'
import { BUFF_TEMPLATES } from '@shared/game/defs'
import { GamePanel, RowList, getGameVisual } from '../../../../game/ui'
import { BrowsePick, type BrowseOption } from '../../../ui/BrowsePick'
import { hideTip, showTip } from '../../../ui/TooltipHost'
import { cn } from '../../../../lib/cn'
import { useGameDefs } from '../../useGameDefs'
import { gameTime } from './time'
import { registerComponentPanel, type PanelProps } from './registry'

function BuffsPanel({ comp, catalog, changed }: PanelProps<Buffs>) {
  const defs = useGameDefs(BUFF_TEMPLATES).list ?? []
  const nameOf = (id: string) => defs.find((d) => d.id === id)?.name ?? id
  const options: BrowseOption[] = defs.map((d) => ({
    value: d.id,
    label: d.name,
    group: 'Buffs',
    note: d.notes || undefined
  }))

  return (
    <GamePanel
      title="Active Buffs"
      aside={comp.held.length ? `${comp.held.length} active` : 'none'}
      action={
        options.length > 0 ? (
          <BrowsePick
            value={null}
            options={options}
            placeholder="+ Apply buff"
            onChange={(id) => {
              const def = id ? catalog.template(BUFF_TEMPLATES, id) : null
              if (def && comp.apply(def, null)) changed()
            }}
            className="min-w-[9rem]"
          />
        ) : undefined
      }
      bodyClassName="p-3"
    >
      {comp.held.length === 0 ? (
        <span className="font-mono text-[11.5px] text-faint">No active buffs or status effects.</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {comp.held.map((b) => {
            const label = nameOf(b.id)
            const visual = getGameVisual(label, b.id, 'ability')
            const Icon = visual.Icon
            const rows = [
              ...b.comps.flatMap((c) => c.tooltipRows()),
              ...b.tooltipRows()
            ]
            return (
              <div
                key={b.uid}
                onMouseEnter={(e) =>
                  showTip(
                    e.currentTarget,
                    label,
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10.5px] text-dim">
                        {gameTime(b.remaining)} remaining{b.stacks > 1 ? ` · ×${b.stacks} stacks` : ''}
                      </span>
                      <RowList rows={rows} />
                    </div>,
                    'top'
                  )
                }
                onMouseLeave={() => hideTip('component')}
                className={cn(
                  'flex items-center gap-1.5 border px-2 py-1 text-[12px]',
                  visual.border,
                  visual.bg
                )}
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', visual.color)} />
                <span className="font-semibold text-white">{label}</span>
                {b.stacks > 1 && (
                  <span className="border border-accent/40 bg-black/60 px-1 font-mono text-[10px] font-bold text-accent">
                    ×{b.stacks}
                  </span>
                )}
                <span className="font-mono text-[10.5px] text-dim">{gameTime(b.remaining)}</span>
                <button
                  type="button"
                  title="Remove buff"
                  onClick={() => {
                    hideTip('component')
                    comp.removeBuff(b)
                    changed()
                  }}
                  className="ml-0.5 text-faint hover:text-alert"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </GamePanel>
  )
}

registerComponentPanel(Buffs.type, { Panel: BuffsPanel })
