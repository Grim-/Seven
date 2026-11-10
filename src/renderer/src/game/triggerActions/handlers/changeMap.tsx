import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Select } from '../../../components/ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useWorldMaps } from '../../../components/maps/useMap'

interface ChangeMapParams {
  map?: string
  place?: string
  x?: number
  y?: number
}

function ChangeMapEditor({ world = '', params, onChange }: { world?: string; params: ChangeMapParams; onChange: (p: ChangeMapParams) => void }) {
  const uses = useWorldMaps(world) ?? []
  const names = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const map = String(params.map ?? '')
  const place = String(params.place ?? '')
  const target = uses.find((u) => u.map === map)

  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <FieldGrid dense>
        <Field label="DESTINATION MAP">
          <Select
            value={map}
            options={[
              { value: '', label: 'Select destination map...' },
              ...uses.map((u) => ({
                value: u.map,
                label: names.find((n) => n.id === u.map)?.name ?? u.map
              }))
            ]}
            onChange={(next) => onChange({ ...params, map: next, place: '' })}
          />
        </Field>
        <Field label="ARRIVE AT PLACE">
          <Select
            value={place}
            options={[
              { value: '', label: 'Map center / Default spawn' },
              ...Object.keys(target?.shapes ?? {}).map((k) => ({ value: k, label: k }))
            ]}
            onChange={(next) => onChange({ ...params, place: next })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

registerTriggerActionHandler<ChangeMapParams>({
  type: 'change_map',
  label: 'Teleport to Map',
  description: 'Warps the active party to another map or place marker in this world.',
  icon: 'map-pin',
  Editor: ChangeMapEditor,
  execute: async (params, ctx) => {
    const map = String(params.map ?? '').trim()
    if (!map) return
    const place = String(params.place ?? '').trim()
    await ctx.warp(map, place || undefined)
  }
})
