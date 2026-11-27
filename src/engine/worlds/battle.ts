import { Health, Stats } from '@shared/game/components'
import { GameEntity, type Catalog, type EntityLookup, type TimeDef } from '@shared/game/core'
import type { FactionStance, StoredFaction } from '@shared/game/factions'
import { buildNavGrid, findPath, pointsDistanceFeet } from '@shared/game/nav'
import { contest, rollCheck, rollLine } from '@shared/game/rules'
import type { GameSave } from '@shared/game/save'
import {
  type BattleLogEntry,
  type BattleLogType,
  type BattleParticipant,
  type BattleRecord,
  type BattleSide
} from '@shared/game/state/battle'
import type { CreatureDisposition, CreatureSpawner } from '@shared/maps'
import { smallestAt, type Point } from '@shared/shapes'
import { rollDie } from '@shared/storyRolls'
import { actorLink, npcActorId, splitNpcRef } from '@shared/worldNpcs'
import {
  dropLostConcentration,
  gameCatalog,
  sheetTarget,
  type AbilityTarget
} from '../../modules/game/characters'
import { factions } from '../factions/store'
import { findSheet, getSheet } from '../library/sheets'
import { maps } from '../maps/store'
import { ToolError } from '../tools/types'
import { noteFailure } from '../util/report'
import { npcs } from './npcs'
import { saveInPlay } from './playLayer'
import { saves } from './saves'
import { worlds } from './store'
import { advanceWorldTime, clockOf } from './time'
import {
  assertActionCost,
  assertReactionAvailable,
  assertTurnActor,
  consumeReaction,
  consumeTurnCost,
  type CombatCost
} from './battleGate'

export interface BattleSlot {
  participant: BattleParticipant
  target: AbilityTarget
}

export interface BattleWorldContext {
  save: GameSave
  catalog: Catalog
  timeDef: TimeDef
  battle: BattleRecord | null
  entity(id: string): GameEntity | null
  participant(id: string): BattleParticipant | null
  allEntities(): GameEntity[]
  setBattle(next: BattleRecord | null): void
  moveStand(map: string, actorId: string, at: Point): void
  addLog(actorId: string, actorName: string, type: BattleLogType, text: string): void
}

const BATTLE_LOG_LIMIT = 60

function logEntry(round: number, actorId: string, actorName: string, type: BattleLogType, text: string): BattleLogEntry {
  return { id: crypto.randomUUID(), round, actorId, actorName, type, text, timestamp: Date.now() }
}

function appendBattleLog(logs: BattleLogEntry[], entry: BattleLogEntry): BattleLogEntry[] {
  return [...logs.slice(-(BATTLE_LOG_LIMIT - 1)), entry]
}

function factionMap(worldId?: string | null): Map<string, StoredFaction> {
  return new Map(factions.list(worldId, 'play').map((f) => [f.id, f]))
}

function stanceBetween(byId: Map<string, StoredFaction>, fromId: string, toId: string): FactionStance {
  const from = byId.get(fromId)
  const to = byId.get(toId)
  if (from && to) {
    if (from.id === to.id) return 'allied'
    if (to.id in from.relations) return from.relations[to.id]
    if (from.id in to.relations) return to.relations[from.id]
    return from.defaultStance
  }
  if (from) return from.defaultStance
  if (to) return to.defaultStance
  return 'neutral'
}

function resolveSideFor(
  partyFactions: string[],
  entityFaction: string,
  disposition: CreatureDisposition | undefined,
  byId: Map<string, StoredFaction>,
  explicitHostile: boolean
): BattleSide | null {
  if (explicitHostile) return 'hostile'
  if (!entityFaction) {
    if (disposition === 'hostile') return 'hostile'
    if (disposition === 'friendly') return 'ally'
    return null
  }
  if (partyFactions.includes(entityFaction)) return 'party'
  for (const pf of partyFactions) {
    const stance = stanceBetween(byId, entityFaction, pf)
    if (stance === 'hostile') return 'hostile'
    if (stance === 'allied') return 'ally'
  }
  return disposition === 'hostile' ? 'hostile' : null
}

