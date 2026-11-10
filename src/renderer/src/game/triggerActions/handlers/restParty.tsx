import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Input } from '../../../components/ui'
import { FlagSelect } from '../../../components/game/FlagSelect'

interface RestPartyParams {
  healAmount?: number
  cooldownFlag?: string
  restMessage?: string
}

function RestPartyEditor({ params, onChange }: { params: RestPartyParams; onChange: (p: RestPartyParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <FieldGrid dense>
        <Field label="HP RESTORED PER MEMBER">
          <Input
            type="number"
            min={1}
            value={params.healAmount ?? 50}
            onChange={(e) => onChange({ ...params, healAmount: Math.max(1, Number(e.target.value)) })}
            className="h-8 text-[12px]"
          />
        </Field>
      </FieldGrid>

      <Field label="COOLDOWN / SPENT WORLD FLAG (OPTIONAL)">
        <FlagSelect
          value={params.cooldownFlag ?? ''}
          onChange={(flag) => onChange({ ...params, cooldownFlag: flag ?? '' })}
          placeholder="e.g. campfire_spent, oasis_rested"
        />
        <span className="text-[10px] text-dim mt-1">
          Setting this flag triggers declarative object behaviors (e.g. switches lit campfire to extinguished embers).
        </span>
      </Field>

      <Field label="REST NOTIFICATION">
        <Input
          value={params.restMessage ?? ''}
          placeholder="The party takes a rest and recovers their strength."
          onChange={(e) => onChange({ ...params, restMessage: e.target.value })}
          className="h-8 text-[11.5px]"
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<RestPartyParams>({
  type: 'rest_party',
  label: 'Rest & Recover Party',
  description: 'Restores HP/resources to the party and optionally sets a cooldown/spent world flag.',
  icon: 'coffee',
  Editor: RestPartyEditor,
  execute: async (params, ctx) => {
    const heal = Number(params.healAmount) || 50
    await ctx.modifyHealth('party', heal)

    if (params.cooldownFlag?.trim()) {
      await ctx.setFlag(params.cooldownFlag.trim(), true)
    }

    const msg = params.restMessage?.trim() || 'The party rested and recovered HP.'
    ctx.notify(msg, 'cyan')
  }
})
