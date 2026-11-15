import { Field, FieldGrid, Select } from '../../ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useWorldMaps } from '../../maps/useMap'
import { TravelPanel, useWorldList } from '../TravelPanel'
import { registerTriggerUi, type TriggerEditorProps, type TriggerPanelProps } from './registry'

function ArriveFields({ trigger, target, onValues }: { trigger: TriggerEditorProps['trigger']; target: string; onValues: TriggerEditorProps['onValues'] }) {
  const map = String(trigger.values.map ?? '')
  const place = String(trigger.values.place ?? '')
  const uses = useWorldMaps(target) ?? []
  const names = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const use = uses.find((u) => u.map === map) ?? uses[0]
  return (
    <>
      <Field label="Map" tip="One of its maps. None uses its first.">
        <Select value={map} options={[{ value: '', label: 'Its first map' }, ...uses.map((u) => ({ value: u.map, label: names.find((n) => n.id === u.map)?.name ?? u.map }))]} onChange={(next) => onValues({ ...trigger.values, map: next, place: '' })} />
      </Field>
      <Field label="Arrive at" tip="A place drawn on that map. None arrives in the middle.">
        <Select value={place} options={[{ value: '', label: 'The middle' }, ...Object.keys(use?.shapes ?? {}).map((k) => ({ value: k, label: k }))]} onChange={(next) => onValues({ ...trigger.values, place: next })} />
      </Field>
    </>
  )
}

function ChangeWorldEditor({ trigger, world, onValues }: TriggerEditorProps) {
  const worlds = useWorldList().filter((w) => w.id !== world)
  const target = String(trigger.values.world ?? '')
  return (
    <FieldGrid dense>
      <Field label="World" tip="The world it leads to.">
        <Select value={target} options={[{ value: '', label: 'None' }, ...worlds.map((w) => ({ value: w.id, label: w.name }))]} onChange={(next) => onValues({ ...trigger.values, world: next, map: '', place: '' })} />
      </Field>
      {target && <ArriveFields key={target} trigger={trigger} target={target} onValues={onValues} />}
    </FieldGrid>
  )
}

function ChangeWorldPanel({ trigger, ctx }: TriggerPanelProps) {
  return <TravelPanel world={String(trigger.values.world ?? '')} map={String(trigger.values.map ?? '')} place={String(trigger.values.place ?? '')} sheet={ctx.sheet} onDone={ctx.close} />
}

registerTriggerUi('change_world', { Panel: ChangeWorldPanel, Editor: ChangeWorldEditor })
