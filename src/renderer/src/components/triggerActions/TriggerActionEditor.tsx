import { Effects } from '@shared/game/components'
import { triggerActionEffects, type StoredTriggerAction } from '@shared/game/triggerActions'
import { Field, Input, TagInput, Textarea } from '../ui'
import { EffectsEditor } from '../game/effects/EffectsEditor'

export function TriggerActionEditor({ value, onChange }: { value: StoredTriggerAction; onChange: (next: StoredTriggerAction) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name">
        <Input value={value.name} placeholder="Goblin loot, Trap damage…" onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </Field>
      <EffectsEditor host={Effects.type} value={triggerActionEffects(value)} onChange={(effects) => onChange({ ...value, effects, actionType: undefined, params: undefined })} />
      <Field label="Notes">
        <Textarea value={value.description} placeholder="When and where it is used" rows={2} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </Field>
      <Field label="Tags">
        <TagInput value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />
      </Field>
    </div>
  )
}
