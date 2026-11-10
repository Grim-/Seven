import { registerTriggerActionHandler } from '../registry'
import { Field, Select, Input, Segmented } from '../../../components/ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import type { StoredLootTable, ResolvedLootDrop } from '@shared/game/lootTables'

interface OpenShopParams {
  shopTitle?: string
  stockMode?: 'loot_table' | 'fixed'
  lootTableId?: string
  fixedItems?: string
}

function OpenShopEditor({ params, onChange }: { params: OpenShopParams; onChange: (p: OpenShopParams) => void }) {
  const tables: StoredLootTable[] = useLive(() => engine('lootTables.list'), 'lootTables.changed') ?? []
  const mode = params.stockMode ?? 'loot_table'

  return (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <Field label="SHOP / MERCHANT TITLE">
        <Input
          value={params.shopTitle ?? ''}
          placeholder="e.g. Blacksmith Counter, Alchemist Stall"
          onChange={(e) => onChange({ ...params, shopTitle: e.target.value })}
          className="h-8 text-[11.5px]"
        />
      </Field>

      <Field label="INVENTORY SOURCING">
        <Segmented
          value={mode}
          options={[
            { value: 'loot_table', label: 'Dynamic Loot Table', hint: 'Generate stock procedurally with weighted rarity' },
            { value: 'fixed', label: 'Fixed Item List', hint: 'Comma-separated item IDs' }
          ]}
          onChange={(m) => onChange({ ...params, stockMode: m as any })}
        />
      </Field>

      {mode === 'loot_table' ? (
        <Field label="MERCHANT STOCK LOOT TABLE">
          <Select
            value={params.lootTableId ?? ''}
            options={[
              { value: '', label: 'Select stock loot table...' },
              ...tables.map((t) => ({ value: t.id, label: `${t.name} (${t.entries.length} items/drops)` }))
            ]}
            onChange={(lootTableId) => onChange({ ...params, lootTableId })}
            className="h-8 text-[11.5px]"
          />
        </Field>
      ) : (
        <Field label="FIXED ITEM TEMPLATE IDS (COMMA-SEPARATED)">
          <Input
            value={params.fixedItems ?? ''}
            placeholder="e.g. iron_sword, health_potion, torch"
            onChange={(e) => onChange({ ...params, fixedItems: e.target.value })}
            className="h-8 text-[11.5px]"
          />
        </Field>
      )}
    </div>
  )
}

registerTriggerActionHandler<OpenShopParams>({
  type: 'open_shop',
  label: 'Open Shop Counter',
  description: 'Opens a merchant counter interface stocked either dynamically from a loot table or with fixed items.',
  icon: 'store',
  Editor: OpenShopEditor,
  execute: async (params, ctx) => {
    let stockIds: string[] = []

    if (params.stockMode === 'fixed') {
      stockIds = (params.fixedItems ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else if (params.lootTableId) {
      try {
        const drop = await ctx.engine<ResolvedLootDrop>('lootTables.roll', { id: params.lootTableId })
        if (drop && drop.items.length > 0) {
          stockIds = drop.items.map((i) => i.itemId)
        }
      } catch {
        // Fallback to empty stock if table failed
      }
    }

    const title = params.shopTitle?.trim() || 'Merchant Counter'
    window.dispatchEvent(new CustomEvent('seven:open_shop', { detail: { title, stock: stockIds } }))
    ctx.notify(`Browsing ${title}`, 'cyan')
  }
})
