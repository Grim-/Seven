import { DoorOpen, Plus } from 'lucide-react'
import { Button, Field, FieldGrid, Select, askText } from '../../ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useBusy } from '../../../lib/useBusy'
import { openEntry } from '../../../lib/library'
import { useWorldMaps } from '../../maps/useMap'
import { useWorldSaves } from '../useSaves'
import { noteMisfits } from '../misfits'
import { registerTriggerUi, type TriggerEditorProps, type TriggerPanelProps } from './registry'

function useWorldList() {
  return useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
}

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
  const target = String(trigger.values.world ?? '')
  const world = useWorldList().find((w) => w.id === target)
  const list = useWorldSaves(target)
  const sheet = useLive(() => engine('sheets.get', { id: ctx.sheet }), 'saves.changed')
  const [busy, run] = useBusy()
  if (!target || !world) return <span className="text-[13px] text-faint">This way leads nowhere yet. Edit the trigger to pick a world.</span>
  const go = (id: string) =>
    void run(async () => {
      await engine('saves.travel', { sheet: ctx.sheet, id, map: String(trigger.values.map ?? ''), place: String(trigger.values.place ?? '') })
      if (sheet) await noteMisfits(ctx.sheet, sheet.title)
      ctx.close()
      openEntry('world', target)
    }, 'Could not go there')
  const fresh = () =>
    askText(`New save of ${world.name}`, 'Name', '', (name) =>
      void run(async () => {
        const made = await engine('saves.create', { world: target, name, copy: false })
        go(made.id)
      }, 'Could not make the save')
    )
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-dim">
        {sheet?.title ?? 'They'} leave{sheet ? 's' : ''} this save, taking their state, and join a save of <b className="text-white">{world.name}</b>.
      </span>
      <div className="flex flex-col gap-1.5">
        {(list?.saves ?? []).map((s) => (
          <button key={s.id} type="button" disabled={busy} onClick={() => go(s.id)} className="flex items-center gap-2 border border-line/50 px-3 py-2 text-left hover:border-accent/60">
            <DoorOpen className="h-4 w-4 text-accent" />
            <span className="flex-1 text-[13px] text-white">{s.name}</span>
            <span className="font-mono text-[11px] text-dim">{s.characters.length} in it</span>
          </button>
        ))}
      </div>
      <Button variant="primary" icon={<Plus />} className="self-start" disabled={busy} onClick={fresh}>
        A new save
      </Button>
    </div>
  )
}

registerTriggerUi('change_world', { Panel: ChangeWorldPanel, Editor: ChangeWorldEditor })
