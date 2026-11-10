import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Input, Segmented } from '../../../components/ui'

interface CueParams {
  cueId?: string
  sound?: string
  message?: string
  tone?: 'accent' | 'cyan' | 'warn' | 'danger'
}

function CueEditor({ params, onChange }: { params: CueParams; onChange: (p: CueParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="VISUAL CUE EFFECT">
        <Segmented
          value={params.cueId ?? 'shake'}
          options={[
            { value: 'shake', label: 'Screen Shake' },
            { value: 'flash', label: 'Screen Flash' },
            { value: 'none', label: 'Audio Only / None' }
          ]}
          onChange={(cueId) => onChange({ ...params, cueId: cueId as string })}
        />
      </Field>

      <FieldGrid dense>
        <Field label="SOUND EFFECT ASSET / PATH">
          <Input
            value={params.sound ?? ''}
            placeholder="e.g. sfx/door_open.mp3"
            onChange={(e) => onChange({ ...params, sound: e.target.value })}
          />
        </Field>
        <Field label="NOTIFICATION TOAST (OPTIONAL)">
          <Input
            value={params.message ?? ''}
            placeholder="e.g. You hear gears grinding in the deep..."
            onChange={(e) => onChange({ ...params, message: e.target.value })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

registerTriggerActionHandler<CueParams>({
  type: 'play_cue',
  label: 'Audio/Visual Cue & Toast',
  description: 'Triggers camera shake, screen flash, audio effects, or floating feedback.',
  icon: 'sparkles',
  Editor: CueEditor,
  execute: async (params, ctx) => {
    if (params.cueId && params.cueId !== 'none') {
      await ctx.playCue(params.cueId, params.sound)
    }
    if (params.message) {
      ctx.notify(params.message, params.tone ?? 'accent')
    }
  }
})
