import { Field, FieldGrid, Select } from '../../ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useWorldMaps } from '../../maps/useMap'
import { registerTriggerUi, type TriggerEditorProps } from './registry'

function ChangeMapEditor({ trigger, world, onValues }: TriggerEditorProps) {
  const uses = useWorldMaps(world) ?? []
  const names = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const map = String(trigger.values.map ?? '')
  const place = String(trigger.values.place ?? '')
  const target = uses.find((u) => u.map === map)
  return (
    <FieldGrid dense>
      <Field label="Map" tip="One of this world's maps.">
        <Select value={map} options={[{ value: '', label: 'None' }, ...uses.map((u) => ({ value: u.map, label: names.find((n) => n.id === u.map)?.name ?? u.map }))]} onChange={(next) => onValues({ ...trigger.values, map: next, place: '' })} />
      </Field>
      <Field label="Arrive at" tip="A place drawn on that map. None arrives in the middle.">
        <Select value={place} options={[{ value: '', label: 'The middle' }, ...Object.keys(target?.shapes ?? {}).map((k) => ({ value: k, label: k }))]} onChange={(next) => onValues({ ...trigger.values, place: next })} />
      </Field>
    </FieldGrid>
  )
}

registerTriggerUi('change_map', {
  run: (trigger, ctx) => {
    const map = String(trigger.values.map ?? '')
    if (map) ctx.goTo(map, String(trigger.values.place ?? ''))
  },
  Editor: ChangeMapEditor
})
