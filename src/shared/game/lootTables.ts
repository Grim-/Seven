import { toId } from '../ids'

export type LootEntryType = 'item' | 'gold' | 'repo' | 'table' | 'nothing'

export interface LootTableEntry {
  id: string
  type: LootEntryType
  weight: number
  itemId?: string
  quantity?: string
  gold?: string
  repoId?: string
  tableId?: string
  label?: string
}

export interface GuaranteedDrop {
  gold?: string
  items?: { itemId: string; quantity: string }[]
}

export interface StoredLootTable {
  id: string
  name: string
  description?: string
  tags: string[]
  rolls: string
  unique?: boolean
  guaranteed?: GuaranteedDrop
  entries: LootTableEntry[]
  updatedAt: number
}

export interface RolledLootItem {
  itemId: string
  quantity: number
  label?: string
}

export interface RolledLootRepo {
  repoId: string
  text: string
}

export interface ResolvedLootDrop {
  gold: number
  items: RolledLootItem[]
  repoPulls: RolledLootRepo[]
  summary: string
  subTablesRolled: string[]
}

export function evaluateDice(formula: string | number | undefined, fallback = 1): number {
  if (typeof formula === 'number') return formula
  if (!formula || !String(formula).trim()) return fallback
  const str = String(formula).trim().toLowerCase().replace(/\s+/g, '')
  const match = str.match(/^(\d+)?d(\d+)(?:([+-])(\d+))?$/)
  if (match) {
    const count = match[1] ? parseInt(match[1], 10) : 1
    const sides = parseInt(match[2], 10)
    const sign = match[3] === '-' ? -1 : 1
    const mod = match[4] ? parseInt(match[4], 10) * sign : 0
    let total = mod
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1
    }
    return Math.max(0, total)
  }
  const n = parseInt(str, 10)
  return isNaN(n) ? fallback : n
}

export function cleanLootTableEntry(raw: unknown): LootTableEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const typeStr = String(v.type ?? '').toLowerCase()
  const type: LootEntryType =
    typeStr === 'item' || typeStr === 'gold' || typeStr === 'repo' || typeStr === 'table' || typeStr === 'nothing'
      ? typeStr
      : 'item'
  const weight = Math.max(1, typeof v.weight === 'number' ? v.weight : parseInt(String(v.weight), 10) || 10)

  return {
    id: String(v.id || crypto.randomUUID()),
    type,
    weight,
    itemId: v.itemId ? String(v.itemId).trim() : undefined,
    quantity: v.quantity ? String(v.quantity).trim() : '1',
    gold: v.gold ? String(v.gold).trim() : undefined,
    repoId: v.repoId ? String(v.repoId).trim() : undefined,
    tableId: v.tableId ? String(v.tableId).trim() : undefined,
    label: v.label ? String(v.label).trim() : undefined
  }
}

export function blankLootTable(): StoredLootTable {
  return {
    id: '',
    name: '',
    description: '',
    tags: [],
    rolls: '1',
    unique: false,
    entries: [
      {
        id: crypto.randomUUID(),
        type: 'item',
        weight: 30,
        itemId: '',
        quantity: '1'
      },
      {
        id: crypto.randomUUID(),
        type: 'gold',
        weight: 40,
        gold: '2d6'
      },
      {
        id: crypto.randomUUID(),
        type: 'nothing',
        weight: 30
      }
    ],
    updatedAt: Date.now()
  }
}

export function cleanLootTable(raw: unknown): StoredLootTable | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  const name = String(v.name ?? '').trim()
  if (!name) return null
  const rawId = typeof v.id === 'string' ? v.id.trim() : ''
  const id = (rawId ? toId(rawId) : '') || toId(name) || `table_${Date.now().toString(36)}`

  const entries = Array.isArray(v.entries)
    ? (v.entries.map(cleanLootTableEntry).filter((e): e is LootTableEntry => e !== null))
    : []

  const guaranteedRaw = v.guaranteed && typeof v.guaranteed === 'object' ? (v.guaranteed as Record<string, unknown>) : null
  const guaranteed: GuaranteedDrop | undefined = guaranteedRaw
    ? {
        gold: guaranteedRaw.gold ? String(guaranteedRaw.gold).trim() : undefined,
        items: Array.isArray(guaranteedRaw.items)
          ? guaranteedRaw.items
              .filter((it): it is Record<string, unknown> => Boolean(it && typeof it === 'object' && it.itemId))
              .map((it) => ({ itemId: String(it.itemId).trim(), quantity: String(it.quantity ?? '1').trim() }))
          : undefined
      }
    : undefined

  return {
    id,
    name,
    description: v.description ? String(v.description).trim() : undefined,
    tags: Array.isArray(v.tags) ? v.tags.map(String).map((t) => t.trim()).filter(Boolean) : [],
    rolls: v.rolls ? String(v.rolls).trim() : '1',
    unique: Boolean(v.unique),
    guaranteed,
    entries,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
  }
}

export function storedLootTableText(table: StoredLootTable): string {
  const lines: string[] = [
    `# ${table.name}`,
    table.description ? `${table.description}\n` : '',
    `**Rolls:** ${table.rolls} ${table.unique ? '(Unique drops)' : ''}`,
    table.tags.length ? `**Tags:** #${table.tags.join(' #')}` : '',
    '',
    '### Drop Pool:'
  ]

  const totalWeight = table.entries.reduce((sum, e) => sum + e.weight, 0) || 1
  for (const e of table.entries) {
    const pct = ((e.weight / totalWeight) * 100).toFixed(1)
    let desc = ''
    if (e.type === 'item') desc = `${e.quantity ?? '1'}× ${e.itemId}`
    else if (e.type === 'gold') desc = `${e.gold ?? '0'} Gold`
    else if (e.type === 'repo') desc = `Pull from repo: ${e.repoId}`
    else if (e.type === 'table') desc = `Cascade to table: ${e.tableId}`
    else desc = `Nothing`
    lines.push(`- [${pct}%] **${e.type.toUpperCase()}**: ${desc} (Weight: ${e.weight})`)
  }

  return lines.filter(Boolean).join('\n')
}
