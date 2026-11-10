import { registerTriggerActionHandler } from '../registry'
import { Field, Input, Textarea } from '../../../components/ui'

interface ScriptCallParams {
  scriptId?: string
  argsJson?: string
}

function ScriptCallEditor({ params, onChange }: { params: ScriptCallParams; onChange: (p: ScriptCallParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="SCRIPT ID / RUNNER ENTRY">
        <Input
          value={params.scriptId ?? ''}
          placeholder="e.g. scripts/dungeon_event.py or custom.command"
          onChange={(e) => onChange({ ...params, scriptId: e.target.value })}
        />
      </Field>

      <Field label="ARGUMENTS (JSON MAP)">
        <Textarea
          rows={3}
          value={params.argsJson ?? ''}
          placeholder='{"intensity": 2, "target": "altar"}'
          onChange={(e) => onChange({ ...params, argsJson: e.target.value })}
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<ScriptCallParams>({
  type: 'script_call',
  label: 'Execute Python/Engine Script',
  description: 'Calls a custom script or engine method with arbitrary parameters.',
  icon: 'terminal',
  Editor: ScriptCallEditor,
  execute: async (params, ctx) => {
    const scriptId = String(params.scriptId ?? '').trim()
    if (!scriptId) return

    let parsedArgs: Record<string, unknown> = {}
    if (params.argsJson?.trim()) {
      try {
        parsedArgs = JSON.parse(params.argsJson)
      } catch {
        ctx.notify('Failed to parse script arguments JSON', 'warn')
      }
    }

    await ctx.engine('scripts.run', {
      script: scriptId,
      args: {
        world: ctx.world,
        map: ctx.map,
        sheet: ctx.sheet,
        ...parsedArgs
      }
    })
  }
})
