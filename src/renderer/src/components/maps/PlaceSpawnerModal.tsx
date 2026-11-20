import { useState, useMemo } from 'react'
import { Search, Skull, Swords, Compass, RefreshCw } from 'lucide-react'
import type { Point } from '@shared/shapes'
import type { CompendiumRef } from '@shared/compendium'
import type { StoredFaction } from '@shared/game/factions'
import type { CreatureDisposition, CreatureSpawner, SpawnerResetMode, SpawnerTriggerMode } from '@shared/maps'
import { Button, Modal, Select, Input } from '../ui'
import { useCompendiumList } from '../dnd/useCompendiumList'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'

interface Props {
  at: Point
  onClose: () => void
  onPlaced: (spawner: CreatureSpawner) => void
}

const DISPOSITION_OPTIONS: { value: CreatureDisposition; label: string }[] = [
  { value: 'hostile', label: 'Hostile (Aggressive)' },
  { value: 'neutral', label: 'Neutral (Defensive)' },
  { value: 'friendly', label: 'Friendly (Peaceful)' }
]

const SPAWN_WHEN_OPTIONS: { value: SpawnerTriggerMode; label: string }[] = [
  { value: 'map_load', label: 'On Map Load (Stationed)' },
  { value: 'proximity', label: 'Proximity Ambush (Radius)' },
  { value: 'on_flag', label: 'On World Flag' },
  { value: 'action_only', label: 'Action / Script Only' }
]

const RESET_WHEN_OPTIONS: { value: SpawnerResetMode; label: string }[] = [
  { value: 'never', label: 'Never (Unique / One-shot)' },
  { value: 'on_rest', label: 'On Long Rest' },
  { value: 'on_flag', label: 'On World Flag' },
  { value: 'action_only', label: 'Action Only (reset_spawner)' },
  { value: 'on_map_enter', label: 'Every Map Entry' }
]

