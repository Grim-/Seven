import { useEffect, useState } from 'react'
import { Swords } from 'lucide-react'
import type { BlueprintRow } from '@shared/game/blueprints'
import type { StoredFaction } from '@shared/game/factions'
import type { Point } from '@shared/shapes'
import { Button, Input, SearchBox, Select } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'

const LIMIT = 40

export function BestiaryPicker({ world, map, at, onDone }: { world: string; map: string; at: Point; onDone: () => void }) {
  const sources = useLive(() => engine('blueprints.sources'), 'game.changed') ?? []
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const [source, setSource] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<BlueprintRow[]>([])
  const [picked, setPicked] = useState<BlueprintRow | null>(null)
  const [name, setName] = useState('')
  const [faction, setFaction] = useState('')
  const [busy, setBusy] = useState(false)
  const from = sources.some((s) => s.id === source) ? source : (sources[0]?.id ?? '')

  useEffect(() => {
    if (!from) return
    let live = true
    void engine('blueprints.search', { source: from, query, limit: LIMIT })
      .then((list) => live && setRows(list))
      .catch(failed('Could not search the bestiary'))
    return () => {
      live = false
    }
  }, [from, query])

  const pick = (row: BlueprintRow) => {
    setPicked(row)
    setName(row.name)
  }
  const spawn = () => {
    if (!picked) return
    setBusy(true)
    void engine('saves.spawnBlueprint', { world, map, source: from, id: picked.id, name, faction, at })
      .then(onDone)
      .catch(failed('Could not spawn the creature'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Select value={from} options={sources.map((s) => ({ value: s.id, label: s.label }))} onChange={setSource} className="h-8 w-44 text-[12px]" />
        <SearchBox value={query} onChange={setQuery} placeholder="Search" className="flex-1" />
      </div>
      <div className="flex max-h-64 flex-col divide-y divide-line/30 overflow-y-auto border border-line/40 tone-panel-40">
        {rows.length === 0 && <div className="p-3 text-center text-[11px] text-dim">Nothing matches.</div>}
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => pick(row)}
            onDoubleClick={() => {
              pick(row)
              spawn()
            }}
            className={cn('flex items-center justify-between gap-3 p-2 text-left', picked?.id === row.id ? 'border-l-2 border-l-secondary-ink bg-secondary-ink/10 text-ink' : 'text-faint hover:bg-ink/5 hover:text-ink')}
          >
            <span className="truncate font-ui text-[12px] font-bold">{row.name}</span>
            <span className="flex shrink-0 gap-3 font-ui text-[10px] text-dim">
              {row.facts.map((f) => (
                <span key={f.label}>
                  {f.label} {f.value}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      {picked && (
        <div className="grid grid-cols-2 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Select value={faction} options={[{ value: '', label: 'No faction' }, ...factions.map((f) => ({ value: f.id, label: f.name }))]} onChange={setFaction} />
        </div>
      )}
      <div className="grid grid-cols-1">
        <Button variant="primary" icon={<Swords />} disabled={!picked || busy} onClick={spawn}>
          {busy ? 'Spawning…' : `Spawn at (${at.x}, ${at.y})`}
        </Button>
      </div>
    </div>
  )
}
