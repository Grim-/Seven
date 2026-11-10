import { useState, useMemo } from 'react'
import { Search, Skull, Flag, Swords } from 'lucide-react'
import type { Point } from '@shared/shapes'
import type { CompendiumRef } from '@shared/compendium'
import type { StoredFaction } from '@shared/game/factions'
import { guessCreatureFaction, monsterToSheetInput } from '@shared/game/creatures'
import { Button, Select } from '../ui'
import { useCompendiumList } from '../dnd/useCompendiumList'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'

interface Props {
  worldId: string
  at: Point
  onSpawn: (sheetId: string) => void
  onClose: () => void
}

export function QuickCreatureSpawner({ worldId: _worldId, at, onSpawn, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selectedMonster, setSelectedMonster] = useState<CompendiumRef | null>(null)
  const [customName, setCustomName] = useState('')
  const [factionId, setFactionId] = useState('')
  const [spawning, setSpawning] = useState(false)

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
    setCustomName(m.name)
    setFactionId(guessCreatureFaction(m))
  }

  // Auto-select first if none selected
  if (!selectedMonster && filtered.length > 0) {
    handleSelect(filtered[0])
  }

  const handleSpawn = async () => {
    if (!selectedMonster) return
    setSpawning(true)
    try {
      const { entry } = await engine('dnd.get', { kind: 'monster', id: selectedMonster.id })
      const input = monsterToSheetInput({
        monster: entry,
        customName: customName.trim() || entry.name,
        factionId: factionId || guessCreatureFaction(entry)
      })
      const sheet = await engine('sheets.save', input)
      toast.success('Creature Spawned', `${sheet.title} spawned at (${at.x}, ${at.y}) in faction ${input.faction ?? 'monsters'}.`)
      onSpawn(sheet.id)
    } catch (err) {
      failed('Could not spawn creature')(err)
    } finally {
      setSpawning(false)
    }
  }

  return (
    <div className="flex w-[480px] max-w-full flex-col gap-3 p-3 font-mono text-[12px] select-none">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <Skull className="h-4 w-4 text-alert" />
          <span className="font-bold uppercase tracking-wider text-white">
            SPAWN CREATURE TEMPLATE AT ({at.x}, {at.y})
          </span>
        </div>
        <span className="text-[10px] text-dim">{monsters.length} in bestiary</span>
      </div>

      {/* SEARCH INPUT */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-dim" />
        <input
          type="text"
          placeholder="Search monster template (e.g. Skeleton, Ogre, Wolf)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-line bg-panel py-1.5 pl-8 pr-3 text-[12px] text-white placeholder-dim focus:border-cyan focus:outline-none"
        />
      </div>

      {/* RESULTS LIST */}
      <div className="flex max-h-40 flex-col overflow-y-auto divide-y divide-line/30 border border-line/40 bg-black/40">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-dim text-[11px]">No matching creatures.</div>
        ) : (
          filtered.map((m) => {
            const isSelected = selectedMonster?.id === m.id
            const cr = m.facts?.cr !== undefined ? `CR ${m.facts.cr}` : ''
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelect(m)}
                className={cn(
                  'flex items-center justify-between p-2 text-left transition-colors',
                  isSelected
                    ? 'border-l-2 border-l-cyan bg-cyan/10 text-white'
                    : 'text-faint hover:bg-panel hover:text-white'
                )}
              >
                <div className="flex flex-col gap-0.5 truncate pr-2">
                  <span className="font-bold text-[12px] truncate">{m.name}</span>
                  <span className="text-[10px] text-dim truncate">
                    {[m.facts?.size, m.facts?.type].filter(Boolean).join(' ')}
                    {m.facts?.hp && ` · ${String(m.facts.hp).split(' ')[0]} HP`}
                    {m.facts?.ac && ` · AC ${String(m.facts.ac)}`}
                  </span>
                </div>
                {cr && <span className="text-[10px] text-accent font-bold shrink-0">{cr}</span>}
              </button>
            )
          })
        )}
      </div>

      {/* INSTANCE CONTROLS */}
      {selectedMonster && (
        <div className="flex flex-col gap-2.5 border border-line/60 bg-panel p-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-dim">
              Character Name / Token Label:
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="border border-line bg-black/60 px-2 py-1 text-[11px] text-white focus:outline-none focus:border-cyan"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-dim flex items-center gap-1">
                <Flag className="h-3 w-3 text-cyan" /> Assigned Faction:
              </label>
              <span className="text-[9px] text-cyan">
                Default: {guessCreatureFaction(selectedMonster)}
              </span>
            </div>
            <Select
              value={factionId}
              options={factions.map((f) => ({
                value: f.id,
                label: `${f.name} (${f.id.toUpperCase()})`
              }))}
              onChange={setFactionId}
              className="h-8 text-[11px]"
            />
          </div>
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-end gap-2 border-t border-line/60 pt-2">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={spawning}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<Swords className="h-3.5 w-3.5 text-cyan" />}
          onClick={() => void handleSpawn()}
          disabled={!selectedMonster || spawning}
        >
          {spawning ? 'Spawning…' : 'Spawn at Point'}
        </Button>
      </div>
    </div>
  )
}
