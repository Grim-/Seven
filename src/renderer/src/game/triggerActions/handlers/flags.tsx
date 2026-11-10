import { registerTriggerActionHandler } from '../registry'
import { Field, Input, Segmented } from '../../../components/ui'
import { FlagSelect } from '../../../components/game/FlagSelect'

interface FlagParams {
  flag?: string
  operation?: 'set' | 'clear' | 'toggle' | 'increment'
  value?: string
}

function FlagEditor({ world = '', params, onChange }: { world?: string; params: FlagParams; onChange: (p: FlagParams) => void }) {
  const op = params.operation ?? 'set'
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="WORLD FLAG">
        <FlagSelect
          world={world}
          value={params.flag ?? ''}
          onChange={(flag) => onChange({ ...params, flag: flag ?? '' })}
          placeholder="Select or enter flag key..."
        />
      </Field>

      <Field label="OPERATION">
        <Segmented
          value={op}
          options={[
            { value: 'set', label: 'Set (True / Value)' },
            { value: 'clear', label: 'Clear (False)' },
            { value: 'toggle', label: 'Toggle (Flip)' },
            { value: 'increment', label: 'Increment (+1)' }
          ]}
          onChange={(operation) => onChange({ ...params, operation: operation as any })}
        />
      </Field>

      {op === 'set' && (
        <Field label="CUSTOM VALUE (OPTIONAL, DEFAULTS TO TRUE)">
          <Input
            value={params.value ?? ''}
            placeholder="true"
            onChange={(e) => onChange({ ...params, value: e.target.value })}
          />
        </Field>
      )}
    </div>
  )
}

registerTriggerActionHandler<FlagParams>({
  type: 'set_flag',
  label: 'Modify World Flag',
  description: 'Sets, clears, toggles, or increments a world flag in the save state.',
  icon: 'flag',
  Editor: FlagEditor,
  execute: async (params, ctx) => {
    const flag = String(params.flag ?? '').trim()
    if (!flag) return

    const op = params.operation ?? 'set'
    const curVal = ctx.flags[flag]

    let newVal: unknown = true
    if (op === 'clear') {
      newVal = false
    } else if (op === 'toggle') {
      newVal = !curVal
    } else if (op === 'increment') {
      newVal = (typeof curVal === 'number' ? curVal : 0) + 1
    } else {
      newVal = params.value !== undefined && params.value !== '' ? params.value : true
    }

    await ctx.setFlag(flag, newVal)
  }
})
