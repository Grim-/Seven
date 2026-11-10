import { useState, useMemo } from 'react'
import {
  Search,
  Skull,
  UserPlus,
  Shield,
  Heart,
  Zap,
  MapPin,
  Flag,
  Swords
} from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import type { WorldMapUse } from '@shared/maps'
import type { StoredFaction } from '@shared/game/factions'
import type { CompendiumRef } from '@shared/compendium'
import { guessCreatureFaction, monsterToSheetInput } from '@shared/game/creatures'
import { Button, Modal, Segmented, Select } from '../ui'
import { useCompendiumList } from '../dnd/useCompendiumList'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { EntryPicker } from '../library/EntryPicker'
import { cn } from '../../lib/cn'

interface Props {
  world: WorldMeta
  uses: WorldMapUse[]
  onClose: () => void
  onAdded: (sheetId: string) => void
}

export function AddWorldCharacterModal({ world, uses, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<'bestiary' | 'library'>('bestiary')
  const [search, setSearch] = useState('')
  const [selectedMonsterRef, setSelectedMonsterRef] = useState<CompendiumRef | null>(null)
  const [customName, setCustomName] = useState('')
  const [assignedFaction, setAssignedFaction] = useState<string>('')
  const [selectedMap, setSelectedMap] = useState<string>(uses[0]?.map ?? '')
  const [spawning, setSpawning] = useState(false)

  // Load compendium monsters and world factions
  const { refs: monsterRefs } = useCompendiumList('monster')
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []

  // Filtered monsters list
  const filteredMonsters = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return monsterRefs.slice(0, 40)
    return monsterRefs
      .filter((m) => {
        const nameMatch = m.name.toLowerCase().includes(q)
        const typeMatch = String(m.facts?.type ?? '').toLowerCase().includes(q)
        const crMatch = String(m.facts?.cr ?? '').toLowerCase().includes(q)
        return nameMatch || typeMatch || crMatch
      })
      .slice(0, 50)
  }, [monsterRefs, search])

  // When a monster is picked, set default name and faction
  const handleSelectMonster = (ref: CompendiumRef) => {
    setSelectedMonsterRef(ref)
    setCustomName(ref.name)
    const guessed = guessCreatureFaction(ref)
    setAssignedFaction(guessed)
  }

  // Auto-select first monster if none selected yet
  if (!selectedMonsterRef && filteredMonsters.length > 0) {
    handleSelectMonster(filteredMonsters[0])
  }

  // Handle Spawning creature from template
  const handleSpawnCreature = async () => {
    if (!selectedMonsterRef) return
    setSpawning(true)
    try {
      // 1. Fetch full monster entry
      const { entry } = await engine('dnd.get', { kind: 'monster', id: selectedMonsterRef.id })

      // 2. Build CharacterSheet payload
      const sheetInput = monsterToSheetInput({
        monster: entry,
        customName: customName.trim() || entry.name,
        factionId: assignedFaction || guessCreatureFaction(entry)
      })

      // 3. Save as a standard character sheet
      const newSheet = await engine('sheets.save', sheetInput)

      // 4. Place on the selected map template
      const targetMapId = selectedMap || uses[0]?.map
      const targetUse = uses.find((u) => u.map === targetMapId) || uses[0]
      if (targetUse) {
        const stand = {
          ...targetUse.stand,
          [newSheet.id]: { at: { x: 2, y: 2 }, actions: '', decisions: '' }
        }
        await engine('worlds.saveMapUse', { id: world.id, use: { ...targetUse, stand } })
      }

      toast.success(
        'Creature Spawned',
        `${newSheet.title} spawned as a character sheet in faction ${sheetInput.faction ?? 'monsters'}.`
      )
      onAdded(newSheet.id)
      onClose()
    } catch (err) {
      failed('Could not spawn creature')(err)
    } finally {
      setSpawning(false)
    }
  }

  // Handle adding an existing sheet from library to world template
  const handleAddLibrarySheet = async (sheetId: string) => {
    try {
      // Place on selected map template
      const targetMapId = selectedMap || uses[0]?.map
      const targetUse = uses.find((u) => u.map === targetMapId) || uses[0]
      if (targetUse) {
        const stand = {
          ...targetUse.stand,
          [sheetId]: { at: { x: 2, y: 2 }, actions: '', decisions: '' }
        }
        await engine('worlds.saveMapUse', { id: world.id, use: { ...targetUse, stand } })
      }
      toast.success('Character Added', `Added character to ${world.name}.`)
      onAdded(sheetId)
      onClose()
    } catch (err) {
      failed('Could not add character')(err)
    }
  }

  return (
    <Modal open={true} title="Add Character to World" onClose={onClose} wide>
      <div className="flex flex-col gap-4 font-mono select-none">
        {/* TAB CONTROLS */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-cyan" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-white">
              SELECT CREATURE TEMPLATE OR EXISTING SHEET
            </span>
          </div>

          <Segmented
            value={tab}
            onChange={(t) => setTab(t as 'bestiary' | 'library')}
            options={[
              { value: 'bestiary', label: 'Creature Bestiary (Templates)' },
              { value: 'library', label: 'Existing Library Sheet' }
            ]}
          />
        </div>

        {/* TAB 1: CREATURE BESTIARY */}
        {tab === 'bestiary' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[460px]">
            {/* MONSTER LIST SEARCH & SELECTION */}
            <div className="flex flex-col gap-2 border border-line bg-black/40 p-3 lg:col-span-5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-dim" />
                <input
                  type="text"
                  placeholder="Search bestiary (Skeleton, Ogre, Dragon)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border border-line bg-panel py-1.5 pl-8 pr-3 text-[12px] text-white placeholder-dim focus:border-cyan focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-dim px-1">
                <span>{filteredMonsters.length} creatures found</span>
                <span>Select a template to configure</span>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[380px] divide-y divide-line/30 border border-line/40">
                {filteredMonsters.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-dim">No matching creatures found.</div>
                ) : (
                  filteredMonsters.map((m) => {
                    const isSelected = selectedMonsterRef?.id === m.id
                    const cr = m.facts?.cr !== undefined ? `CR ${m.facts.cr}` : ''
                    const sizeType = [m.facts?.size, m.facts?.type].filter(Boolean).join(' ')

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectMonster(m)}
                        className={cn(
                          'flex w-full flex-col gap-0.5 p-2 text-left transition-colors',
                          isSelected
                            ? 'border-l-2 border-l-cyan bg-cyan/10 text-white'
                            : 'hover:bg-panel text-faint hover:text-white'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold truncate">{m.name}</span>
                          {cr && <span className="text-[10px] text-accent font-mono">{cr}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-dim">
                          <span>{sizeType || 'Creature'}</span>
                          {m.facts?.hp && <span>· {String(m.facts.hp).split(' ')[0]} HP</span>}
                          {m.facts?.ac && <span>· AC {String(m.facts.ac)}</span>}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* TEMPLATE INSPECTOR & SPAWN CONTROLS */}
            <div className="flex flex-col justify-between border border-line bg-black/60 p-4 lg:col-span-7">
              {selectedMonsterRef ? (
                <div className="flex flex-col gap-3">
                  {/* MONSTER STATS OVERVIEW */}
                  <div className="border border-line/60 bg-panel p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Skull className="h-4 w-4 text-alert" />
                          <span className="text-[14px] font-bold text-white">
                            {selectedMonsterRef.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-dim italic">
                          {[
                            selectedMonsterRef.facts?.size,
                            selectedMonsterRef.facts?.type,
                            selectedMonsterRef.facts?.alignment
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>

                      {selectedMonsterRef.facts?.cr !== undefined && (
                        <div className="border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                          CR {selectedMonsterRef.facts.cr}
                        </div>
                      )}
                    </div>

                    {/* CORE STATS BAR */}
                    <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-line/40 pt-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Heart className="h-3.5 w-3.5 text-alert" />
                        <span className="text-dim">HP:</span>
                        <span className="font-bold text-white">
                          {String(selectedMonsterRef.facts?.hp ?? '10')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-cyan" />
                        <span className="text-dim">AC:</span>
                        <span className="font-bold text-white">
                          {String(selectedMonsterRef.facts?.ac ?? '10')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-accent" />
                        <span className="text-dim">Speed:</span>
                        <span className="font-bold text-white">
                          {String(selectedMonsterRef.facts?.speed ?? '30 ft.')}
                        </span>
                      </div>
                    </div>

                    {/* ABILITY SCORES GRID */}
                    <div className="mt-2 grid grid-cols-6 gap-1 border-t border-line/40 pt-2 text-center text-[10px]">
                      {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((score) => {
                        const val = Number(selectedMonsterRef.facts?.[score]) || 10
                        const mod = Math.floor((val - 10) / 2)
                        const modStr = mod >= 0 ? `+${mod}` : `${mod}`
                        return (
                          <div key={score} className="border border-line/30 bg-black/40 py-1">
                            <span className="block uppercase text-dim">{score}</span>
                            <span className="block font-bold text-white">{val}</span>
                            <span className="block text-[9px] text-faint">({modStr})</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* INSTANCE CONFIGURATION FORM */}
                  <div className="flex flex-col gap-3">
                    {/* CUSTOM INSTANCE NAME */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-dim uppercase">
                        Character Name / Instance Title:
                      </label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder={selectedMonsterRef.name}
                        className="w-full border border-line bg-panel px-3 py-1.5 text-[12px] text-white focus:border-cyan focus:outline-none"
                      />
                      <span className="text-[10px] text-faint">
                        Will be created as a unique Character Sheet in your world.
                      </span>
                    </div>

                    {/* FACTION SELECTION */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-dim uppercase flex items-center gap-1.5">
                          <Flag className="h-3.5 w-3.5 text-cyan" />
                          Assigned Faction:
                        </label>
                        <span className="text-[10px] text-cyan">
                          Auto-suggested: {guessCreatureFaction(selectedMonsterRef)}
                        </span>
                      </div>
                      <Select
                        value={assignedFaction}
                        options={factions.map((f) => ({
                          value: f.id,
                          label: `${f.name} (${f.id.toUpperCase()}) - ${f.defaultStance.toUpperCase()}`
                        }))}
                        onChange={setAssignedFaction}
                        className="h-8 text-[11.5px]"
                      />
                      <span className="text-[10px] text-faint">
                        Determines default hostility, allegiances, and AI roleplay behavior.
                      </span>
                    </div>

                    {/* TARGET MAP SELECTION */}
                    {uses.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-dim uppercase flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-cyan" />
                          Spawn Map:
                        </label>
                        <Select
                          value={selectedMap}
                          options={uses.map((u) => ({ value: u.map, label: u.map }))}
                          onChange={setSelectedMap}
                          className="h-8 text-[11.5px]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-[12px] text-dim">
                  Select a creature template from the left.
                </div>
              )}

              {/* SPAWN ACTION BUTTON */}
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-line/60 pt-3">
                <Button size="sm" variant="ghost" onClick={onClose} disabled={spawning}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Swords className="h-3.5 w-3.5 text-cyan" />}
                  onClick={() => void handleSpawnCreature()}
                  disabled={!selectedMonsterRef || spawning}
                >
                  {spawning ? 'Spawning Creature Sheet…' : 'Spawn Creature into World'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXISTING LIBRARY CHARACTER SHEET */}
        {tab === 'library' && (
          <div className="flex flex-col gap-4 min-h-[460px]">
            {uses.length > 1 && (
              <div className="flex items-center gap-3 border border-line bg-panel px-3 py-2 text-[11px]">
                <span className="text-dim flex items-center gap-1.5 font-bold uppercase">
                  <MapPin className="h-3.5 w-3.5 text-cyan" /> Target Map:
                </span>
                <Select
                  value={selectedMap}
                  options={uses.map((u) => ({ value: u.map, label: u.map }))}
                  onChange={setSelectedMap}
                  className="h-7 text-[11px] w-48"
                />
              </div>
            )}

            <div className="flex-1">
              <EntryPicker
                kind="sheet"
                title="Pick an Existing Character Sheet"
                inline
                onPick={(hit) => void handleAddLibrarySheet(hit.id)}
                onClose={onClose}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
