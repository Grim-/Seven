import { cleanComponents } from '@shared/game/core'
import { mapObjects } from '@shared/maps'
import { triggerType } from '@shared/game/triggers'
import { Field, FieldGrid, Select } from '../../ui'
import { ParamTokens } from '../../game/ParamTokens'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { useLive } from '../../../lib/useLive'
import { toast } from '../../../store/toasts'
import { effectLines } from '../cardEffects'
import { NoteView } from '../NoteView'
import { showPlay, usePlay } from '../playStore'
import { playViewEvents } from '../viewActs'
import { triggerOutcomeVfx } from '../../vfx'
import { registerTriggerUi, type TriggerEditorProps } from './registry'

function EffectsTriggerEditor({ trigger, map, onValues }: TriggerEditorProps) {
  const data = useLive(() => (map ? engine('maps.get', { id: map }) : Promise.resolve(null)), 'maps.changed', [map])
  const { caster: _caster, ...rest } = triggerType(trigger.type)?.params ?? {}
  const objects = data ? mapObjects(data.layers) : []
  return (
    <div className="flex flex-col gap-3">
      <FieldGrid dense>
        <Field label="Cast by" tip="An object on this map casts the effects, with its pieces. None: the trigger casts them.">
          <Select value={String(trigger.values.caster ?? '')} options={[{ value: '', label: 'The trigger' }, ...objects.map((o) => ({ value: o.id, label: o.name }))]} onChange={(caster) => onValues({ ...trigger.values, caster })} />
        </Field>
      </FieldGrid>
      <ParamTokens schema={rest} values={trigger.values} onChange={(v) => onValues({ ...trigger.values, ...v })} />
    </div>
  )
}

registerTriggerUi('effects', {
  Editor: EffectsTriggerEditor,
  wide: true,
  run: (trigger, ctx) => {
    const defs = cleanComponents(trigger.values.effects)
    if (!defs.length) return
    const caster = String(trigger.values.caster ?? '') || trigger.id
    const target = { sheet: ctx.sheet }
    engine('effects.run', { defs, user: { placed: { map: ctx.map, id: caster } }, target, world: ctx.world })
      .then(async (done) => {
        triggerOutcomeVfx(done, [ctx.sheet ? `sheet:${ctx.sheet}` : null])
        await playViewEvents(done.view, trigger.name, ctx.world)
        const lines = effectLines(done)
        if (usePlay.getState().view) return
        if (lines.length) showPlay(trigger.name, <NoteView text={lines.join('\n\n')} empty="" onClose={ctx.close} />)
        else toast.info(trigger.name, 'Nothing happens.')
      })
      .catch(failed(`Could not run ${trigger.name}`))
  }
})
