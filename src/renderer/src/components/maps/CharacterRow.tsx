import type { MouseEvent } from 'react'
import { X } from 'lucide-react'
import { DND_STATS, modifier } from '@shared/dnd'
import type { PlaceVisitor } from '@shared/maps'
import { useAgents } from '../../store/agents'
import { openSevenLink } from '../../lib/links'
import { SheetPortrait } from '../data/SheetPortrait'
import { RowAction } from '../ui'
import { HpBar } from './HpBar'

export function CharacterRow({ visitor, onRemove, onMenu }: { visitor: PlaceVisitor; onRemove?: () => void; onMenu?: (e: MouseEvent) => void }) {
  const agent = useAgents((s) => (visitor.agent ? s.list.find((a) => a.id === visitor.agent) : undefined))
  const d = visitor.dnd
  return (
    <div onContextMenu={onMenu} className="grid grid-cols-[44px_minmax(0,1fr)] gap-2.5 border border-line/40 bg-white/[0.015] p-2">
      <button type="button" title={`Open ${visitor.name}`} onClick={() => openSevenLink(`seven:sheet/${encodeURIComponent(visitor.sheet)}`)}>
        <SheetPortrait image={visitor.image} className="h-11 w-11" />
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-semibold text-white">{visitor.name}</span>
          {agent && <span className="truncate font-mono text-[10px] text-teal">played by {agent.name}</span>}
          {onRemove && (
            <span className="ml-auto shrink-0">
              <RowAction title="Remove from here" danger icon={<X />} onClick={onRemove} />
            </span>
          )}
        </div>
        <div className="truncate font-mono text-[10.5px] text-dim">{visitor.line}</div>
        {d && (
          <>
            <HpBar hp={d.hp} />
            <div className="grid grid-cols-6 border border-line/40 text-center font-mono text-[11px]">
              {DND_STATS.map((s) => (
                <div key={s} className="border-r border-line/40 py-0.5 last:border-r-0">
                  <b className="block text-[9px] uppercase tracking-[0.1em] text-accent-soft">{s}</b>
                  {modifier(d.stats[s])}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
