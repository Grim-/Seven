import type { StoredTriggerAction } from '@shared/game/triggerActions'
import { Field, Input, Select, TagInput, Textarea } from '../ui'
import { allTriggerActionHandlers, getTriggerActionHandler } from '../../game/triggerActions/registry'
import '../../game/triggerActions/handlers'

interface Props {
  value: StoredTriggerAction
  onChange: (next: StoredTriggerAction) => void
}

export function TriggerActionEditor({ value, onChange }: Props) {
  const handlers = allTriggerActionHandlers()
  const handler = getTriggerActionHandler(value.actionType) ?? handlers[0]

  const handleTypeChange = (newType: string) => {
    onChange({
      ...value,
      actionType: newType,
      params: {} // Reset params for new type
    })
  }

  const handleParamsChange = (nextParams: Record<string, unknown>) => {
    onChange({
      ...value,
      params: nextParams
    })
  }

  const EditorComponent = handler?.Editor

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* ACTION NAME & BEHAVIOR TYPE */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="ACTION NAME">
          <Input
            value={value.name}
            placeholder="e.g. Teleport to Boss Chamber, Award 50 Gold..."
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="h-8 text-[13px]"
          />
        </Field>

        <Field label="ACTION BEHAVIOR TYPE">
          <Select
            value={value.actionType}
            options={handlers.map((h) => ({
              value: h.type,
              label: `${h.label} (${h.type})`
            }))}
            onChange={handleTypeChange}
          />
        </Field>
      </div>

      {/* DYNAMIC PARAMETER EDITOR */}
      {EditorComponent && (
        <div className="border border-line/50 bg-black/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-line/30 pb-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
              {handler.label} Settings
            </span>
            <span className="text-[9.5px] text-faint">{handler.description}</span>
          </div>

          <EditorComponent
            params={value.params}
            onChange={handleParamsChange}
          />
        </div>
      )}

      {/* DESCRIPTION */}
      <Field label="DESCRIPTION (NOTES / PURPOSE)">
        <Textarea
          value={value.description}
          placeholder="Internal notes on when and where this trigger action is invoked..."
          rows={2}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </Field>

      {/* TAGS */}
      <Field label="TAGS">
        <TagInput
          value={value.tags}
          onChange={(tags) => onChange({ ...value, tags })}
        />
      </Field>
    </div>
  )
}
