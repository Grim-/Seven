import { useState } from 'react'
import { Skills } from '@shared/game/components'
import { checkBonus } from '@shared/game/rules'
import { SearchBox } from '../../../ui'
import { GamePanel } from '../../../../game/ui'
import { cn } from '../../../../lib/cn'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { registerComponentPanel, type PanelProps } from './registry'

function SkillsPanel({ comp, entity, catalog, changed }: PanelProps<Skills>) {
  const [filter, setFilter] = useState('')
  const checks = catalog.checks()
  const skillChecks = checks.filter((c) => c.group === 'skill')
  const baseList = skillChecks.length ? skillChecks : checks
  const q = filter.trim().toLowerCase()
  const shown = q ? baseList.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : baseList

  return (
    <GamePanel
      title="Skills"
      aside={`${baseList.length} checks`}
      action={
        <SearchBox value={filter} onChange={setFilter} placeholder="Filter…" className="w-32" />
      }
      bodyClassName="p-3 [--tone:var(--color-accent)]"
    >
      <div className="grid max-h-[22rem] grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-2">
        {shown.length === 0 ? (
          <span className="col-span-full text-[12px] text-faint">No matching skills.</span>
        ) : (
          shown.map((def) => {
            const rank = comp.rank(def.id)
            const total = checkBonus(entity, def)
            return (
              <div key={def.id} className="flex items-center gap-2 border-b border-line/20 py-0.5">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/90" title={def.id}>
                  {def.label}
                </span>
                <EffectTokenButton
                  name={def.label}
                  spec={{ kind: 'number', default: 0, description: `Base rank for ${def.label}` }}
                  value={rank}
                  onChange={(v) => {
                    comp.setRank(def.id, typeof v === 'number' ? v : 0)
                    changed()
                  }}
                />
                <span
                  className={cn(
                    'w-9 shrink-0 border px-1 py-0.5 text-center font-mono text-[11px] font-bold',
                    total > rank
                      ? 'border-ok/40 bg-ok/10 text-ok'
                      : total < rank
                        ? 'border-alert/40 bg-alert/10 text-alert'
                        : 'border-line/40 bg-black/50 text-dim'
                  )}
                  title="Total check bonus"
                >
                  {total >= 0 ? `+${total}` : String(total)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </GamePanel>
  )
}

registerComponentPanel(Skills.type, { Panel: SkillsPanel })
