import { useState } from 'react'
import {
  Check,
  Compass,
  Gem,
  Maximize2,
  Minimize2,
  RefreshCw,
  Shield,
  Sliders,
  Skull,
  Swords,
  Trash2,
  X
} from 'lucide-react'
import type {
  CreatureDisposition,
  CreatureSpawner,
  SpawnerResetMode,
  SpawnerTriggerMode
} from '@shared/maps'
import type { StoredFaction } from '@shared/game/factions'
import type { StoredLootTable } from '@shared/game/lootTables'
import { ActionBar, Input, NumberField, Segmented, Select, SliderNumber, type MenuItem } from '../ui'
import { FlagSelect } from '../game/FlagSelect'
import { ObjectPlayManager } from './ObjectPlayManager'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'

interface Props {
  spawner: CreatureSpawner
  world?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  onChange: (next: CreatureSpawner) => void
  onDelete: () => void
  onClose: () => void
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

type SpawnerTab = 'config' | 'rewards' | 'logic'

export function SpawnerInspector({
  spawner,
  world = '',
  isExpanded = false,
  onToggleExpand,
  onChange,
  onDelete,
  onClose
}: Props) {
  const [activeTab, setActiveTab] = useState<SpawnerTab>('config')

  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const lootTables: StoredLootTable[] = useLive(() => engine('lootTables.list'), 'lootTables.changed') ?? []

  const actions: MenuItem[] = [
    { label: 'Done', icon: <Check />, onSelect: onClose },
    { label: 'Delete Spawner', icon: <Trash2 />, danger: true, onSelect: onDelete }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[12px] select-none bg-black/95">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5 bg-black/80">
        <div className="flex items-center gap-2 min-w-0">
          <Skull className="h-4 w-4 text-alert shrink-0" />
          <span className="font-bold uppercase tracking-wider text-white truncate max-w-[200px]">
            {spawner.name}
          </span>
          <span className="text-[10px] text-faint border border-line/60 px-1 py-0.2 shrink-0">
            {spawner.monsterId}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-dim hover:text-white p-1 transition-colors"
              title={isExpanded ? 'Collapse panel (360px)' : 'Expand panel (680px)'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-white p-1 transition-colors"
            title="Close Inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* SUB-TABS */}
      <div className="flex border-b border-line/60 bg-panel/30 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors border',
            activeTab === 'config'
              ? 'border-cyan/60 bg-cyan/15 text-cyan'
              : 'border-transparent text-dim hover:text-white hover:bg-white/5'
          )}
        >
          <Sliders className="h-3 w-3" /> Lifecycle & Posture
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rewards')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors border',
            activeTab === 'rewards'
              ? 'border-cyan/60 bg-cyan/15 text-cyan'
              : 'border-transparent text-dim hover:text-white hover:bg-white/5'
          )}
        >
          <Gem className="h-3 w-3" /> Drops & Loot
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logic')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors border',
            activeTab === 'logic'
              ? 'border-cyan/60 bg-cyan/15 text-cyan'
              : 'border-transparent text-dim hover:text-white hover:bg-white/5'
          )}
        >
          <Swords className="h-3 w-3" /> Checks & Dialogue
        </button>
      </div>

      {/* BODY SCROLL CONTAINER */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3.5">
        {activeTab === 'config' && (
          <div className="flex flex-col gap-3.5">
            {/* INSTANCE NAME */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-dim">Spawner Instance Name:</span>
              <Input
                value={spawner.name}
                onChange={(e) => onChange({ ...spawner, name: e.target.value })}
                className="h-8 font-bold text-white text-[12.5px]"
              />
            </div>

            {/* POSITION & FACING */}
            <div className="grid grid-cols-[52px_1fr_1fr] items-center gap-1.5 border-t border-line/40 pt-2.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Place</span>
              <NumberField
                value={spawner.at.x}
                step={1}
                onChange={(x) => onChange({ ...spawner, at: { ...spawner.at, x: x ?? spawner.at.x } })}
                className="h-7 text-[12px]"
              />
              <NumberField
                value={spawner.at.y}
                step={1}
                onChange={(y) => onChange({ ...spawner, at: { ...spawner.at, y: y ?? spawner.at.y } })}
                className="h-7 text-[12px]"
              />
            </div>

            <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Facing °</span>
              <SliderNumber
                value={spawner.facing ?? 0}
                min={0}
                max={359}
                step={1}
                onChange={(facing) => onChange({ ...spawner, facing })}
                className="w-full"
              />
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">Scale</span>
              <SliderNumber
                value={spawner.scale ?? 1}
                min={0.5}
                max={3}
                step={0.1}
                onChange={(scale) => onChange({ ...spawner, scale })}
                className="w-full"
              />
            </div>

            {/* POSTURE & FACTION */}
            <div className="border-t border-line/40 pt-2.5 flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-dim flex items-center gap-1">
                <Shield className="h-3 w-3 text-cyan" /> Posture &amp; Faction
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[9.5px] uppercase text-dim">Disposition:</span>
                  <Segmented
                    value={spawner.disposition}
                    options={DISPOSITION_OPTIONS}
                    onChange={(d) => onChange({ ...spawner, disposition: d as CreatureDisposition })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9.5px] uppercase text-dim">Faction:</span>
                  <Select
                    value={spawner.faction ?? ''}
                    options={[
                      { value: '', label: 'None (Independent)' },
                      ...factions.map((f) => ({ value: f.id, label: `${f.name} (${f.id})` }))
                    ]}
                    onChange={(faction) => onChange({ ...spawner, faction: faction || undefined })}
                    className="h-8 text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* AXIS 1: SPAWN WHEN */}
            <div className="border-t border-line/40 pt-2.5 flex flex-col gap-2 bg-black/40 p-2.5 border border-line/60">
              <span className="text-[10.5px] uppercase font-bold text-cyan flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" /> 1. Spawn When (Activation Trigger):
              </span>
              <Select
                value={spawner.spawnWhen}
                options={SPAWN_WHEN_OPTIONS}
                onChange={(sw) => onChange({ ...spawner, spawnWhen: sw as SpawnerTriggerMode })}
                className="h-8 text-[11.5px]"
              />

              {spawner.spawnWhen === 'proximity' && (
                <div className="flex items-center gap-2 pt-1 border-t border-line/30">
                  <span className="text-[10px] text-dim uppercase">Detection Radius:</span>
                  <Input
                    type="number"
                    min={32}
                    max={800}
                    step={32}
                    value={spawner.triggerRadius ?? 128}
                    onChange={(e) =>
                      onChange({ ...spawner, triggerRadius: Math.max(32, Number(e.target.value)) })
                    }
                    className="h-7 w-20 text-[11.5px]"
                  />
                  <span className="text-[10px] text-faint">
                    pixels ({Math.round((spawner.triggerRadius ?? 128) / 32)} tiles)
                  </span>
                </div>
              )}

              {spawner.spawnWhen === 'on_flag' && (
                <div className="flex flex-col gap-1 pt-1 border-t border-line/30">
                  <span className="text-[10px] text-dim uppercase">Required World Flag:</span>
                  <FlagSelect
                    world={world}
                    value={spawner.spawnFlag}
                    onChange={(f) => onChange({ ...spawner, spawnFlag: f || undefined })}
                    placeholder="Select or enter flag key..."
                  />
                </div>
              )}
            </div>

            {/* AXIS 2: RESET WHEN */}
            <div className="border-t border-line/40 pt-2.5 flex flex-col gap-2 bg-black/40 p-2.5 border border-line/60">
              <span className="text-[10.5px] uppercase font-bold text-accent flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> 2. Reset When (Respawn & Persistence):
              </span>
              <Select
                value={spawner.resetWhen}
                options={RESET_WHEN_OPTIONS}
                onChange={(rw) => onChange({ ...spawner, resetWhen: rw as SpawnerResetMode })}
                className="h-8 text-[11.5px]"
              />

              {spawner.resetWhen === 'on_flag' && (
                <div className="flex flex-col gap-1 pt-1 border-t border-line/30">
                  <span className="text-[10px] text-dim uppercase">Reset World Flag:</span>
                  <FlagSelect
                    world={world}
                    value={spawner.resetFlag}
                    onChange={(f) => onChange({ ...spawner, resetFlag: f || undefined })}
                    placeholder="Flag that resets this spawner..."
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DROPS & LOOT */}
        {activeTab === 'rewards' && (
          <div className="flex flex-col gap-3">
            <div className="border border-line/50 bg-black/40 p-3 flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase text-white flex items-center gap-1.5">
                <Gem className="h-3.5 w-3.5 text-cyan" /> Defeat Drop Table:
              </span>
              <span className="text-[10.5px] text-dim leading-relaxed">
                When this creature is defeated in tactical combat or encounters, this loot table is automatically rolled and awarded.
              </span>
              <Select
                value={spawner.lootTableId ?? ''}
                options={[
                  { value: '', label: 'Default monster drop (None)' },
                  ...lootTables.map((t) => ({ value: t.id, label: `${t.name} (${t.entries.length} drops)` }))
                ]}
                onChange={(lootTableId) => onChange({ ...spawner, lootTableId: lootTableId || undefined })}
                className="h-8 text-[11.5px] mt-1"
              />
            </div>
          </div>
        )}

        {/* TAB 3: CHECKS & DIALOGUE */}
        {activeTab === 'logic' && (
          <div className="flex flex-col gap-3">
            <div className="border border-cyan/30 bg-cyan/5 p-2 text-[11px] text-cyan leading-relaxed">
              Interactive checks (bribes, intimidation, pickpocketing) and decisions configured here are saved directly with this spawner.
            </div>
            <ObjectPlayManager
              actionsText={spawner.actions ?? ''}
              decisionsText={spawner.decisions ?? ''}
              onChangeActions={(actions) => onChange({ ...spawner, actions })}
              onChangeDecisions={(decisions) => onChange({ ...spawner, decisions })}
              world={world}
            />
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </div>
  )
}
