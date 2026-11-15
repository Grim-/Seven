import { Plus, X } from 'lucide-react'
import { DND_STATS, type DndExtra, type DndStats } from '@shared/dnd'
import type { GameDef } from '@shared/game/defs/defs'
import { InlineNumber, SegmentBar, Select, openMenu, type MenuEvent, type MenuItem } from '../../../ui'
import { useGameDefs } from '../../../game/useGameDefs'
import { Section } from './Section'

const RESOURCE = 'resource'

const isResource = (def: GameDef | undefined): boolean => def?.values.domain === RESOURCE
const startValue = (def: GameDef): DndExtra => {
  const start = Number(def.values.default) || 0
  return isResource(def) ? { cur: start, max: start } : start
}

function ExtraRow({ id, def, value, onValue, onRemove }: { id: string; def: GameDef | undefined; value: DndExtra; onValue: (v: DndExtra) => void; onRemove: () => void }) {
  const min = Number(def?.values.min ?? 0)
  const max = Number(def?.values.max ?? 9999)
  return (
    <div className="flex flex-col gap-1 border-t border-line/25 pt-1.5 first:border-t-0">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold tracking-[0.1em] text-accent-soft" title={def?.notes}>
          {def?.name ?? id}
        </span>
        {typeof value === 'number' ? (
          <InlineNumber value={value} min={min} max={max} title="Value" onSave={onValue} className="font-mono text-[15px] font-bold text-cyan" />
        ) : (
          <span className="flex items-baseline gap-1 font-mono text-[13px] text-cyan">
            <InlineNumber value={value.cur} min={0} max={value.max} title="Current" onSave={(cur) => onValue({ ...value, cur })} />
            <span className="text-faint">/</span>
            <InlineNumber value={value.max} min={min} max={max} title="Maximum" onSave={(m) => onValue({ cur: Math.min(value.cur, m), max: m })} />
          </span>
        )}
        <button type="button" onClick={onRemove} title="Remove" className="text-faint hover:text-alert">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {typeof value !== 'number' && <SegmentBar value={value.max ? value.cur / value.max : 0} thin />}
    </div>
  )
}

export function ExtraStats({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const defs = useGameDefs('stat').list ?? []
  const shown = new Set<string>([...DND_STATS, ...Object.keys(dnd.extra)])
  const addable = defs.filter((d) => !shown.has(d.id))
  const byId = new Map(defs.map((d) => [d.id, d]))
  const set = (id: string, v: DndExtra) => onChange({ extra: { ...dnd.extra, [id]: v } })
  const remove = (id: string) => {
    const { [id]: _gone, ...rest } = dnd.extra
    onChange({ extra: rest })
  }
  const add = (id: string) => {
    const def = byId.get(id)
    if (def) set(id, startValue(def))
  }
  const addItems = (): MenuItem[] => addable.map((d) => ({ label: d.name, icon: <Plus />, onSelect: () => add(d.id) }))
  const menu = (e: MenuEvent) => {
    e.preventDefault()
    if (addable.length) openMenu(e, 'Add stat', addItems())
  }
  const entries = Object.entries(dnd.extra)
  return (
    <div onContextMenu={menu}>
      <Section
        title="More stats"
        aside={entries.length ? undefined : 'none yet'}
        action={addable.length ? <Select value="" options={[{ value: '', label: 'Add stat…' }, ...addable.map((d) => ({ value: d.id, label: d.name }))]} onChange={add} className="h-7 w-40 text-[12px]" /> : undefined}
      >
        {entries.length > 0 && (
          <div className="flex flex-col">
            {entries.map(([id, value]) => (
              <ExtraRow key={id} id={id} def={byId.get(id)} value={value} onValue={(v) => set(id, v)} onRemove={() => remove(id)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
