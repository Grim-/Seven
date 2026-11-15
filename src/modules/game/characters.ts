import { CHARACTER_TEMPLATES, ITEM_TEMPLATES, catalogFrom, defType, misfitsOf } from '@shared/game/defs'
import { Health, Inventory, usableAbilities } from '@shared/game/components'
import type { Point } from '@shared/shapes'
import { GameEntity, spawn, type Catalog, type EntityRecord } from '@shared/game/core'
import { getSheet, registerSheetSection, setGame } from '../../engine/library/sheets'
import { ToolError } from '../../engine/tools/types'
import { gameDefs } from './store'
import { setEffectCatalog } from '../../engine/effects/catalog'
import { saveInPlay } from '../../engine/worlds/playLayer'
import { saves } from '../../engine/worlds/saves'

function catalog(): Catalog {
  return catalogFrom(gameDefs.catalog())
}

setEffectCatalog(catalog)

export function joinCharacter(sheet: string, template: string): EntityRecord {
  const s = getSheet(sheet)
  if (s.game) throw new ToolError(`${s.title} is already in the game.`)
  const cat = catalog()
  const made = cat.entity(CHARACTER_TEMPLATES, template)
  if (!made) throw new ToolError(`No character template "${template}".`)
  const entity = spawn({ ...made, name: s.title }, cat)
  const record = entity.toRecord()
  entity.stop()
  setGame(s.id, record)
  return record
}

export function saveCharacter(sheet: string, record: EntityRecord): EntityRecord {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  if (record.uid !== s.game.uid) throw new ToolError(`That game record belongs to another character.`)
  const clean = GameEntity.fromRecord(record, catalog()).toRecord()
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
    const entity = GameEntity.fromRecord(sheet.game, catalog())
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
      const entity = GameEntity.fromRecord(s.game, catalog())
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
  const cat = catalog()
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

export function changeHealth(sheet: string, delta: number): { from: number; to: number } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const entity = GameEntity.fromRecord(s.game, catalog())
  const health = entity.comp(Health)
  if (!health) throw new ToolError(`${s.title} has no health.`)
  const from = health.get()
  health.set(from + delta)
  setGame(s.id, entity.toRecord())
  return { from, to: health.get() }
}

export function changeCreatureHealth(world: string, uid: string, delta: number): { from: number; to: number } {
  const save = saveInPlay(world, true)
  const creature = save?.creatures.find((c) => c.uid === uid)
  if (!save || !creature) throw new ToolError('That creature is not in this save.')
  const entity = GameEntity.fromRecord(creature, catalog())
  const health = entity.comp(Health)
  if (!health) throw new ToolError(`${creature.name} has no health.`)
  const from = health.get()
  health.set(from + delta)
  const record = entity.toRecord()
  saves.write({ ...save, creatures: save.creatures.map((c) => (c.uid === uid ? { ...record, faction: c.faction } : c)) })
  return { from, to: health.get() }
}

export function takeItem(sheet: string, item: string, count: number): number {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const entity = GameEntity.fromRecord(s.game, catalog())
  const bag = entity.comp(Inventory)
  if (!bag) throw new ToolError(`${s.title} has no inventory.`)
  let left = Math.max(1, Math.floor(count))
  for (const stack of bag.items.filter((i) => i.id === item)) left -= bag.take(stack, left)
  setGame(s.id, entity.toRecord())
  return Math.max(1, Math.floor(count)) - left
}

export function characterMisfits(sheet: string): string[] {
  const s = getSheet(sheet)
  if (!s.game) return []
  const ids = new Map<string, Set<string>>()
  const has = (kind: string, id: string) => {
    if (!defType(kind)) return false
    if (!ids.has(kind)) ids.set(kind, new Set(gameDefs.list(kind).map((d) => d.id)))
    return ids.get(kind)?.has(id) ?? false
  }
  return misfitsOf(s.game, has).map((m) => `${defType(m.kind)?.label ?? m.kind} ${m.id}`)
}

export function useAbility(sheet: string, ability: string, target: string | null, at: Point | null, distance: number): string {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
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
