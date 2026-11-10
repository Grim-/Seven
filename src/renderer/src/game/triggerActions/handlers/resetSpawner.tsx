import { registerTriggerActionHandler } from '../registry'
import { Field, Input } from '../../../components/ui'

interface ResetSpawnerParams {
  spawnerId?: string
  resetMessage?: string
}

function ResetSpawnerEditor({ params, onChange }: { params: ResetSpawnerParams; onChange: (p: ResetSpawnerParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="SPAWNER ID TO RESET (OR '__all__')">
        <Input
          value={params.spawnerId ?? ''}
          placeholder="e.g. goblin_sentry_1, or __all__ for all map spawners"
          onChange={(e) => onChange({ ...params, spawnerId: e.target.value })}
          className="h-8 text-[11.5px]"
        />
        <span className="text-[10px] text-dim mt-1">
          Clears the eliminated/spawned status for this spawner in the world save, allowing it to trigger and spawn anew.
        </span>
      </Field>

      <Field label="NOTIFICATION MESSAGE (OPTIONAL)">
        <Input
          value={params.resetMessage ?? ''}
          placeholder="e.g. The dungeon creatures have regrouped."
          onChange={(e) => onChange({ ...params, resetMessage: e.target.value })}
          className="h-8 text-[11px]"
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<ResetSpawnerParams>({
  type: 'reset_spawner',
  label: 'Reset Creature Spawner',
  description: 'Resets a creature spawner (or all spawners on the map) so it can trigger and materialize again.',
  icon: 'refresh-cw',
  Editor: ResetSpawnerEditor,
  execute: async (params, ctx) => {
    const spawnerId = params.spawnerId?.trim() || '__all__'

    window.dispatchEvent(
      new CustomEvent('seven:reset_spawner', {
        detail: {
          map: ctx.map,
          spawnerId
        }
      })
    )

    const msg = params.resetMessage?.trim() || `Spawner "${spawnerId}" has been reset.`
    ctx.notify(msg, 'cyan')
  }
})
