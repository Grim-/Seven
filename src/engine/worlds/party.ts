import { noteFailure } from '../util/report'
import { mapArea, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import type { GameSave, SaveCreateOptions, SaveLoadoutOverride } from '@shared/game/save'
import { GameEntity, createComponent } from '@shared/game/core'
import { Abilities, Ability, Buffs, Classes, Health, Inventory, ensureCharacterDefaults } from '@shared/game/components'
import { ABILITY_TEMPLATES, BUFF_TEMPLATES, ITEM_TEMPLATES, catalogFrom } from '@shared/game/defs'
import { renderSentenceTemplate } from '@shared/game/effectWords'
import { shapeBounds } from '@shared/shapes'
import { maps } from '../maps/store'
import { getSheet, setSheetSave, sheetIds, storedGame } from '../library/sheets'
import { almanacs } from '../almanac/store'
import { gameDefs } from '../../modules/game/store'
import { triggerActionsStore } from '../triggerActions/store'
import { triggerActionEffects } from '@shared/game/triggerActions'
import { saves } from './saves'
import { WorldError, worlds } from './store'
import { wakeMapSpawners } from './spawners'
import { assertOutOfCombat } from './battleGate'

function without(save: GameSave, sheet: string): GameSave {
  const { [sheet]: _gone, ...characters } = save.characters
  const stand = Object.fromEntries(Object.entries(save.stand).map(([map, list]) => [map, Object.fromEntries(Object.entries(list).filter(([s]) => s !== sheet))]))
  return { ...save, characters, stand }
}

export function takeOut(sheet: string): GameSave | null {
  const s = getSheet(sheet)
  const save = s.save ? saves.read(s.save) : null
  if (!save) {
    if (s.save) setSheetSave(s.id, '')
    return null
  }
  const held = save.characters[s.id]
  const next = saves.write(without(save, s.id))
  setSheetSave(s.id, '', { game: held?.game ?? null, gameRules: worlds.exists(save.world) ? worlds.meta(save.world).rules : '' })
  return next
}

export function bring(id: string, sheet: string, where = ''): GameSave {
  const save = saves.get(id)
  const s = getSheet(sheet)
  if (s.save === id) return save
  if (s.save) takeOut(s.id)
  const carried = storedGame(s.id)
  const next = saves.change(id, (v) => ({ ...v, characters: { ...v.characters, [s.id]: { game: carried.game, where } } }))
  setSheetSave(s.id, id)
  return next
}

export function removeSave(id: string): boolean {
  const save = saves.read(id)
  if (!save) return false
  for (const sheet of Object.keys(save.characters)) takeOut(sheet)
  const removed = saves.remove(id)
  if (removed && save.almanacId) {
    try {
      almanacs.remove(save.almanacId)
    } catch (err) {
      noteFailure(err, 'almanac', 'Could not remove save almanac')
    }
  }
  return removed
}

export function removeWorldSaves(world: string): number {
  const list = saves.list(world)
  for (const s of list) removeSave(s.id)
  return list.length
}

function loadOrInitCharacterEntity(
  sheetId: string,
  heldGame: GameSave['characters'][string]['game'],
  catalog: ReturnType<typeof catalogFrom>,
  ensureAlive = false
): GameEntity {
  const baseRecord = heldGame ?? new GameEntity(sheetId, { kind: 'character', id: sheetId }, sheetId, catalog).toRecord()
  const entity = GameEntity.fromRecord(baseRecord, catalog)
  ensureCharacterDefaults(entity)
  if (ensureAlive) {
    const hp = entity.comp(Health)
    if (hp && (hp.isDead || hp.get() <= 0)) hp.revive(1)
  }
  return entity
}

function applyLoadoutOverride(saveId: string, sheetId: string, override: SaveLoadoutOverride): void {
  const save = saves.read(saveId)
  const held = save?.characters[sheetId]
  if (!save || !held) return
  const catalog = catalogFrom(gameDefs.catalog())
  const entity = loadOrInitCharacterEntity(sheetId, held.game, catalog)

  if (override.classId) {
    let classes = entity.comp(Classes)
    if (!classes) {
      classes = createComponent({ type: 'classes' }) as Classes
      entity.add(classes)
    }
    classes.grantClass(override.classId, { bypassConditions: true, reason: 'quick_start' })
  }

  if (override.abilities?.length) {
    let abilities = entity.comp(Abilities)
    if (!abilities) {
      abilities = createComponent({ type: 'abilities' }) as Abilities
      entity.add(abilities)
    }
    for (const abilityId of override.abilities) {
      if (abilities.find(abilityId)) continue
      const tpl = catalog.template(ABILITY_TEMPLATES, abilityId)
      const def = tpl ? { ...(tpl as Record<string, unknown>), type: 'ability', id: abilityId } : { type: 'ability', id: abilityId }
      const made = createComponent(def as Parameters<typeof createComponent>[0])
      if (made instanceof Ability) abilities.add(made)
    }
  }

  if (override.items?.length) {
    let inventory = entity.comp(Inventory)
    if (!inventory) {
      inventory = createComponent({ type: 'inventory' }) as Inventory
      entity.add(inventory)
    }
    for (const itemId of override.items) {
      const tpl = catalog.template(ITEM_TEMPLATES, itemId)
      const def = tpl ? { ...(tpl as Record<string, unknown>), type: 'item', id: itemId } : { type: 'item', id: itemId }
      inventory.give(def as Parameters<typeof inventory.give>[0], 1)
    }
  }

  if (override.buffs?.length) {
    let buffs = entity.comp(Buffs)
    if (!buffs) {
      buffs = createComponent({ type: 'buffs' }) as Buffs
      entity.add(buffs)
    }
    for (const buffId of override.buffs) {
      const tpl = catalog.template(BUFF_TEMPLATES, buffId)
      const def = tpl ? { ...(tpl as Record<string, unknown>), type: 'buff', id: buffId } : { type: 'buff', id: buffId }
      buffs.apply(def as Parameters<typeof buffs.apply>[0], entity, `start:${buffId}`)
    }
  }

  saves.change(saveId, (s) => ({
    ...s,
    characters: { ...s.characters, [sheetId]: { ...s.characters[sheetId], game: entity.toRecord() } }
  }))
}

export function createNewWorldSave(world: string, name: string, options?: SaveCreateOptions): GameSave {
  const save = saves.create(world, name, false)
  if (!worlds.exists(world)) return save

  const resolveSheetId = (ref: string | null | undefined): string | null => {
    if (!ref) return null
    try {
      return getSheet(ref).id
    } catch {
      return null
    }
  }

  const w = worlds.meta(world)
  const launch = w.launch
  const player = resolveSheetId(options?.player !== undefined ? options.player : w.player)
  const companions = (options?.companions ?? []).map(resolveSheetId).filter((c): c is string => Boolean(c) && c !== player)
  const startingPlace = options?.startingPlace !== undefined ? options.startingPlace : (launch?.startingPlace ?? null)
  const startingTime = options?.startingTime ?? launch?.startingTime ?? 8 * 3600
  const whereStr = startingPlace ? `@place:${startingPlace}` : ''

  const rawStood = worlds.oldStand(world)
  const stood: typeof rawStood = {}
  for (const [mapId, standMap] of Object.entries(rawStood)) {
    const valid = Object.fromEntries(Object.entries(standMap).filter(([k]) => resolveSheetId(k) !== null))
    if (Object.keys(valid).length) stood[mapId] = valid
  }
  const uses = worlds.mapUses(world)
  const startingMap =
    options?.startingMap !== undefined
      ? options.startingMap
      : (launch?.startingMap ?? (startingPlace ? uses.find((u) => Boolean(u.shapes[startingPlace]))?.map : null) ?? Object.keys(stood)[0] ?? uses[0]?.map ?? null)

  const standingSheets = new Set<string>()
  for (const standMap of Object.values(stood)) {
    for (const sheetId of Object.keys(standMap)) {
      standingSheets.add(sheetId)
    }
  }
  const worldPlaces = worlds.entities(world, PLACE_TYPE_KEY, false, 'template')
  const npcHomeWhere = new Map<string, string>()
  for (const { id } of sheetIds()) {
    try {
      const s = getSheet(id)
      if (!s.save && s.story.where && placesIn(s.story.where, world, worldPlaces).length) {
        standingSheets.add(id)
        npcHomeWhere.set(id, s.story.where)
      }
    } catch {
      // Ignore unreadable sheet
    }
  }
  if (player) standingSheets.add(player)
  for (const c of companions) standingSheets.add(c)

  // Compute spawn point: center of startingPlace shape on startingMap if drawn, else map center
  const spawnPointFor = (mapId: string, placeKey: string | null, indexOffset: number): { x: number; y: number } => {
    const use = uses.find((u) => u.map === mapId)
    const shape = placeKey && use ? use.shapes[placeKey] : undefined
    if (shape) {
      const b = shapeBounds(shape)
      return { x: Math.round(b.x + b.w / 2) + indexOffset * 28, y: Math.round(b.y + b.h / 2) }
    }
    const m = maps.get(mapId)
    const area = m ? mapArea(m) : { w: 800, h: 600 }
    return { x: Math.round(area.w / 2) + indexOffset * 28, y: Math.round(area.h / 2) }
  }

  const partyList = [player, ...companions].filter((id): id is string => Boolean(id))
  if (startingMap && partyList.length) {
    partyList.forEach((sheetId, idx) => {
      const alreadyPlaced = Object.values(stood).some((m) => Boolean(m[sheetId]))
      if (!alreadyPlaced || startingPlace) {
        stood[startingMap] = {
          ...(stood[startingMap] ?? {}),
          [sheetId]: { at: spawnPointFor(startingMap, startingPlace, idx), actions: '', decisions: '' }
        }
      }
    })
  }

  // Also place NPCs whose story.where matches a shaped place onto that map
  for (const [npcId, npcWhere] of npcHomeWhere.entries()) {
    if (partyList.includes(npcId)) continue
    const alreadyPlaced = Object.values(stood).some((m) => Boolean(m[npcId]))
    if (alreadyPlaced) continue
    const placeKey = placesIn(npcWhere, world, worldPlaces)[0]
    if (!placeKey) continue
    const mapUse = uses.find((u) => Boolean(u.shapes[placeKey])) ?? (startingMap ? uses.find((u) => u.map === startingMap) : uses[0])
    if (!mapUse) continue
    stood[mapUse.map] = {
      ...(stood[mapUse.map] ?? {}),
      [npcId]: { at: spawnPointFor(mapUse.map, placeKey, 0), actions: '', decisions: '' }
    }
  }

  const catalog = catalogFrom(gameDefs.catalog())
  for (const sheetId of standingSheets) {
    try {
      const isParty = partyList.includes(sheetId)
      const brought = bring(save.id, sheetId, isParty ? whereStr : (npcHomeWhere.get(sheetId) ?? ''))
      // Initialize defaults and ensure party members (and any NPC with an existing game record) start alive with full HP
      const held = brought.characters[sheetId]
      if (held && (isParty || held.game)) {
        const entity = loadOrInitCharacterEntity(sheetId, held.game, catalog, true)
        saves.change(save.id, (s) => ({
          ...s,
          characters: { ...s.characters, [sheetId]: { ...s.characters[sheetId], game: entity.toRecord() } }
        }))
      }
      if (isParty && options?.loadout?.[sheetId]) {
        applyLoadoutOverride(save.id, sheetId, options.loadout[sheetId])
      }
    } catch (err) {
      noteFailure(err, 'worlds', 'Could not bring a character into the save')
    }
  }

  const sheetDisplayName = (id: string | null): string => {
    if (!id) return ''
    try {
      return getSheet(id).title || id
    } catch {
      return id
    }
  }
  const playerName = sheetDisplayName(player)
  const companionNames = companions.map((c) => sheetDisplayName(c)).filter(Boolean)
  const partyNames = [playerName, ...companionNames].filter(Boolean).join(' and ')
  const placeName = startingPlace ? String(worldPlaces[startingPlace]?.Name || startingPlace) : ''
  const openingVars: Record<string, string> = {
    player: playerName,
    party: partyNames,
    companions: companionNames.join(' and '),
    place: placeName,
    world: w.name
  }

  // Create dedicated 1-to-1 Almanac for this save, seeded from World opening + start options
  let almanacId = ''
  try {
    const alm = almanacs.save({
      id: `${save.id}_${w.id}`,
      title: `${w.name} — ${save.name}`,
      worldId: world,
      saveId: save.id,
      clockId: save.clockId || 'standard',
      currentTime: startingTime,
      cast: partyList,
      threads: [],
      entries: [],
      opening: {
        premise: renderSentenceTemplate(options?.premise ?? launch?.premise ?? '', openingVars),
        incitingIncident: renderSentenceTemplate(options?.incitingIncident ?? launch?.incitingIncident ?? '', openingVars),
        startingWhere: whereStr,
        startingTime,
        tone: options?.tone ?? launch?.tone ?? '',
        setting: launch?.setting ?? '',
        timePeriod: launch?.timePeriod ?? '',
        startingMap: startingMap ?? '',
        startingPlace: startingPlace ?? '',
        openingActionIds: options?.openingActionIds ?? launch?.openingActionIds ?? []
      },
      updatedAt: Date.now()
    })
    almanacId = alm.id
  } catch (err) {
    noteFailure(err, 'almanac', 'Could not create save almanac')
  }

  const saved = saves.change(save.id, (v) => ({
    ...v,
    ...(almanacId ? { almanacId } : {}),
    party: partyList,
    clock: { ...v.clock, time: startingTime },
    stand: { ...stood }
  }))

  // Execute opening trigger actions onto the new save and player
  const openingActionIds = options?.openingActionIds ?? launch?.openingActionIds ?? []
  if (openingActionIds.length) {
    applyOpeningTriggerActions(saved.id, player ?? null, openingActionIds)
  }

  for (const use of uses) {
    try {
      wakeMapSpawners(world, use.map, use.map === startingMap)
    } catch (err) {
      noteFailure(err, 'worlds', `Could not wake spawners on ${use.map}`)
    }
  }

  return saves.get(saved.id)
}

function applyOpeningTriggerActions(saveId: string, playerId: string | null, actionIds: string[]): void {
  const catalog = catalogFrom(gameDefs.catalog())
  for (const actionId of actionIds) {
    const action = triggerActionsStore.get(actionId)
    if (!action) continue
    for (const effect of triggerActionEffects(action)) {
      const e = effect as Record<string, unknown>
      if (e.type === 'world.setFlag' && typeof e.flag === 'string' && e.flag.trim()) {
        const rawVal = e.value
        const val = rawVal === 'true' ? true : rawVal === 'false' ? false : Number.isFinite(Number(rawVal)) && rawVal !== '' ? Number(rawVal) : String(rawVal ?? true)
        saves.change(saveId, (s) => ({ ...s, flags: { ...s.flags, [e.flag as string]: val } }))
      } else if (e.type === 'action.giveItem' && playerId) {
        const save = saves.read(saveId)
        const held = save?.characters[playerId]
        if (!held) continue
        const entity = loadOrInitCharacterEntity(playerId, held.game, catalog)
        let inv = entity.comp(Inventory)
        if (!inv) {
          inv = createComponent({ type: 'inventory' }) as Inventory
          entity.add(inv)
        }
        const gold = Number(e.gold ?? 0)
        if (Number.isFinite(gold) && gold > 0) inv.params.gold = Number(inv.params.gold ?? 0) + gold
        const itemId = typeof e.item === 'string' ? e.item.trim() : ''
        const count = Math.max(1, Math.floor(Number(e.count ?? 1)))
        if (itemId) {
          const tpl = catalog.template(ITEM_TEMPLATES, itemId)
          const def = tpl ? { ...(tpl as Record<string, unknown>), type: 'item', id: itemId } : { type: 'item', id: itemId }
          inv.give(def as Parameters<typeof inv.give>[0], count)
        }
        saves.change(saveId, (s) => ({
          ...s,
          characters: { ...s.characters, [playerId]: { ...s.characters[playerId], game: entity.toRecord() } }
        }))
      } else if (e.type === 'action.applyBuff' && playerId && typeof e.buff === 'string' && e.buff.trim()) {
        const save = saves.read(saveId)
        const held = save?.characters[playerId]
        if (!held) continue
        const entity = loadOrInitCharacterEntity(playerId, held.game, catalog)
        let buffs = entity.comp(Buffs)
        if (!buffs) {
          buffs = createComponent({ type: 'buffs' }) as Buffs
          entity.add(buffs)
        }
        const buffId = e.buff.trim()
        const tpl = catalog.template(BUFF_TEMPLATES, buffId)
        const def = tpl ? { ...(tpl as Record<string, unknown>), type: 'buff', id: buffId } : { type: 'buff', id: buffId }
        buffs.apply(def as Parameters<typeof buffs.apply>[0], entity, `opening:${actionId}`)
        saves.change(saveId, (s) => ({
          ...s,
          characters: { ...s.characters, [playerId]: { ...s.characters[playerId], game: entity.toRecord() } }
        }))
      }
    }
    saves.markUsed(saveId, `opening:${actionId}`, '')
  }
}

export function copyWorldSave(world: string, name: string): GameSave {
  const from = saves.currentOrNull(world)
  const next = saves.create(world, name, true)
  if (from?.almanacId) {
    try {
      const srcAlm = almanacs.find(from.almanacId)
      if (srcAlm) {
        const cloned = almanacs.save({
          ...srcAlm,
          id: `${next.id}_${world}`,
          title: `${worlds.exists(world) ? worlds.meta(world).name : world} — ${next.name}`,
          saveId: next.id,
          updatedAt: Date.now()
        })
        return saves.change(next.id, (v) => ({ ...v, almanacId: cloned.id }))
      }
    } catch (err) {
      noteFailure(err, 'almanac', 'Could not clone save almanac')
    }
  }
  return next
}

export function adoptOldPlay(world: string): GameSave {
  if (!worlds.exists(world)) throw new WorldError(`There is no world "${world}"`)
  const save = saves.current(world) ?? createNewWorldSave(world, 'Save 1')
  const places = worlds.entities(world, PLACE_TYPE_KEY, false, 'template')
  const stood = worlds.oldStand(world)
  const standing = new Set(Object.values(stood).flatMap((list) => Object.keys(list)))
  const placed = new Map<string, string>()
  for (const { id } of sheetIds()) {
    const s = getSheet(id)
    if (s.save) continue
    if (placesIn(s.story.where, world, places).length || standing.has(id)) placed.set(id, s.story.where)
  }
  for (const [sheet, where] of placed) bring(save.id, sheet, where)
  const journeys = worlds.oldJourneys(world)
  return saves.change(save.id, (v) => ({
    ...v,
    stand: { ...v.stand, ...Object.fromEntries(Object.entries(stood).map(([map, list]) => [map, { ...Object.fromEntries(Object.entries(list).filter(([sheet]) => sheet in v.characters)), ...(v.stand[map] ?? {}) }])) },
    journeys: { ...journeys, ...v.journeys },
    board: v.board.length ? v.board : worlds.oldBoard(world)
  }))
}

export function travel(sheet: string, id: string, map: string, place: string): GameSave {
  const save = saves.get(id)
  assertOutOfCombat(save, 'travel between locations')
  const uses = worlds.mapUses(save.world)
  const use = uses.find((u) => u.map === map) ?? uses[0]
  if (!use) throw new WorldError(`${worlds.meta(save.world).name} has no map to arrive on.`)
  const form = place ? use.shapes[place] : undefined
  const size = maps.get(use.map)?.size ?? { w: 0, h: 0 }
  const box = form ? shapeBounds(form) : null
  const at = box ? { x: Math.round(box.x + box.w / 2), y: Math.round(box.y + box.h / 2) } : { x: Math.round(size.w / 2), y: Math.round(size.h / 2) }
  const s = getSheet(sheet)
  bring(id, s.id, form ? `@place:${place}` : '')
  saves.change(id, (v) => ({ ...v, stand: { ...v.stand, [use.map]: { ...(v.stand[use.map] ?? {}), [s.id]: { at, actions: '', decisions: '' } } } }))
  saves.select(save.world, id)
  return wakeMapSpawners(save.world, use.map, true) ?? saves.get(id)
}
