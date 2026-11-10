import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Select } from '../../../components/ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useWorldMaps } from '../../../components/maps/useMap'

interface ChangeWorldParams {
  world?: string
  map?: string
}

function ChangeWorldEditor({ params, onChange }: { params: ChangeWorldParams; onChange: (p: ChangeWorldParams) => void }) {
  const worldList = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const worldId = String(params.world ?? '')
  const uses = useWorldMaps(worldId) ?? []
  const mapNames = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const mapId = String(params.map ?? '')

  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <FieldGrid dense>
        <Field label="TARGET WORLD">
          <Select
            value={worldId}
            options={[
              { value: '', label: 'Select world...' },
              ...worldList.map((w) => ({ value: w.id, label: w.name || w.id }))
            ]}
            onChange={(next) => onChange({ ...params, world: next, map: '' })}
          />
        </Field>
        <Field label="STARTING MAP">
          <Select
            value={mapId}
            options={[
              { value: '', label: 'Default world start map' },
              ...uses.map((u) => ({
                value: u.map,
                label: mapNames.find((n) => n.id === u.map)?.name ?? u.map
              }))
            ]}
            onChange={(next) => onChange({ ...params, map: next })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

registerTriggerActionHandler<ChangeWorldParams>({
  type: 'change_world',
  label: 'Change World',
  description: 'Transitions the game session to a different world and map.',
  icon: 'globe',
  Editor: ChangeWorldEditor,
  execute: async (params, ctx) => {
    const targetWorld = String(params.world ?? '').trim()
    if (!targetWorld) return
    const targetMap = String(params.map ?? '').trim()
    await ctx.engine('worlds.activate', { world: targetWorld, map: targetMap || undefined })
  }
})
