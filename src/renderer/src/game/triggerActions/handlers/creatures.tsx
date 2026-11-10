import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Input } from '../../../components/ui'
import { EntrySelect } from '../../../components/game/EntrySelect'

interface CreatureParams {
  creatureTemplate?: string
  factionId?: string
  x?: number
  y?: number
  encounterId?: string
}

function SpawnCreatureEditor({ params, onChange }: { params: CreatureParams; onChange: (p: CreatureParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="CREATURE / CHARACTER TEMPLATE">
        <EntrySelect
          value={params.creatureTemplate ?? undefined}
          onChange={(entry) => onChange({ ...params, creatureTemplate: entry ?? '' })}
          placeholder="Select character or creature sheet..."
        />
      </Field>

      <FieldGrid dense>
        <Field label="SPAWN OFFSET X (PX)">
          <Input
            type="number"
            value={params.x ?? 0}
            onChange={(e) => onChange({ ...params, x: Number(e.target.value) })}
          />
        </Field>
        <Field label="SPAWN OFFSET Y (PX)">
          <Input
            type="number"
            value={params.y ?? 0}
            onChange={(e) => onChange({ ...params, y: Number(e.target.value) })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

function StartCombatEditor({ params, onChange }: { params: CreatureParams; onChange: (p: CreatureParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="COMBAT ENCOUNTER ID / LEADER">
        <Input
          value={params.encounterId ?? ''}
          placeholder="e.g. encounter_ambush, boss_lich..."
          onChange={(e) => onChange({ ...params, encounterId: e.target.value })}
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<CreatureParams>({
  type: 'spawn_creature',
  label: 'Spawn Creature / NPC',
  description: 'Spawns a creature token dynamically onto the active map.',
  icon: 'skull',
  Editor: SpawnCreatureEditor,
  execute: async (params, ctx) => {
    const template = String(params.creatureTemplate ?? '').trim()
    if (!template) return
    await ctx.spawnCreature(template, params.factionId, {
      x: Number(params.x) || 0,
      y: Number(params.y) || 0
    })
  }
})

registerTriggerActionHandler<CreatureParams>({
  type: 'start_combat',
  label: 'Initiate Combat Encounter',
  description: 'Transitions 2D exploration into turn-based tactical battle.',
  icon: 'swords',
  Editor: StartCombatEditor,
  execute: async (params, ctx) => {
    const encounter = String(params.encounterId ?? '').trim()
    await ctx.startCombat(encounter || 'encounter_default')
  }
})
