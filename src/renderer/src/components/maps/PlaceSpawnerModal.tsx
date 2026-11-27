import { useMemo, useState } from 'react'
import type { CompendiumRef } from '@shared/compendium'
import type { StoredFaction } from '@shared/game/factions'
import { showName } from '@shared/ids'
import type { CreatureDisposition, CreatureSpawner, SpawnerResetMode, SpawnerTriggerMode } from '@shared/maps'
import type { Point } from '@shared/shapes'
import type { WorldNpc } from '@shared/worldNpcs'
import { Button, EmptyState, Field, ListRow, Modal, NumberField, SearchListPanel, Segmented, Select } from '../ui'
import { LinkTextarea } from '../data/LinkTextarea'
import { useCompendiumList } from '../dnd/useCompendiumList'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

interface Props {
  at: Point
  world?: string
  onClose: () => void
  onPlaced: (spawner: CreatureSpawner) => void
}

const DISPOSITION_OPTIONS: { value: CreatureDisposition; label: string }[] = [
  { value: 'hostile', label: 'Hostile' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'friendly', label: 'Friendly' }
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

type SpawnerSourceTab = 'archetypes' | 'bestiary'

export function PlaceSpawnerModal({ at, world = '', onClose, onPlaced }: Props) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const allTemplateNpcs: WorldNpc[] =
    useLive(() => engine('npcs.list', { world: world || null, layer: 'template' }), 'npcs.changed', [world]) ?? []
  const archetypes = useMemo(
    () => allTemplateNpcs.filter((n) => n.archetype || Boolean(world)),
    [allTemplateNpcs, world]
  )
  const { refs: monsters } = useCompendiumList('monster')
  const factions: StoredFaction[] =
    useLive(() => engine('factions.list', { world: world || null }), 'factions.changed', [world]) ?? []

  const [sourceTab, setSourceTab] = useState<SpawnerSourceTab>(archetypes.length > 0 ? 'archetypes' : 'bestiary')
  const [search, setSearch] = useState('')
  const [selectedNpcKey, setSelectedNpcKey] = useState<string | null>(null)
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [faction, setFactionId] = useState('')
  const [disposition, setDisposition] = useState<CreatureDisposition>('hostile')
  const [spawnWhen, setSpawnWhen] = useState<SpawnerTriggerMode>('map_load')
  const [triggerRadius, setTriggerRadius] = useState(128)
  const [resetWhen, setResetWhen] = useState<SpawnerResetMode>('never')

  const filteredNpcs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? archetypes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.id.toLowerCase().includes(q) ||
            (n.values.Identity ?? '').toLowerCase().includes(q)
        )
      : archetypes
    return list.slice(0, 50)
  }, [archetypes, search])

  const filteredMonsters = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return monsters.slice(0, 40)
    return monsters
      .filter((m) => {
        const nameMatch = m.name.toLowerCase().includes(q)
        const typeMatch = String(m.facts?.type ?? '').toLowerCase().includes(q)
        const crMatch = String(m.facts?.cr ?? '').toLowerCase().includes(q)
        return nameMatch || typeMatch || crMatch
      })
      .slice(0, 40)
  }, [monsters, search])

  const activeNpc =
    filteredNpcs.find((n) => `${n.worldId ?? world}/${n.id}` === selectedNpcKey) ?? filteredNpcs[0] ?? null
  const activeMonster: CompendiumRef | null =
    filteredMonsters.find((m) => m.id === selectedMonsterId) ?? filteredMonsters[0] ?? null

  const selectNpc = (n: WorldNpc) => {
    const wId = n.worldId || world
    setSelectedNpcKey(`${wId}/${n.id}`)
    setName(n.title)
    if (n.faction) setFactionId(n.faction)
    if (n.disposition) setDisposition(n.disposition)
  }

  const selectMonster = (m: CompendiumRef) => {
    setSelectedMonsterId(m.id)
    setName(m.name)
    setFactionId(
      (prev) => prev || factions.find((f) => f.defaultStance === disposition)?.id || factions[0]?.id || ''
    )
  }

  const resolvedMonsterId =
    sourceTab === 'archetypes'
      ? activeNpc
        ? `@world:${activeNpc.worldId || world}/npc/${activeNpc.id}`
        : ''
      : (activeMonster?.id ?? '')

  const defaultName =
    sourceTab === 'archetypes'
      ? (activeNpc?.title ?? '')
      : (activeMonster?.name ?? '')

  const handlePlace = () => {
    if (!resolvedMonsterId) return
    const spawner: CreatureSpawner = {
      id: crypto.randomUUID(),
      name: name.trim() || defaultName || resolvedMonsterId,
      monsterId: resolvedMonsterId,
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
    <Modal open={true} title={`Place Spawner at (${at.x}, ${at.y})`} onClose={onClose} wide>
      <div className="flex flex-col gap-4 font-ui select-none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
          <span className="text-[12px] text-dim">
            Pick a World NPC Archetype or Bestiary Creature to spawn
          </span>
          <Segmented
            value={sourceTab}
            onChange={setSourceTab}
            options={[
              { value: 'archetypes', label: `Archetypes (${archetypes.length})` },
              { value: 'bestiary', label: `Bestiary (${monsters.length})` }
            ]}
          />
        </div>

        <div className="grid min-h-[400px] grid-cols-1 gap-4 lg:grid-cols-12">
          {sourceTab === 'archetypes' ? (
            <SearchListPanel
              query={search}
              onQuery={setSearch}
              placeholder="Filter world archetypes"
              count={`${filteredNpcs.length} templates`}
              className="max-h-[440px] lg:col-span-5"
            >
              {filteredNpcs.map((n) => {
                const wId = n.worldId || world
                const wName = worlds.find((w) => w.id === wId)?.name ?? wId
                const key = `${wId}/${n.id}`
                return (
                  <ListRow
                    key={key}
                    active={activeNpc ? `${activeNpc.worldId || world}/${activeNpc.id}` === key : false}
                    onClick={() => selectNpc(n)}
                    title={showName(n.title)}
                    subtitle={[!world && wName ? wName : '', n.values.Identity ?? ''].filter(Boolean).join(' · ') || 'World NPC template'}
                    meta={n.archetype ? 'Archetype' : 'NPC'}
                  />
                )
              })}
              {!filteredNpcs.length && (
                <EmptyState title="No world archetypes found">
                  Create an Archetype in Cast &amp; Party, or switch to Bestiary.
                </EmptyState>
              )}
            </SearchListPanel>
          ) : (
            <SearchListPanel
              query={search}
              onQuery={setSearch}
              placeholder="Filter bestiary (Goblin, Bandit, Dire Wolf)"
              count={`${filteredMonsters.length} creatures`}
              className="max-h-[440px] lg:col-span-5"
            >
              {filteredMonsters.map((m) => (
                <ListRow
                  key={m.id}
                  active={activeMonster?.id === m.id}
                  onClick={() => selectMonster(m)}
                  title={m.name}
                  subtitle={[
                    String(m.facts?.type ?? 'Creature'),
                    m.facts?.hp !== undefined ? `${m.facts.hp} HP` : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  meta={m.facts?.cr !== undefined ? `CR ${m.facts.cr}` : undefined}
                />
              ))}
              {!filteredMonsters.length && <EmptyState title="No match">Try another creature name.</EmptyState>}
            </SearchListPanel>
          )}

          <div className="flex flex-col justify-between border border-line/60 tone-panel-50 p-4 lg:col-span-7">
            <div className="flex flex-col gap-3.5">
              <Field label="Spawned Instance Name" tip="Type @ to link a repo with :roll.">
                <LinkTextarea
                  rolls={false}
                  rows={1}
                  value={name}
                  onValue={setName}
                  placeholder={defaultName || 'Harbor Sentry'}
                  className="min-h-8 resize-none"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Initial Disposition">
                  <Segmented value={disposition} onChange={setDisposition} options={DISPOSITION_OPTIONS} />
                </Field>
                <Field label="Faction">
                  <Select
                    value={faction}
                    options={[
                      { value: '', label: 'None (Independent)' },
                      ...factions.map((f) => ({ value: f.id, label: `${f.name} (${f.id})` }))
                    ]}
                    onChange={setFactionId}
                    className="h-8 text-[11px]"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-line/40 pt-3 md:grid-cols-2">
                <Field label="Spawn When">
                  <Select
                    value={spawnWhen}
                    options={SPAWN_WHEN_OPTIONS}
                    onChange={(sw) => setSpawnWhen(sw as SpawnerTriggerMode)}
                    className="h-8 text-[11.5px]"
                  />
                </Field>
                <Field label="Reset When">
                  <Select
                    value={resetWhen}
                    options={RESET_WHEN_OPTIONS}
                    onChange={(rw) => setResetWhen(rw as SpawnerResetMode)}
                    className="h-8 text-[11.5px]"
                  />
                </Field>
              </div>

              {spawnWhen === 'proximity' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] caps text-dim">Detection Radius:</span>
                  <NumberField
                    min={32}
                    max={800}
                    step={32}
                    value={triggerRadius}
                    onChange={(v) => v !== undefined && setTriggerRadius(Math.round(v))}
                    className="h-7 w-20 text-[11px]"
                  />
                  <span className="text-[10.5px] text-faint">pixels ({Math.round(triggerRadius / 32)} tiles)</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3">
              <span className="truncate font-mono text-[10.5px] text-dim">{resolvedMonsterId || 'No template selected'}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handlePlace} disabled={!resolvedMonsterId}>
                  Place Spawner
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
