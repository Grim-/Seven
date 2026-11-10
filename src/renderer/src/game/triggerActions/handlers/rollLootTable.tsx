import { registerTriggerActionHandler } from '../registry'
import { Field, Select, Input } from '../../../components/ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import type { ResolvedLootDrop, StoredLootTable } from '@shared/game/lootTables'

interface RollLootParams {
  tableId?: string
  customMessage?: string
}

function RollLootEditor({ params, onChange }: { params: RollLootParams; onChange: (p: RollLootParams) => void }) {
  const tables: StoredLootTable[] = useLive(() => engine('lootTables.list'), 'lootTables.changed') ?? []

  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="LOOT TABLE TO ROLL">
        <Select
          value={params.tableId ?? ''}
          options={[
            { value: '', label: 'Select loot table...' },
            ...tables.map((t) => ({ value: t.id, label: `${t.name} (${t.entries.length} drops)` }))
          ]}
          onChange={(tableId) => onChange({ ...params, tableId })}
          className="h-8 text-[11.5px]"
        />
      </Field>
      <Field label="CUSTOM REWARD NOTICE (OPTIONAL)">
        <Input
          value={params.customMessage ?? ''}
          placeholder="Leave blank to use default summary"
          onChange={(e) => onChange({ ...params, customMessage: e.target.value })}
          className="h-8 text-[11px]"
        />
      </Field>
    </div>
  )
}

registerTriggerActionHandler<RollLootParams>({
  type: 'roll_loot_table',
  label: 'Roll Loot Table',
  description: 'Rolls on a weighted loot table and deposits items & gold directly into the party inventory.',
  icon: 'gem',
  Editor: RollLootEditor,
  execute: async (params, ctx) => {
    const tableId = String(params.tableId ?? '').trim()
    if (!tableId) return

    const drop = await ctx.engine<ResolvedLootDrop>('lootTables.roll', { id: tableId })
    if (!drop) return

    // Deposit gold
    if (drop.gold > 0) {
      await ctx.giveItem('', 0, drop.gold)
    }

    // Deposit items
    for (const item of drop.items) {
      if (item.itemId) {
        await ctx.giveItem(item.itemId, item.quantity, 0)
      }
    }

    const message = params.customMessage?.trim() || drop.summary
    ctx.notify(message, 'accent')
  }
})