/**
 * Mounts all battle participants into one shared EntityLookup (`GameEntity.world`),
 * executes `fn`, drops lost concentration across all entities, and persists state atomically.
 */
export function withBattleWorld<T>(
  worldId: string,
  fn: (ctx: BattleWorldContext) => T,
  extraIds: { sheets?: string[]; creatures?: string[] } = {}
): T {
  const initialSave = saveInPlay(worldId, true)
  if (!initialSave) throw new ToolError('This world has no save in play.')
  const cat = gameCatalog()
  const timeDef = clockOf(initialSave)
  let currentBattle: BattleRecord | null = initialSave.battle ?? null

  const targets = new Map<string, AbilityTarget>()
  const entitiesById = new Map<string, GameEntity>()
  const entitiesByUid = new Map<string, GameEntity>()
  const idByUid = new Map<string, string>()
  const pendingMoves = new Map<string, { map: string; at: Point }>()

  const register = (id: string) => {
    if (targets.has(id)) return
    try {
      const candidate = splitNpcRef(id) ? id : (findSheet(id, worldId) ?? npcActorId(worldId, id))
      const resolvedId = findSheet(candidate, worldId) ?? id
      const resolved = sheetTarget(resolvedId, cat)
      resolved.entity.link = actorLink(resolvedId)
      targets.set(id, resolved)
      entitiesById.set(id, resolved.entity)
      if (resolvedId !== id) entitiesById.set(resolvedId, resolved.entity)
      entitiesByUid.set(resolved.entity.uid, resolved.entity)
      idByUid.set(resolved.entity.uid, id)
    } catch (err) {
      noteFailure(err, 'game', `Could not mount combatant ${id}`)
    }
  }

  for (const p of currentBattle?.queue ?? []) register(p.id)
  for (const id of extraIds.sheets ?? []) register(id)
  for (const id of extraIds.creatures ?? []) register(id)

  const lookup: EntityLookup = {
    find: (uid) => entitiesByUid.get(uid) ?? entitiesById.get(uid) ?? null,
    tryReaction: (uid) => {
      if (!currentBattle || currentBattle.status !== 'active') return true
      const participantId = idByUid.get(uid) ?? uid
      if (!assertReactionAvailable(currentBattle, participantId)) return false
      currentBattle = consumeReaction(currentBattle, participantId)
      return true
    }
  }
  const all = [...entitiesById.values()]
  for (const e of all) e.world = lookup
  for (const e of all) e.start()

  try {
    const ctx: BattleWorldContext = {
      save: initialSave,
      catalog: cat,
      timeDef,
      get battle() {
        return currentBattle
      },
      entity: (id) => entitiesById.get(id) ?? null,
      participant: (id) => currentBattle?.queue.find((p) => p.id === id) ?? null,
      allEntities: () => [...all],
      setBattle: (next) => {
        currentBattle = next
      },
      moveStand: (map, actorId, at) => {
        pendingMoves.set(actorId, { map, at })
      },
      addLog: (actorId, actorName, type, text) => {
        if (!currentBattle) return
        currentBattle = {
          ...currentBattle,
          logs: appendBattleLog(currentBattle.logs, logEntry(currentBattle.round, actorId, actorName, type, text))
        }
      }
    }

    const result = fn(ctx)

    // Evaluate concentration loss across all live entities before persisting
    dropLostConcentration(all)

    // Persist mutated entities (sheets and world NPCs sync automatically via sheetTarget.persist)
    for (const [id, target] of targets) {
      if (
        currentBattle?.queue.some((p) => p.id === id) ||
        extraIds.sheets?.includes(id) ||
        extraIds.creatures?.includes(id)
      ) {
        target.persist()
      }
    }

    const latest = saveInPlay(worldId, true) ?? initialSave
    let updatedStand = latest.stand
    if (pendingMoves.size > 0) {
      updatedStand = { ...latest.stand }
      for (const [actorId, move] of pendingMoves) {
        const mapStand = { ...(updatedStand[move.map] ?? {}) }
        const prev = mapStand[actorId] ?? { at: move.at, actions: '', decisions: '' }
        mapStand[actorId] = { ...prev, at: move.at }
        updatedStand[move.map] = mapStand
      }
    }

    // Sync alive state & outcomes if battle still active
    if (currentBattle && currentBattle.status === 'active') {
      const livingParty = currentBattle.queue.filter((p) => (p.side === 'party' || p.side === 'ally') && !entitiesById.get(p.id)?.comp(Health)?.isDead)
      const livingHostiles = currentBattle.queue.filter((p) => p.side === 'hostile' && !entitiesById.get(p.id)?.comp(Health)?.isDead)
      if (livingHostiles.length === 0) {
        currentBattle = {
          ...currentBattle,
          status: 'victory',
          logs: appendBattleLog(currentBattle.logs, logEntry(currentBattle.round, 'system', 'Combat', 'info', 'All hostile combatants defeated — Victory!'))
        }
        for (const e of all) e.emit('OnBattleEnd', { status: 'victory' })
      } else if (livingParty.length === 0) {
        currentBattle = {
          ...currentBattle,
          status: 'defeat',
          logs: appendBattleLog(currentBattle.logs, logEntry(currentBattle.round, 'system', 'Combat', 'info', 'The party has fallen — Defeat.'))
        }
        for (const e of all) e.emit('OnBattleEnd', { status: 'defeat' })
      }
    }

    saves.write({
      ...latest,
      stand: updatedStand,
      battle: currentBattle
    })

    return result
  } finally {
    for (const e of all) e.stop()
  }
}

