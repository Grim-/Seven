import { useState, useMemo } from 'react'
import {
  Coins,
  Dices,
  Gem,
  Package,
  Plus,
  Sparkles,
  Trash2
} from 'lucide-react'
import type {
  LootEntryType,
  LootTableEntry,
  ResolvedLootDrop,
  StoredLootTable
} from '@shared/game/lootTables'
import { Button, Field, FieldGrid, Input, Select, TagInput, Toggle } from '../ui'
import { ItemSelect } from '../game/ItemSelect'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'

interface Props {
  value: StoredLootTable
  onChange: (table: StoredLootTable) => void
}

const TYPE_OPTIONS: { value: LootEntryType; label: string }[] = [
  { value: 'item', label: 'Item (RuleSet Template)' },
  { value: 'gold', label: 'Currency / Gold' },
  { value: 'repo', label: 'Pull from Repo (Text Pool)' },
  { value: 'table', label: 'Nested Table (Cascade Roll)' },
  { value: 'nothing', label: 'Nothing (Empty Drop)' }
]

export function LootTableEditor({ value, onChange }: Props) {
  // Query repos and other loot tables for dropdown selections
  const repos = useLive(() => engine('repos.list'), 'page.changed') ?? []
  const allTables = useLive(() => engine('lootTables.list'), 'lootTables.changed') ?? []
  const otherTables = allTables.filter((t) => t.id !== value.id)

  const [testResult, setTestResult] = useState<ResolvedLootDrop | null>(null)
  const [testing, setTesting] = useState(false)

  const totalWeight = useMemo(() => {
    return value.entries.reduce((sum, e) => sum + (Number(e.weight) || 0), 0)
  }, [value.entries])

  const handleAddEntry = (type: LootEntryType = 'item') => {
    const newEntry: LootTableEntry = {
      id: crypto.randomUUID(),
      type,
      weight: 10,
      itemId: '',
      quantity: '1',
      gold: type === 'gold' ? '1d6' : undefined
    }
    onChange({ ...value, entries: [...value.entries, newEntry] })
  }

  const handleUpdateEntry = (id: string, patch: Partial<LootTableEntry>) => {
    onChange({
      ...value,
      entries: value.entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
    })
  }

  const handleDeleteEntry = (id: string) => {
    onChange({
      ...value,
      entries: value.entries.filter((e) => e.id !== id)
    })
  }

  const handleTestRoll = async () => {
    if (!value.id) {
      toast.info('Save first', 'Save the loot table before test rolling.')
      return
    }
    setTesting(true)
    try {
      const drop = await engine('lootTables.roll', { id: value.id })
      setTestResult(drop)
      toast.info('Loot Roll Result', drop.summary)
    } catch (err) {
      toast.error('Roll failed', String(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 font-ui text-[12px] select-none p-4 max-w-4xl">
      {/* 1. TABLE IDENTIFICATION & ROLLS */}
      <div className="flex flex-col gap-3 border border-line/60 tone-panel-60 p-3.5">
        <Field label="LOOT TABLE NAME">
          <Input
            value={value.name}
            placeholder="e.g. Dungeon Chest Tier 1, Forest Forage Table, Blacksmith Stock"
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="h-8 font-bold text-ink text-[13px]"
          />
        </Field>

        <FieldGrid dense>
          <Field label="ROLLS FORMULA (COUNT)">
            <Input
              value={value.rolls}
              placeholder="e.g. 1, 2, 1d3, 2d4"
              onChange={(e) => onChange({ ...value, rolls: e.target.value })}
              className="h-8 text-[12px]"
            />
          </Field>
          <Field label="DRAW UNIQUELY (NO DUPLICATES)">
            <div className="flex items-center h-8">
              <Toggle
                checked={Boolean(value.unique)}
                onChange={(unique) => onChange({ ...value, unique })}
                label={value.unique ? 'Draw without replacement' : 'With replacement'}
              />
            </div>
          </Field>
        </FieldGrid>

        <Field label="DESCRIPTION (OPTIONAL NOTES)">
          <Input
            value={value.description ?? ''}
            placeholder="Where or when this loot table is rolled..."
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            className="h-8 text-[11px]"
          />
        </Field>

        <Field label="TAGS">
          <TagInput value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />
        </Field>
      </div>

      {/* 2. DROP POOL HEADER & TEST TOOL */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-3">
          <span className="font-bold caps-5 text-ink text-[13px] flex items-center gap-2">
            <Gem className="h-4 w-4 text-tint-cyan" /> Drop Pool ({value.entries.length} Entries)
          </span>
          <span className="tone-well-50 border border-line px-2 py-0.5 text-[10px] text-faint">
            Total Weight: <strong className="text-tint-cyan">{totalWeight}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Dices className="h-3.5 w-3.5 text-accent" />}
            onClick={handleTestRoll}
            disabled={testing || value.entries.length === 0}
            title="Simulate rolling on this loot table"
          >
            {testing ? 'Rolling...' : 'Test Roll'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => handleAddEntry('item')}
          >
            Add Drop
          </Button>
        </div>
      </div>

      {/* TEST ROLL PREVIEW BANNER */}
      {testResult && (
        <div className="border border-accent/40 bg-accent/10 p-3 flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center justify-between text-accent font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Test Roll Output:
            </span>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-[10px] text-dim hover:text-ink"
            >
              Dismiss
            </button>
          </div>
          <p className="text-ink font-medium">{testResult.summary}</p>
          {testResult.subTablesRolled.length > 0 && (
            <span className="text-[10px] text-dim">
              Cascaded through sub-tables: {testResult.subTablesRolled.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* 3. DROP POOL ENTRIES */}
      {value.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-line/60 tone-panel-40 p-8 text-center text-dim text-[11px] gap-2">
          <span>This loot table has no drops configured yet.</span>
          <span className="text-[10px] text-faint">
            Add items, currency amounts, repo pulls, or nested tables with weighted chances.
          </span>
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => handleAddEntry('item')}
            className="mt-2"
          >
            Add First Drop
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {value.entries.map((entry, idx) => {
            const entryWeight = Number(entry.weight) || 0
            const pct = totalWeight > 0 ? ((entryWeight / totalWeight) * 100).toFixed(1) : '0.0'

            return (
              <div
                key={entry.id}
                className="border border-line/70 tone-well-70 p-3 flex flex-col gap-2.5 transition-colors hover:border-line"
              >
                {/* ROW 1: WEIGHT, PROBABILITY %, TYPE, DELETE */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-faint caps font-bold shrink-0">
                    #{idx + 1}
                  </span>

                  {/* WEIGHT INPUT */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-dim caps">Weight:</span>
                    <Input
                      type="number"
                      min={1}
                      value={entry.weight}
                      onChange={(e) =>
                        handleUpdateEntry(entry.id, { weight: Math.max(1, Number(e.target.value)) })
                      }
                      className="h-7 w-16 text-center text-[11.5px] font-bold text-tint-cyan"
                    />
                  </div>

                  {/* CALCULATED PERCENTAGE PILL */}
                  <div
                    className="flex items-center gap-1 px-2 py-1 bg-tint-cyan/10 border border-tint-cyan/30 text-[11px] font-bold text-tint-cyan shrink-0"
                    title={`Relative chance based on weight ${entry.weight} / total ${totalWeight}`}
                  >
                    <span>{pct}%</span>
                  </div>

                  {/* TYPE SELECTOR */}
                  <div className="flex-1 min-w-[200px]">
                    <Select
                      value={entry.type}
                      options={TYPE_OPTIONS}
                      onChange={(t) => handleUpdateEntry(entry.id, { type: t as LootEntryType })}
                      className="h-7 text-[11px]"
                    />
                  </div>

                  {/* DELETE BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1 text-alert/70 hover:text-alert transition-colors shrink-0"
                    title="Remove drop entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* ROW 2: TYPE-SPECIFIC PAYLOAD */}
                <div className="border-t border-line/30 pt-2">
                  {/* TYPE: ITEM */}
                  {entry.type === 'item' && (
                    <div className="grid grid-cols-[1fr_120px] gap-2 items-center">
                      <Field label="INVENTORY ITEM TEMPLATE">
                        <ItemSelect
                          value={entry.itemId ?? ''}
                          onChange={(itemId) =>
                            handleUpdateEntry(entry.id, { itemId: itemId ?? '' })
                          }
                          placeholder="Select item template..."
                        />
                      </Field>
                      <Field label="QUANTITY (OR DICE)">
                        <Input
                          value={entry.quantity ?? '1'}
                          placeholder="e.g. 1, 2, 1d4"
                          onChange={(e) => handleUpdateEntry(entry.id, { quantity: e.target.value })}
                          className="h-8 text-[11.5px]"
                        />
                      </Field>
                    </div>
                  )}

                  {/* TYPE: GOLD */}
                  {entry.type === 'gold' && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <Field label="GOLD / CURRENCY AMOUNT (OR DICE FORMULA)">
                        <div className="relative">
                          <Coins className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-accent" />
                          <Input
                            value={entry.gold ?? '10'}
                            placeholder="e.g. 25, 2d6, 3d10+15"
                            onChange={(e) => handleUpdateEntry(entry.id, { gold: e.target.value })}
                            className="h-8 pl-8 text-[12px] font-bold text-accent"
                          />
                        </div>
                      </Field>
                      <span className="text-[10px] text-dim pt-3">
                        Fixed amount (e.g. 50) or dice notation (e.g. 2d6, 1d20+10).
                      </span>
                    </div>
                  )}

                  {/* TYPE: REPO */}
                  {entry.type === 'repo' && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <Field label="PULL FROM REPO">
                        <Select
                          value={entry.repoId ?? ''}
                          options={[
                            { value: '', label: 'Select a repo...' },
                            ...repos.map((r) => ({ value: r.id, label: `${r.title} (${r.id})` }))
                          ]}
                          onChange={(repoId) => handleUpdateEntry(entry.id, { repoId })}
                          className="h-8 text-[11.5px]"
                        />
                      </Field>
                      <span className="text-[10px] text-dim pt-3">
                        Pulls a random text entry from the chosen repo (e.g. gems, trinkets, scrolls).
                      </span>
                    </div>
                  )}

                  {/* TYPE: NESTED TABLE */}
                  {entry.type === 'table' && (
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <Field label="CASCADE TO SUB-TABLE">
                        <Select
                          value={entry.tableId ?? ''}
                          options={[
                            { value: '', label: 'Select higher-tier or sub-table...' },
                            ...otherTables.map((t) => ({ value: t.id, label: `${t.name} (${t.id})` }))
                          ]}
                          onChange={(tableId) => handleUpdateEntry(entry.id, { tableId })}
                          className="h-8 text-[11.5px]"
                        />
                      </Field>
                      <span className="text-[10px] text-dim pt-3">
                        Cascades into another loot table, inheriting its weighted rolls and drops.
                      </span>
                    </div>
                  )}

                  {/* TYPE: NOTHING */}
                  {entry.type === 'nothing' && (
                    <div className="flex items-center gap-2 text-dim text-[11px] py-1">
                      <Package className="h-3.5 w-3.5 text-faint" />
                      <span>Empty drop / fizzle. Contributes to overall probability weighting without awarding loot.</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
