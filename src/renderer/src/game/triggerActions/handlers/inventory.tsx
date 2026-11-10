import { registerTriggerActionHandler } from '../registry'
import { Field, FieldGrid, Input } from '../../../components/ui'
import { ItemSelect } from '../../../components/game/ItemSelect'

interface InventoryParams {
  itemId?: string
  count?: number
  gold?: number
}

function GiveItemEditor({ params, onChange }: { params: InventoryParams; onChange: (p: InventoryParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="INVENTORY ITEM">
        <ItemSelect
          value={params.itemId ?? ''}
          onChange={(itemId) => onChange({ ...params, itemId: itemId ?? '' })}
          placeholder="None (currency only)"
        />
      </Field>
      <FieldGrid dense>
        <Field label="ITEM QUANTITY">
          <Input
            type="number"
            min={1}
            value={params.count ?? 1}
            onChange={(e) => onChange({ ...params, count: Math.max(1, Number(e.target.value)) })}
          />
        </Field>
        <Field label="GOLD / CURRENCY">
          <Input
            type="number"
            min={0}
            value={params.gold ?? 0}
            onChange={(e) => onChange({ ...params, gold: Math.max(0, Number(e.target.value)) })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

function RemoveItemEditor({ params, onChange }: { params: InventoryParams; onChange: (p: InventoryParams) => void }) {
  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="ITEM TO REMOVE / CONSUME">
        <ItemSelect
          value={params.itemId ?? ''}
          onChange={(itemId) => onChange({ ...params, itemId: itemId ?? '' })}
          placeholder="Select item..."
        />
      </Field>
      <Field label="QUANTITY TO REMOVE">
        <Input
          type="number"
          min={1}
          value={params.count ?? 1}
          onChange={(e) => onChange({ ...params, count: Math.max(1, Number(e.target.value)) })}
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<InventoryParams>({
  type: 'give_item',
  label: 'Give Item / Gold',
  description: 'Awards items and/or gold to the party inventory.',
  icon: 'package-plus',
  Editor: GiveItemEditor,
  execute: async (params, ctx) => {
    const item = String(params.itemId ?? '').trim()
    const count = Number(params.count) || 1
    const gold = Number(params.gold) || 0
    await ctx.giveItem(item, count, gold)
  }
})

registerTriggerActionHandler<InventoryParams>({
  type: 'remove_item',
  label: 'Remove / Consume Item',
  description: 'Removes or consumes items from party inventory.',
  icon: 'package-minus',
  Editor: RemoveItemEditor,
  execute: async (params, ctx) => {
    const item = String(params.itemId ?? '').trim()
    if (!item) return
    const count = Number(params.count) || 1
    await ctx.removeItem(item, count)
  }
})