function rollInitiativeValue(entity: GameEntity, cat: Catalog, timeDef: TimeDef): number {
  const checkDef = cat.check(timeDef.initiativeCheck) ?? cat.checks()[0]
  if (!checkDef) return 0
  return rollCheck(entity, checkDef, rollDie).total
}

function speedOf(entity: GameEntity | null, cat: Catalog, timeDef: TimeDef): number {
  const statId = timeDef.speedStat
  if (!statId) return 0
  const fromEntity = entity?.comp(Stats)?.value(statId)
  if (typeof fromEntity === 'number' && Number.isFinite(fromEntity) && fromEntity > 0) return fromEntity
  return Math.max(0, cat.stat(statId)?.default ?? 0)
}

function spawnerRadiusFor(spawners: CreatureSpawner[] | undefined, save: GameSave, creatureId: string): number {
  const rec = save.records['spawners']
  if (!rec || !spawners?.length) return 0
  for (const [spawnerId, val] of Object.entries(rec)) {
    if (val && typeof val === 'object' && (val as { creature?: unknown }).creature === creatureId) {
      const spawner = spawners.find((s) => s.id === spawnerId)
      return Math.max(0, spawner?.triggerRadius ?? 0)
    }
  }
  return 0
}

/**
 * Starts a turn-based combat encounter on `GameSave.battle`, gathering the initiating actor,
 * targeted entities, same-room / nearby hostile factions, and party allies into initiative order.
 */