export function PlaceSpawnerModal({ at, onClose, onPlaced }: Props) {
  const [search, setSearch] = useState('')
  const [selectedMonster, setSelectedMonster] = useState<CompendiumRef | null>(null)
  const [name, setName] = useState('')
  const [faction, setFactionId] = useState('')
  const [disposition, setDisposition] = useState<CreatureDisposition>('hostile')
  const [spawnWhen, setSpawnWhen] = useState<SpawnerTriggerMode>('map_load')
  const [triggerRadius, setTriggerRadius] = useState(128)
  const [resetWhen, setResetWhen] = useState<SpawnerResetMode>('never')

  const { refs: monsters } = useCompendiumList('monster')
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return monsters.slice(0, 30)
    return monsters
      .filter((m) => {
        const nameMatch = m.name.toLowerCase().includes(q)
        const typeMatch = String(m.facts?.type ?? '').toLowerCase().includes(q)
        const crMatch = String(m.facts?.cr ?? '').toLowerCase().includes(q)
        return nameMatch || typeMatch || crMatch
      })
      .slice(0, 40)
  }, [monsters, search])

  const handleSelect = (m: CompendiumRef) => {
    setSelectedMonster(m)
    setName(m.name)
    setFactionId((prev) => prev || factions.find((f) => f.defaultStance === disposition)?.id || factions[0]?.id || '')
  }

  // Auto-select first if none selected
  if (!selectedMonster && filtered.length > 0) {
    handleSelect(filtered[0])
  }

  const handlePlace = () => {
    if (!selectedMonster) return
    const spawner: CreatureSpawner = {
      id: crypto.randomUUID(),
      name: name.trim() || selectedMonster.name,
      monsterId: selectedMonster.id,
      at,
      scale: 1,
      facing: 0,
      faction: faction || undefined,
      disposition,
      spawnWhen,
      triggerRadius: spawnWhen === 'proximity' ? triggerRadius : undefined,
      resetWhen
    }
    onPlaced(spawner)
    onClose()
  }

  return (
    <Modal open={true} title={`Place Creature Spawner at (${at.x}, ${at.y})`} onClose={onClose} wide>
      <div className="flex flex-col gap-4 font-mono select-none">
        {/* TOP SEARCH BAR */}
        <div className="flex items-center gap-2 border-b border-line pb-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-dim" />
            <input
              type="text"
              placeholder="Search creature bestiary (e.g. Goblin, Skeleton, Dire Wolf, Orc, Bandit)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-line bg-panel py-1.5 pl-8 pr-3 text-[12px] text-white placeholder-dim focus:border-cyan focus:outline-none"
            />
          </div>
          <span className="text-[10px] text-faint shrink-0">{monsters.length} templates in compendium</span>
        </div>

        {/* TWO-COLUMN GALLERY & CONFIG */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[400px]">
          {/* MONSTER LIST */}
          <div className="flex flex-col gap-1.5 border border-line bg-black/40 p-2 lg:col-span-5 max-h-[440px] overflow-y-auto divide-y divide-line/30">
            {filtered.map((m) => {
              const isSelected = selectedMonster?.id === m.id
              const cr = String(m.facts?.cr ?? '—')
              const hp = String(m.facts?.hp ?? '—')
              const type = String(m.facts?.type ?? 'Creature')
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m)}
                  className={cn(
                    'flex items-center justify-between p-2 text-left transition-colors',
                    isSelected
                      ? 'border-l-2 border-l-cyan bg-cyan/15 text-white'
                      : 'text-dim hover:bg-panel hover:text-white'
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-[12px] font-bold text-white">{m.name}</span>
                    <span className="text-[10px] text-faint capitalize">{type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] shrink-0">
                    <span className="border border-line/60 bg-black/60 px-1 py-0.5 text-dim">CR {cr}</span>
                    <span className="border border-line/60 bg-black/60 px-1 py-0.5 text-alert">{hp} HP</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* SPAWNER BLUEPRINT CONFIG */}
          <div className="flex flex-col justify-between border border-line bg-black/60 p-4 lg:col-span-7">
            <div className="flex flex-col gap-3.5">
              {/* INSTANCE IDENTITY */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-dim">Spawner Instance Name:</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Goblin Sentry, Crypt Skeleton"
                  className="border border-line bg-black/60 px-2.5 py-1 text-[13px] font-bold text-white focus:border-cyan focus:outline-none"
                />
              </div>

              {/* DISPOSITION & FACTION */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-dim flex items-center gap-1">
                    <Swords className="h-3 w-3 text-alert" /> Initial Disposition:
                  </span>
                  <Select
                    value={disposition}
                    options={DISPOSITION_OPTIONS}
                    onChange={(d) => setDisposition(d as CreatureDisposition)}
                    className="h-8 text-[11px]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-dim">Faction:</span>
                  <Select
                    value={faction}
                    options={[
                      { value: '', label: 'None (Independent)' },
                      ...factions.map((f) => ({ value: f.id, label: `${f.name} (${f.id})` }))
                    ]}
                    onChange={setFactionId}
                    className="h-8 text-[11px]"
                  />
                </div>
              </div>

              {/* AXIS 1: SPAWN WHEN */}
              <div className="border-t border-line/40 pt-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold text-cyan flex items-center gap-1">
                  <Compass className="h-3 w-3" /> Spawn When (Trigger Condition):
                </span>
                <Select
                  value={spawnWhen}
                  options={SPAWN_WHEN_OPTIONS}
                  onChange={(sw) => setSpawnWhen(sw as SpawnerTriggerMode)}
                  className="h-8 text-[11.5px]"
                />
                {spawnWhen === 'proximity' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-dim uppercase">Detection Radius:</span>
                    <Input
                      type="number"
                      min={32}
                      max={800}
                      step={32}
                      value={triggerRadius}
                      onChange={(e) => setTriggerRadius(Math.max(32, Number(e.target.value)))}
                      className="h-7 w-20 text-[11px]"
                    />
                    <span className="text-[10px] text-faint">pixels ({Math.round(triggerRadius / 32)} tiles)</span>
                  </div>
                )}
              </div>

              {/* AXIS 2: RESET WHEN */}
              <div className="border-t border-line/40 pt-2.5 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold text-accent flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Reset When (Respawn & Persistence):
                </span>
                <Select
                  value={resetWhen}
                  options={RESET_WHEN_OPTIONS}
                  onChange={(rw) => setResetWhen(rw as SpawnerResetMode)}
                  className="h-8 text-[11.5px]"
                />
              </div>
            </div>

            {/* FOOTER BUTTONS */}
            <div className="flex items-center justify-end gap-2 border-t border-line/40 pt-3 mt-4">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" icon={<Skull className="h-3.5 w-3.5" />} onClick={handlePlace}>
                Place Spawner on Map
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
