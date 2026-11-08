import { CHARACTER_TEMPLATES, ITEM_TEMPLATES, catalogFrom, defType, misfitsOf } from '@shared/game/defs'
import { Inventory, usableAbilities } from '@shared/game/components'
import type { Point } from '@shared/shapes'
import { GameEntity, spawn, type Catalog, type EntityRecord } from '@shared/game/core'
import type { CharacterSheet } from '@shared/types'
import { getSheet, registerSheetSection, setGame } from '../../engine/library/sheets'
import { ToolError } from '../../engine/tools/types'
import { gameDefs } from './store'

function catalogFor(ruleSet: string): Catalog {
  return catalogFrom(gameDefs.catalog(ruleSet))
}

function catalog(s: CharacterSheet): Catalog {
  return catalogFor(gameDefs.resolve(s.gameRules))
}

export function joinCharacter(sheet: string, ruleSet: string, template: string): EntityRecord {
  const s = getSheet(sheet)
  if (s.game) throw new ToolError(`${s.title} is already in the game.`)
  const rules = gameDefs.ruleSet(ruleSet).id
  const cat = catalogFor(rules)
  const made = cat.entity(CHARACTER_TEMPLATES, template)
  if (!made) throw new ToolError(`No character template "${template}" in the rule set ${gameDefs.ruleSet(rules).name}.`)
  const entity = spawn({ ...made, name: s.title }, cat)
  const record = entity.toRecord()
  entity.stop()
  setGame(s.id, record, rules)
  return record
}

export function saveCharacter(sheet: string, record: EntityRecord): EntityRecord {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  if (record.uid !== s.game.uid) throw new ToolError(`That game record belongs to another character.`)
  const clean = GameEntity.fromRecord(record, catalog(s)).toRecord()
  setGame(s.id, clean)
  return clean
}

export function leaveCharacter(sheet: string): boolean {
  setGame(getSheet(sheet).id, null)
  return true
}

registerSheetSection((sheet) => {
  if (!sheet.game) return null
  try {
    const entity = GameEntity.fromRecord(sheet.game, catalog(sheet))
    const lines = entity.comps.flatMap((comp) => {
      const rows = comp.tooltipRows()
      return rows.length ? [`- ${comp.type}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`] : []
    })
    return `## Game\n${lines.join('\n')}`
  } catch {
    return null
  }
})

export function tickCharacters(sheets: string[], seconds: number): number {
  let ticked = 0
  for (const id of sheets) {
    try {
      const s = getSheet(id)
      if (!s.game) continue
      const entity = GameEntity.fromRecord(s.game, catalog(s))
      entity.start()
      entity.tickSim(seconds)
      const record = entity.toRecord()
      entity.stop()
      setGame(s.id, record)
      ticked++
    } catch {
      continue
    }
  }
  return ticked
}

export function giveItem(sheet: string, item: string, count: number, gold: number): { given: number; gold: number } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog(s)
  const entity = GameEntity.fromRecord(s.game, cat)
  const bag = entity.comp(Inventory)
  if (!bag) throw new ToolError(`${s.title} has no inventory.`)
  const def = item ? cat.template(ITEM_TEMPLATES, item) : null
  if (item && !def) throw new ToolError(`No item "${item}".`)
  const given = def ? bag.give(def, Math.max(1, Math.floor(count))) : 0
  if (gold > 0) bag.changeGold(gold)
  setGame(s.id, entity.toRecord())
  return { given, gold: gold > 0 ? gold : 0 }
}

export function characterMisfits(sheet: string): string[] {
  const s = getSheet(sheet)
  if (!s.game) return []
  const rules = gameDefs.resolve(s.gameRules)
  const ids = new Map<string, Set<string>>()
  const has = (kind: string, id: string) => {
    if (!defType(kind)) return false
    if (!ids.has(kind)) ids.set(kind, new Set(gameDefs.list(rules, kind).map((d) => d.id)))
    return ids.get(kind)?.has(id) ?? false
  }
  return misfitsOf(s.game, has).map((m) => `${defType(m.kind)?.label ?? m.kind} ${m.id}`)
}

export function useAbility(sheet: string, ability: string, target: string | null, at: Point | null, distance: number): string {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog(s)
  const user = GameEntity.fromRecord(s.game, cat)
  const t = target && target !== s.id ? getSheet(target) : null
  if (t && !t.game) throw new ToolError(`${t.title} is not in the game.`)
  const other = t?.game ? GameEntity.fromRecord(t.game, cat) : null
  user.start()
  other?.start()
  try {
    const found = usableAbilities(user).find((a) => a.uid === ability)
    if (!found) throw new ToolError(`${s.title} can't use that now.`)
    const done = found.use({ user, target: target === s.id ? user : other, at, distance })
    if (done !== true) throw new ToolError(done)
    setGame(s.id, user.toRecord())
    if (t && other) setGame(t.id, other.toRecord())
    return `${s.title} used ${String(found.params.label || found.id)}${t ? ` on ${t.title}` : ''}.`
  } finally {
    user.stop()
    other?.stop()
  }
}