export function startBattle(opts: {
  world: string
  map: string
  initiatorId: string
  targetIds: string[]
  initialActionSpent?: CombatCost
}): GameSave {
  const save = saveInPlay(opts.world, true)
  if (!save) throw new ToolError('This world has no save in play.')
  if (save.battle?.status === 'active') return save

  const mapData = maps.get(opts.map)
  if (!mapData) throw new ToolError(`Map "${opts.map}" not found.`)
  const use = worlds.mapUses(opts.world).find((u) => u.map === opts.map)
  const standMap = save.stand[opts.map] ?? {}
  const cat = gameCatalog()
  const timeDef = clockOf(save)
  const byId = factionMap(opts.world)

  const explicitParty = save.party?.length ? save.party : [opts.initiatorId]
  const partySheets = explicitParty.filter((id) => Boolean(standMap[id]) || id === opts.initiatorId)
  if (!partySheets.includes(opts.initiatorId) && findSheet(opts.initiatorId, opts.world)) {
    partySheets.unshift(opts.initiatorId)
  }
  const partyFactions = partySheets.map((id) => getSheet(id).faction ?? '').filter(Boolean)

  const anchorId = opts.targetIds[0] ?? opts.initiatorId
  const anchorAt = standMap[anchorId]?.at ?? standMap[opts.initiatorId]?.at ?? { x: 0, y: 0 }
  const anchorPlace = use ? smallestAt(use.shapes, anchorAt) : null

  const targetSet = new Set(opts.targetIds)
  const sheetIdsToMount = new Set<string>(partySheets)
  const candidateMeta = new Map<string, { kind: 'sheet'; faction: string; side: BattleSide }>()

  for (const sheetId of partySheets) {
    const s = getSheet(sheetId)
    candidateMeta.set(sheetId, { kind: 'sheet', faction: s.faction ?? '', side: 'party' })
  }

  const withinEncounter = (at: Point, explicit: boolean, extraRadius = 0): boolean => {
    if (explicit) return true
    if (anchorPlace && use && smallestAt(use.shapes, at) === anchorPlace) return true
    const radius = Math.max(timeDef.encounterJoinRadius, extraRadius)
    if (radius <= 0) return false
    return pointsDistanceFeet(anchorAt, at, mapData.tile.w, timeDef.tileFeet) <= radius
  }

  for (const [tokenId, st] of Object.entries(standMap)) {
    if (candidateMeta.has(tokenId)) continue
    const explicit = targetSet.has(tokenId)
    const resolvedId = findSheet(tokenId, opts.world)
    if (!resolvedId) continue
    if (tokenId in save.characters && partySheets.includes(tokenId)) continue
    const sheet = getSheet(resolvedId)
    if (sheet.game && GameEntity.fromRecord(sheet.game, cat).comp(Health)?.isDead) continue
    const npcRef = splitNpcRef(resolvedId)
    const disp = npcRef ? npcs.find(npcRef.id, opts.world, 'play')?.disposition : undefined
    const side = resolveSideFor(partyFactions, sheet.faction ?? '', disp, byId, explicit)
    if (!withinEncounter(st.at, explicit, spawnerRadiusFor(mapData.spawners, save, tokenId))) continue
    if (side === 'hostile' || side === 'ally' || explicit) {
      sheetIdsToMount.add(tokenId)
      candidateMeta.set(tokenId, { kind: 'sheet', faction: sheet.faction ?? '', side: explicit ? 'hostile' : side! })
    }
  }

  withBattleWorld(
    opts.world,
    (ctx) => {
      const rolled: BattleParticipant[] = []
      for (const [id, meta] of candidateMeta) {
        const entity = ctx.entity(id)
        if (!entity || entity.comp(Health)?.isDead) continue
        rolled.push({
          id,
          kind: meta.kind,
          faction: meta.faction,
          side: meta.side,
          initiative: rollInitiativeValue(entity, ctx.catalog, ctx.timeDef)
        })
      }

      rolled.sort((a, b) => {
        if (b.initiative !== a.initiative) return b.initiative - a.initiative
        if (a.side === 'party' && b.side !== 'party') return -1
        if (a.side !== 'party' && b.side === 'party') return 1
        return 0
      })

      if (!rolled.length) throw new ToolError('No living combatants found to start battle.')
      if (!rolled.some((p) => p.side === 'party' || p.side === 'ally')) {
        throw new ToolError('No living party member is available to enter combat.')
      }
      const first = rolled[0]
      const firstEntity = ctx.entity(first.id)
      const moveMax = speedOf(firstEntity, ctx.catalog, ctx.timeDef)

      const openingSpentAction = opts.initialActionSpent === 'action' && first.id === opts.initiatorId
      const openingSpentBonus = opts.initialActionSpent === 'bonus' && first.id === opts.initiatorId

      const battle: BattleRecord = {
        id: crypto.randomUUID(),
        map: opts.map,
        round: 1,
        activeIndex: 0,
        status: 'active',
        queue: rolled,
        economy: {
          actionUsed: openingSpentAction,
          bonusActionUsed: openingSpentBonus,
          reactionUsedBy: {},
          movementRemaining: moveMax,
          movementMax: moveMax
        },
        logs: [
          logEntry(
            1,
            'system',
            'Combat',
            'info',
            `Battle started! Turn order: ${rolled.map((p) => `${ctx.entity(p.id)?.name ?? p.id} (${p.initiative})`).join(', ')}.`
          )
        ]
      }
      ctx.setBattle(battle)

      for (const p of rolled) ctx.entity(p.id)?.emit('OnBattleStart', { battle: battle.id })
      firstEntity?.emit('OnTurnStart', { round: 1 })
    },
    { sheets: [...sheetIdsToMount] }
  )

  return saveInPlay(opts.world, false)!
}

