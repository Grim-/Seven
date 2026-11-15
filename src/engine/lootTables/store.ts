import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import {
  cleanLootTable,
  evaluateDice,
  type ResolvedLootDrop,
  type RolledLootItem,
  type RolledLootRepo,
  type StoredLootTable
} from '@shared/game/lootTables'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { ToolError } from '../tools/types'
import { rollRepo } from '../library/repos'

const FILE = path.join(dataRoot, 'lootTables.json')

export class LootTableStore extends EventEmitter {
  constructor(private readonly file: string = FILE) {
    super()
  }

  list(): StoredLootTable[] {
    const raw = readJson<unknown[]>(this.file, [])
    let needsRepair = false
    const list: StoredLootTable[] = []
    const seen = new Set<string>()

    for (const item of raw) {
      if (item && typeof item === 'object') {
        const entry = item as Record<string, unknown>
        if (!entry.id || typeof entry.id !== 'string' || !entry.id.trim()) {
          needsRepair = true
        }
      }
      const cleaned = cleanLootTable(item)
      if (cleaned) {
        let id = cleaned.id
        if (seen.has(id)) {
          needsRepair = true
          let counter = 2
          while (seen.has(`${id}_${counter}`)) counter++
          id = `${id}_${counter}`
        }
        seen.add(id)
        list.push({ ...cleaned, id })
      }
    }

    if (needsRepair) {
      this.write(list)
    }

    return list.sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): StoredLootTable {
    const hit = this.find(id)
    if (!hit) throw notFound(new ToolError(`No loot table "${id}".`))
    return hit
  }

  find(ref: string): StoredLootTable | null {
    if (!ref || typeof ref !== 'string') return null
    const stripped = ref.trim().replace(/^@?loot_table:/i, '').replace(/^"|"$/g, '')
    const id = toId(stripped)
    const all = this.list()
    return (
      all.find((t) => t.id === ref.trim()) ??
      all.find((t) => t.id === stripped) ??
      all.find((t) => t.id === id) ??
      all.find((t) => toId(t.name) === id) ??
      null
    )
  }

  save(raw: unknown, previousId: string | null = null): StoredLootTable {
    const table = cleanLootTable(raw)
    if (!table) throw new ToolError('Give the loot table a name.')
    const prev = previousId ? toId(previousId) : null
    this.write([...this.list().filter((x) => x.id !== table.id && (!prev || x.id !== prev)), table])
    return table
  }

  remove(id: string): void {
    const target = this.find(id)
    if (!target) throw notFound(new ToolError(`No loot table "${id}".`))
    const all = this.list()
    this.write(all.filter((t) => t.id !== target.id))
  }

  private write(list: StoredLootTable[]): void {
    writeJson(this.file, list)
    this.emit('changed')
  }

  roll(id: string, depth = 0): ResolvedLootDrop {
    if (depth > 5) {
      return { gold: 0, items: [], repoPulls: [], summary: 'Maximum loot recursion depth reached', subTablesRolled: [] }
    }

    const table = this.get(id)
    let totalGold = 0
    const items: RolledLootItem[] = []
    const repoPulls: RolledLootRepo[] = []
    const subTablesRolled: string[] = []

    // 1. Process Guaranteed Drops
    if (table.guaranteed?.gold) {
      totalGold += evaluateDice(table.guaranteed.gold, 0)
    }
    if (table.guaranteed?.items) {
      for (const gi of table.guaranteed.items) {
        const count = evaluateDice(gi.quantity, 1)
        if (count > 0) items.push({ itemId: gi.itemId, quantity: count })
      }
    }

    // 2. Process Random Weighted Rolls
    const rollCount = Math.max(1, evaluateDice(table.rolls, 1))
    let availableEntries = [...table.entries]

    for (let r = 0; r < rollCount; r++) {
      if (availableEntries.length === 0) break
      const totalWeight = availableEntries.reduce((sum, e) => sum + e.weight, 0)
      if (totalWeight <= 0) break

      const pick = Math.random() * totalWeight
      let acc = 0
      let chosen = availableEntries[0]

      for (const entry of availableEntries) {
        acc += entry.weight
        if (pick <= acc) {
          chosen = entry
          break
        }
      }

      if (table.unique) {
        availableEntries = availableEntries.filter((e) => e.id !== chosen.id)
      }

      // Execute chosen entry
      if (chosen.type === 'gold') {
        totalGold += evaluateDice(chosen.gold, 0)
      } else if (chosen.type === 'item') {
        if (chosen.itemId) {
          const qty = evaluateDice(chosen.quantity, 1)
          if (qty > 0) {
            const existing = items.find((i) => i.itemId === chosen.itemId)
            if (existing) {
              existing.quantity += qty
            } else {
              items.push({ itemId: chosen.itemId, quantity: qty, label: chosen.label })
            }
          }
        }
      } else if (chosen.type === 'repo') {
        if (chosen.repoId) {
          try {
            const text = rollRepo(chosen.repoId)
            repoPulls.push({ repoId: chosen.repoId, text })
          } catch (err) {
            noteFailure(err, 'game', 'Could not roll a repository in a loot table')
            // Ignore missing or empty repo
          }
        }
      } else if (chosen.type === 'table') {
        if (chosen.tableId && chosen.tableId !== id) {
          subTablesRolled.push(chosen.tableId)
          try {
            const subResult = this.roll(chosen.tableId, depth + 1)
            totalGold += subResult.gold
            for (const subItem of subResult.items) {
              const ex = items.find((i) => i.itemId === subItem.itemId)
              if (ex) ex.quantity += subItem.quantity
              else items.push(subItem)
            }
            repoPulls.push(...subResult.repoPulls)
            subTablesRolled.push(...subResult.subTablesRolled)
          } catch (err) {
            noteFailure(err, 'game', 'Could not roll a sub-table in a loot table')
            // Ignore missing sub-table
          }
        }
      }
      // 'nothing' type drops nothing
    }

    // Build human-friendly summary
    const parts: string[] = []
    if (totalGold > 0) parts.push(`${totalGold} Gold`)
    for (const it of items) parts.push(`${it.quantity > 1 ? `${it.quantity}× ` : ''}${it.itemId}`)
    for (const rp of repoPulls) parts.push(`"${rp.text}"`)

    const summary = parts.length > 0 ? `Awarded: ${parts.join(', ')}` : 'Nothing was found.'

    return {
      gold: totalGold,
      items,
      repoPulls,
      summary,
      subTablesRolled
    }
  }
}

export const lootTablesStore = new LootTableStore()
