import type { StoredAction } from '@shared/storedAction'
import { Field, Input, TagInput } from '../ui'
import { ActionForm } from '../play/ActionForm'

const TRY = { link: null, agents: [] }

export function StoryActionEditor({ value, onChange }: { value: StoredAction; onChange: (next: StoredAction) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Name">
        <Input autoFocus={!value.name} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Name" />
      </Field>
      <Field label="Tags">
        <TagInput value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />
      </Field>
      <ActionForm initial={value.action} character={null} where={TRY} keepLabel="" onChange={(action) => onChange({ ...value, action })} />
    </div>
  )
}