/** Joins additional living participants (e.g. proximity ambush or summoned unit) into an active battle. */
export function joinBattle(worldId: string, entries: { id: string; kind: 'sheet' | 'creature'; side?: BattleSide }[]): GameSave {
  const save = saveInPlay(worldId, true)
  if (!save?.battle || save.battle.status !== 'active') throw new ToolError('No active battle to join.')
  const sheets = entries.map((e) => e.id)

  withBattleWorld(
    worldId,
    (ctx) => {
      const battle = ctx.battle
      if (!battle) return
      const existing = new Set(battle.queue.map((p) => p.id))
      const added: BattleParticipant[] = []
      const byId = factionMap(worldId)
      const partyFactions = battle.queue.filter((p) => p.side === 'party').map((p) => p.faction).filter(Boolean)

      for (const entry of entries) {
        if (existing.has(entry.id)) continue
        const entity = ctx.entity(entry.id)
        if (!entity || entity.comp(Health)?.isDead) continue
        const resolvedId = findSheet(entry.id, worldId) ?? entry.id
        const sheet = findSheet(resolvedId, worldId) ? getSheet(resolvedId) : null
        const faction = sheet?.faction ?? ''
        const npcRef = splitNpcRef(resolvedId)
        const disp = npcRef ? npcs.find(npcRef.id, worldId, 'play')?.disposition : undefined
        const side = entry.side ?? resolveSideFor(partyFactions, faction, disp, byId, false) ?? 'hostile'
        const participant: BattleParticipant = {
          id: entry.id,
          kind: 'sheet',
          faction,
          side,
          initiative: rollInitiativeValue(entity, ctx.catalog, ctx.timeDef)
        }
        added.push(participant)
        entity.emit('OnBattleStart', { battle: battle.id })
        ctx.addLog(participant.id, entity.name, 'info', `${entity.name} joined the battle (Initiative ${participant.initiative}).`)
      }
      if (added.length) {
        ctx.setBattle({ ...battle, queue: [...battle.queue, ...added] })
      }
    },
    { sheets }
  )

  return saveInPlay(worldId, false)!
}

/**
 * Advances the active battle turn inside an active `BattleWorldContext` (for both player End Turn and AI step cleanup):
 * emits OnTurnEnd, handles round wrap + Buffs/Clock advancement, refreshes economy, and emits OnTurnStart.
 */
export function advanceTurnInContext(ctx: BattleWorldContext): void {
  const battle = ctx.battle
  if (!battle || battle.status !== 'active' || !battle.queue.length) return

  const ending = battle.queue[battle.activeIndex]
  const endingEntity = ending ? ctx.entity(ending.id) : null
  endingEntity?.emit('OnTurnEnd', { round: battle.round })

  const livingParty = battle.queue.filter((p) => (p.side === 'party' || p.side === 'ally') && !ctx.entity(p.id)?.comp(Health)?.isDead)
  const livingHostiles = battle.queue.filter((p) => p.side === 'hostile' && !ctx.entity(p.id)?.comp(Health)?.isDead)
  if (livingHostiles.length === 0 || livingParty.length === 0) return

  let nextIndex = (battle.activeIndex + 1) % battle.queue.length
  let attempts = 0
  while (ctx.entity(battle.queue[nextIndex].id)?.comp(Health)?.isDead && attempts < battle.queue.length) {
    nextIndex = (nextIndex + 1) % battle.queue.length
    attempts++
  }

  const wrapped = nextIndex <= battle.activeIndex
  const nextRound = wrapped ? battle.round + 1 : battle.round
  const nextActor = battle.queue[nextIndex]
  const nextEntity = ctx.entity(nextActor.id)
  const moveMax = speedOf(nextEntity, ctx.catalog, ctx.timeDef)

  if (wrapped && ctx.timeDef.roundSeconds > 0) {
    // Tick battle buffs cleanly for all mounted entities in combat
    for (const p of battle.queue) {
      const e = ctx.entity(p.id)
      if (!e || e.comp(Health)?.isDead) continue
      e.tickSim(ctx.timeDef.roundSeconds)
    }
    const nonBattleSheets = Object.keys(ctx.save.characters).filter((id) => !battle.queue.some((p) => p.id === id))
    try {
      advanceWorldTime(ctx.save.id, ctx.timeDef.roundSeconds, 'round', nonBattleSheets, { skipTurnSignals: true })
    } catch (err) {
      noteFailure(err, 'game', 'Could not advance world clock on combat round wrap')
    }
  }

  const nextReactions = { ...battle.economy.reactionUsedBy, [nextActor.id]: false }
  const nextBattle: BattleRecord = {
    ...battle,
    round: nextRound,
    activeIndex: nextIndex,
    economy: {
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsedBy: nextReactions,
      movementRemaining: moveMax,
      movementMax: moveMax
    },
    logs: appendBattleLog(
      battle.logs,
      logEntry(nextRound, nextActor.id, nextEntity?.name ?? nextActor.id, 'turn', `Round ${nextRound}: ${nextEntity?.name ?? nextActor.id}'s turn.`)
    )
  }
  ctx.setBattle(nextBattle)
  nextEntity?.emit('OnTurnStart', { round: nextRound })
}

