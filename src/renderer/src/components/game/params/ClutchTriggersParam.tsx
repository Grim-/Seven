import { Plus, X } from 'lucide-react'
import { signalLabel } from '@shared/game/core'
import type { ParamSchema } from '@shared/game/core/params'
import type { ClutchTrigger } from '@shared/game/defs/classes'
import { Button, Panel, RowAction } from '../../ui'
import { ParamTokens } from '../ParamTokens'
import { ConditionsListEditor } from './ConditionsParam'
import { registerParamEditor, type ParamEditorProps } from './registry'

const TRIGGER_HEADER_SCHEMA: ParamSchema = {
  signal: { label: 'Signal', kind: 'signal', default: 'OnHurt', description: 'Game signal that evaluates this clutch offer.' },
  chance: { label: 'Chance %', kind: 'number', default: 50, min: 1, max: 100, description: 'Percent chance to offer when conditions pass.' },
  oncePerCharacter: { label: 'Once', kind: 'flag', default: true, description: 'Only offer once per character.' },
  prompt: { label: 'Prompt', kind: 'text', default: '', description: 'Confirmation message shown to the user.' }
}

function ClutchTriggersEdit({ value, onChange }: ParamEditorProps) {
  const list = Array.isArray(value) ? (value as ClutchTrigger[]) : []
  const patch = (i: number, next: Record<string, unknown>) =>
    onChange(list.map((t, j) => (j === i ? (next as unknown as ClutchTrigger) : t)))

  return (
    <div className="flex flex-col gap-2.5">
      {list.map((trigger, i) => (
        <Panel
          key={i}
          collapsible
          defaultOpen
          title={signalLabel(trigger.signal || 'OnHurt')}
          meta={`${trigger.chance ?? 100}% chance`}
          actions={
            <RowAction
              danger
              icon={<X />}
              title="Remove trigger"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
            />
          }
          bodyClassName="flex flex-col gap-3 p-3"
        >
          <ParamTokens
            schema={TRIGGER_HEADER_SCHEMA}
            values={trigger as unknown as Record<string, unknown>}
            onChange={(next) => patch(i, next)}
          />
          <ConditionsListEditor
            value={trigger.when ?? []}
            onChange={(when) => patch(i, { ...trigger, when })}
          />
        </Panel>
      ))}
      <Button
        size="sm"
        variant="ghost"
        icon={<Plus />}
        className="self-start"
        onClick={() => onChange([...list, { signal: 'OnHurt', when: [{ type: 'healthPct', max: 30 }], chance: 50, oncePerCharacter: true, prompt: '' }])}
      >
        Add clutch trigger
      </Button>
    </div>
  )
}

registerParamEditor('clutchTriggers', { Editor: ClutchTriggersEdit, wide: true })
