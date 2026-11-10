import { registerTriggerActionHandler } from '../registry'
import { Field, Input, Segmented } from '../../../components/ui'
import type { PropCollision } from '@shared/maps'

interface AlterMapObjectParams {
  objectId?: string
  image?: string
  collision?: PropCollision
}

function AlterMapObjectEditor({ params, onChange }: { params: AlterMapObjectParams; onChange: (p: AlterMapObjectParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="TARGET MAP OBJECT (ID OR NAME)">
        <Input
          value={params.objectId ?? ''}
          placeholder="Object name or layer ID (e.g. wooden_chest, bridge_gate)"
          onChange={(e) => onChange({ ...params, objectId: e.target.value })}
          className="h-8 text-[11.5px]"
        />
      </Field>

      <Field label="SPRITE / ASSET OVERRIDE (OPTIONAL)">
        <Input
          value={params.image ?? ''}
          placeholder="Leave blank to keep current sprite"
          onChange={(e) => onChange({ ...params, image: e.target.value })}
          className="h-8 text-[11.5px]"
        />
      </Field>

      <Field label="COLLISION OVERRIDE">
        <Segmented
          value={params.collision ?? 'passable'}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'passable', label: 'Passable' },
            { value: 'water', label: 'Water' }
          ]}
          onChange={(c) => onChange({ ...params, collision: c as PropCollision })}
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<AlterMapObjectParams>({
  type: 'alter_map_object',
  label: 'Alter Map Object (Imperative Fallback)',
  description: 'Imperatively mutates a map object sprite, collision, or visibility on the current map.',
  icon: 'layers',
  Editor: AlterMapObjectEditor,
  execute: async (params, ctx) => {
    const target = params.objectId?.trim()
    if (!target) return

    window.dispatchEvent(
      new CustomEvent('seven:alter_map_object', {
        detail: {
          target,
          image: params.image?.trim() || undefined,
          collision: params.collision
        }
      })
    )
    ctx.notify(`Altered object "${target}"`, 'cyan')
  }
})