/** Player-facing End Turn IPC. */
export function endTurn(worldId: string): GameSave {
  withBattleWorld(worldId, (ctx) => {
    const battle = ctx.battle
    if (!battle || battle.status !== 'active') throw new ToolError('No active battle.')
    const active = battle.queue[battle.activeIndex]
    assertTurnActor(battle, active.id, true)
    advanceTurnInContext(ctx)
  })
  return saveInPlay(worldId, false)!
}

/** Moves the active turn actor along a valid NavGrid path, spending exact movement feet and running OnMove triggers. */
export function moveInBattle(worldId: string, actorId: string, destination: Point): GameSave {
  withBattleWorld(worldId, (ctx) => {
    const battle = ctx.battle
    if (!battle || battle.status !== 'active') throw new ToolError('No active battle.')
    assertTurnActor(battle, actorId, true)

    const mapData = maps.get(battle.map)
    if (!mapData) throw new ToolError('Battle map not found.')
    const startAt = ctx.save.stand[battle.map]?.[actorId]?.at
    if (!startAt) throw new ToolError('Combatant has no position on the map.')

    const grid = buildNavGrid(mapData, ctx.save.thingFlags)
    const path = findPath(grid, startAt, destination)
    if (!path || path.length < 2) throw new ToolError('No reachable path to that tile.')

    const feet = (path.length - 1) * ctx.timeDef.tileFeet
    if (feet > battle.economy.movementRemaining) {
      throw new ToolError(`Destination needs ${feet} ft (${battle.economy.movementRemaining} ft remaining).`)
    }

    const arrivedAt = path[path.length - 1]
    ctx.moveStand(battle.map, actorId, arrivedAt)
    const nextBattle: BattleRecord = {
      ...battle,
      economy: {
        ...battle.economy,
        movementRemaining: Math.max(0, battle.economy.movementRemaining - feet)
      }
    }
    ctx.setBattle(nextBattle)
    const actor = ctx.entity(actorId)
    const actorName = actor?.name ?? actorId
    ctx.addLog(actorId, actorName, 'move', `${actorName} moved ${feet} ft.`)
    actor?.emit('OnMove', { distance: feet })
  })

  return saveInPlay(worldId, false)!
}

