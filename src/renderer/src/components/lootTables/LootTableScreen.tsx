import { blankLootTable, type StoredLootTable } from '@shared/game/lootTables'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { LootTableEditor } from './LootTableEditor'

export function LootTableScreen(props: KindScreenProps) {
  return (
    <StoredScreen<StoredLootTable>
      {...props}
      what="loot table"
      event="lootTables.changed"
      get={(id) => engine('lootTables.get', { id })}
      save={(table, previousId) => engine('lootTables.save', { table, previousId })}
      blank={blankLootTable}
      badge={(t) => `${t.entries.length} entries · ${t.rolls} roll(s)`}
      Editor={LootTableEditor}
    />
  )
}
