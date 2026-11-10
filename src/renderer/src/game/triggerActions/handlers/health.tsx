import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Input, Segmented } from '../../../components/ui'

interface HealthParams {
  target?: 'player' | 'party' | 'target'
  amount?: number
  damageType?: string
}

function HealthEditor({ params, onChange }: { params: HealthParams; onChange: (p: HealthParams) => void }) {
  const amount = Number(params.amount ?? -5)
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="TARGET ENTITY">
        <Segmented
          value={params.target ?? 'player'}
          options={[
            { value: 'player', label: 'Lead Player' },
            { value: 'party', label: 'All Party Members' },
            { value: 'target', label: 'Interacting Target' }
          ]}
          onChange={(target) => onChange({ ...params, target: target as any })}
        />
      </Field>

      <FieldGrid dense>
        <Field label="HP MODIFIER (NEGATIVE = DAMAGE, POSITIVE = HEAL)">
          <Input
            type="number"
            value={amount}
            onChange={(e) => onChange({ ...params, amount: Number(e.target.value) })}
          />
        </Field>
        <Field label="DAMAGE / HEALING TYPE (OPTIONAL)">
          <Input
            value={params.damageType ?? ''}
            placeholder="e.g. fire, radiant, poison, physical..."
            onChange={(e) => onChange({ ...params, damageType: e.target.value })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

registerTriggerActionHandler<HealthParams>({
  type: 'modify_health',
  label: 'Damage / Heal HP',
  description: 'Inflicts damage or restores hit points to player or party members.',
  icon: 'heart-pulse',
  Editor: HealthEditor,
  execute: async (params, ctx) => {
    const amount = Number(params.amount) || 0
    if (amount === 0) return
    const target = params.target ?? 'player'
    await ctx.modifyHealth(target, amount)
  }
})