/** Uses a configurable CheckDef (opposed by `TimeDef.parleyDefenseCheck`) to negotiate truce or recruit an opponent. */
export function parleyInBattle(opts: {
  world: string
  targetId: string
  mode: 'truce' | 'recruit'
  checkId?: string
}): GameSave {
  withBattleWorld(opts.world, (ctx) => {
    const battle = ctx.battle
    if (!battle || battle.status !== 'active') throw new ToolError('No active battle.')
    const active = battle.queue[battle.activeIndex]
    assertTurnActor(battle, active.id, true)
    assertActionCost(battle, 'action')

    const actor = ctx.entity(active.id)
    const target = battle.queue.find((p) => p.id === opts.targetId)
    const targetEnt = target ? ctx.entity(target.id) : null
    if (!actor || !target || !targetEnt) throw new ToolError('Target is not in this battle.')
    if (target.side !== 'hostile') throw new ToolError(`${targetEnt.name} is already not hostile.`)

    const speakerCheck = ctx.catalog.check(opts.checkId || ctx.timeDef.parleyCheck) ?? ctx.catalog.checks()[0]
    if (!speakerCheck) throw new ToolError('No Check definition available.')
    const defenseCheck = ctx.catalog.check(ctx.timeDef.parleyDefenseCheck) ?? speakerCheck

    const speakerRoll = rollCheck(actor, speakerCheck, rollDie)
    const targetRoll = rollCheck(targetEnt, defenseCheck, rollDie)
    const outcome = contest(speakerRoll, { roll: targetRoll })
    const summary = `${rollLine(actor.name, speakerRoll)} vs ${rollLine(targetEnt.name, targetRoll)}`

    let next = consumeTurnCost(battle, 'action')
    if (!outcome.passed) {
      ctx.setBattle(next)
      ctx.addLog(active.id, actor.name, 'parley', `${summary} — failed.`)
      return
    }

    if (opts.mode === 'recruit') {
      next = {
        ...next,
        queue: next.queue.map((p) => (p.id === target.id ? { ...p, side: 'ally', faction: active.faction || p.faction } : p))
      }
      ctx.setBattle(next)
      ctx.addLog(active.id, actor.name, 'parley', `${summary} — ${targetEnt.name} agrees to stand with your party!`)
    } else {
      next = {
        ...next,
        queue: next.queue.filter((p) => p.id !== target.id)
      }
      ctx.setBattle(next)
      ctx.addLog(active.id, actor.name, 'parley', `${summary} — truce agreed with ${targetEnt.name}.`)
    }
  })
  return saveInPlay(opts.world, false)!
}

/** Flees active battle on a party turn. */
export function fleeBattle(worldId: string): GameSave {
  withBattleWorld(worldId, (ctx) => {
    const battle = ctx.battle
    if (!battle || battle.status !== 'active') throw new ToolError('No active battle.')
    const active = battle.queue[battle.activeIndex]
    assertTurnActor(battle, active.id, true)
    const actor = ctx.entity(active.id)
    ctx.addLog(active.id, actor?.name ?? active.id, 'info', `${actor?.name ?? active.id} withdrew the party from combat.`)
    ctx.setBattle({ ...ctx.battle!, status: 'fled' })
    for (const e of ctx.allEntities()) e.emit('OnBattleEnd', { status: 'fled' })
  })
  return saveInPlay(worldId, false)!
}

/** Clears completed battle state from GameSave and removes defeated non-party NPC tokens from the map. */
export function endBattle(worldId: string): GameSave {
  const save = saveInPlay(worldId, true)
  if (!save) throw new ToolError('This world has no save in play.')
  const battle = save.battle
  if (!battle) return save
  const cat = gameCatalog()

  const deadTokens = new Set<string>()
  const deadTransientNpcs = new Set<string>()
  for (const p of battle.queue) {
    if (save.party?.includes(p.id) || p.side === 'party') continue
    const npcRef = splitNpcRef(p.id)
    if (!npcRef) continue
    const found = npcs.find(npcRef.id, worldId, 'play')
    if (!found?.game) continue
    if (GameEntity.fromRecord(found.game, cat).comp(Health)?.isDead) {
      deadTokens.add(p.id)
      if (!npcs.hasTemplate(worldId, npcRef.id)) deadTransientNpcs.add(npcRef.id)
    }
  }

  const nextNpcs = { ...save.npcs }
  for (const npcId of deadTransientNpcs) delete nextNpcs[npcId]

  const written = saves.write({
    ...save,
    npcs: nextNpcs,
    stand: Object.fromEntries(
      Object.entries(save.stand).map(([m, list]) => [
        m,
        Object.fromEntries(Object.entries(list).filter(([tok]) => !deadTokens.has(tok)))
      ])
    ),
    battle: null
  })
  if (deadTransientNpcs.size) npcs.emit('changed', worldId)
  return written
}
