import { create } from 'zustand'
import type { Point } from '@shared/shapes'
import { type ActionPiece, Health, Stats, actionHasGroup, usableAbilities } from '@shared/game/components'
import { GameEntity, type Catalog, type TimeDef } from '@shared/game/core'
import { HARM } from '@shared/game/effectGroups'
import { pointsDistanceFeet } from '@shared/game/nav'
import type { BattleRecord } from '@shared/game/state/battle'
import type { BattleState, CombatAttack, Combatant } from '@shared/game/state/BattleStateMachine'
import type { MapToken } from '../../maps/TokenLayer'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { usePlayScene } from '../scenes/sceneStore'
import { findDefenseRollAbility, findMovementAbility, runAbilityUse } from './combatGate'

function attacksOf(entity: GameEntity | null): CombatAttack[] {
  if (!entity) return []
  return usableAbilities(entity)
    .filter((a) => actionHasGroup(a, HARM))
    .map((a) => {
      const dmg = a.comps
        .filter((c) => (c.constructor as typeof ActionPiece).GROUP === HARM)
        .flatMap((c) => c.tooltipRows())
        .map((r) => r.value)
        .filter(Boolean)
        .join(' + ')
      return { id: a.uid, name: String(a.params.label || a.id), range: a.reach(), damage: dmg }
    })
}

function projectBattle(
  record: BattleRecord | null,
  tokens: MapToken[],
  catalog: Catalog | null,
  timeDef: TimeDef | null
): BattleState | null {
  if (!record) return null
  const activeId = record.queue[record.activeIndex]?.id
  const speedStat = timeDef?.speedStat ?? ''
  const defaultSpeed = speedStat ? (catalog?.stat(speedStat)?.default ?? 0) : 0
  let activeDodging = false

  const queue: Combatant[] = record.queue.map((p) => {
    const tok = tokens.find((t) => (p.kind === 'sheet' ? t.visitor.sheet === p.id : t.visitor.token === p.id))
    const v = tok?.visitor
    const ent = v?.game && catalog ? GameEntity.fromRecord(v.game, catalog) : null
    const hpComp = ent?.comp(Health)
    const hp = hpComp
      ? { cur: Math.max(0, Math.round(hpComp.get())), max: Math.max(1, Math.round(hpComp.max())) }
      : (v?.hp ?? v?.dnd?.hp ?? { cur: 0, max: 0 })
    const ac = ent?.comp(Stats)?.value('armour') ?? v?.dnd?.ac ?? (catalog?.stat('armour')?.default ?? 0)
    const statSpeed = speedStat ? ent?.comp(Stats)?.value(speedStat) : undefined
    const speedMax = record.economy.movementMax || statSpeed || defaultSpeed
    if (p.id === activeId && ent) {
      activeDodging = Boolean(ent.rollFlags('incoming').disadvantage)
    }
    return {
      id: p.id,
      name: v?.name ?? p.id,
      sheet: p.kind === 'sheet' ? p.id : undefined,
      image: v?.image ?? null,
      isPlayer: p.side === 'party',
      isAlly: p.side === 'ally',
      initiative: p.initiative,
      hp,
      ac,
      speedMax: v?.dnd?.speed ?? speedMax,
      at: tok?.at,
      attacks: attacksOf(ent),
      faction: p.faction || v?.faction || null
    }
  })

  return {
    id: record.id,
    round: record.round,
    queue,
    activeTurnIndex: Math.min(Math.max(0, record.activeIndex), Math.max(0, queue.length - 1)),
    economy: {
      movementRemaining: record.economy.movementRemaining,
      movementMax: record.economy.movementMax || queue[record.activeIndex]?.speedMax || defaultSpeed,
      actionUsed: record.economy.actionUsed,
      bonusActionUsed: record.economy.bonusActionUsed,
      reactionUsed: Boolean(activeId && record.economy.reactionUsedBy[activeId]),
      isDodging: activeDodging
    },
    status: record.status,
    logs: record.logs.map((l) => ({
      id: l.id,
      round: l.round,
      actorName: l.actorName,
      text: l.text,
      type: l.type,
      timestamp: l.timestamp
    }))
  }
}

interface GameEngineStore {
  world: string | null
  map: string | null
  tileWidth: number
  tileFeet: number
  catalog: Catalog | null
  timeDef: TimeDef | null
  tokens: MapToken[]
  tokensSig: string
  record: BattleRecord | null
  battle: BattleState | null

  syncFromSave: (opts: {
    world: string
    map: string
    tileWidth: number
    tileFeet: number
    record: BattleRecord | null
    tokens: MapToken[]
    tokensSig?: string
    catalog: Catalog | null
    timeDef: TimeDef | null
  }) => void

  startBattle: (initiatorId: string, targetIds: string[]) => Promise<void>
  endTurn: () => Promise<void>
  dashAction: () => Promise<void>
  dodgeAction: () => Promise<void>
  moveActor: (at: Point) => Promise<void>
  attackTarget: (targetId: string, abilityKey?: string) => Promise<void>
  executeAiTurn: () => Promise<void>
  parleyWithEnemy: (enemyId: string, recruited?: boolean, checkId?: string) => Promise<void>
  endBattle: (outcome?: 'victory' | 'defeat' | 'flee') => Promise<void>
}

function runCombatSelfAbility(
  getState: () => GameEngineStore,
  kind: 'movement' | 'defenseRoll',
  missingMessage: string
): void {
  const { world, battle, tokens, catalog } = getState()
  if (!world || !battle || battle.status !== 'active' || !catalog) return
  const active = battle.queue[battle.activeTurnIndex]
  if (!active?.sheet) return
  const tok = tokens.find((t) => t.visitor.sheet === active.sheet)
  const ent = tok?.visitor.game ? GameEntity.fromRecord(tok.visitor.game, catalog) : null
  if (!ent) return
  const ability = kind === 'movement' ? findMovementAbility(ent) : findDefenseRollAbility(ent, catalog)
  if (!ability) {
    toast.info('Ability Missing', missingMessage)
    return
  }
  runAbilityUse({
    sheet: active.sheet,
    entity: ent,
    ability,
    target: { sheet: active.sheet },
    at: active.at ?? null,
    distance: 0,
    world,
    battle
  })
}

function syncBattleRecord(get: () => GameEngineStore, record: BattleRecord | null | undefined): void {
  const { world, map, tileWidth, tileFeet, tokens, tokensSig, catalog, timeDef } = get()
  if (!world || !map) return
  get().syncFromSave({
    world,
    map,
    tileWidth,
    tileFeet,
    record: record ?? null,
    tokens,
    tokensSig,
    catalog,
    timeDef
  })
}

export const useGameState = create<GameEngineStore>((set, get) => ({
  world: null,
  map: null,
  tileWidth: 32,
  tileFeet: 5,
  catalog: null,
  timeDef: null,
  tokens: [],
  tokensSig: '',
  record: null,
  battle: null,

  syncFromSave: ({ world, map, tileWidth, tileFeet, record, tokens, tokensSig = '', catalog, timeDef }) => {
    const prev = get()
    if (
      prev.world === world &&
      prev.map === map &&
      prev.tileWidth === tileWidth &&
      prev.tileFeet === tileFeet &&
      prev.record === record &&
      prev.tokensSig === tokensSig &&
      prev.catalog === catalog &&
      prev.timeDef === timeDef
    ) {
      if (!record) usePlayScene.getState().endBattle()
      return
    }
    const prevStatus = prev.record?.status ?? null
    const battle = projectBattle(record, tokens, catalog, timeDef)
    set({ world, map, tileWidth, tileFeet, catalog, timeDef, tokens, tokensSig, record, battle })
    if (record?.status === 'active' && prevStatus !== 'active') {
      usePlayScene.getState().startBattle()
    } else if (!record) {
      usePlayScene.getState().endBattle()
    }
  },

  startBattle: async (initiatorId, targetIds) => {
    const { world, map } = get()
    if (!world || !map || !initiatorId || !targetIds.length) return
    try {
      const saved = await engine('battle.start', { world, map, initiatorId, targetIds })
      syncBattleRecord(get, saved.battle)
    } catch (err) {
      failed('Could not start battle')(err)
    }
  },

  endTurn: async () => {
    const { world } = get()
    if (!world) return
    try {
      const saved = await engine('battle.endTurn', { world })
      syncBattleRecord(get, saved.battle)
    } catch (err) {
      failed('Could not end turn')(err)
    }
  },

  dashAction: async () => {
    runCombatSelfAbility(get, 'movement', 'Active combatant has no movement-granting ability.')
  },

  dodgeAction: async () => {
    runCombatSelfAbility(get, 'defenseRoll', 'Active combatant has no defensive roll-modifier ability.')
  },

  moveActor: async (at) => {
    const { world, battle } = get()
    const active = battle?.queue[battle.activeTurnIndex]
    if (!world || !active) return
    try {
      const saved = await engine('battle.move', { world, actorId: active.id, at })
      syncBattleRecord(get, saved.battle)
    } catch (err) {
      failed('Could not move')(err)
    }
  },

  attackTarget: async (targetId, abilityKey) => {
    const { world, battle, tileWidth, tileFeet } = get()
    if (!world || !battle || battle.status !== 'active') return
    const active = battle.queue[battle.activeTurnIndex]
    const target = battle.queue.find((c) => c.id === targetId)
    if (!active || !active.sheet || !target) return
    const chosen = (abilityKey ? active.attacks.find((a) => a.id === abilityKey || a.name === abilityKey) : null) ?? active.attacks[0]
    if (!chosen) {
      toast.info('No Attack', `${active.name} has no usable attack ability.`)
      return
    }
    const dist = active.at && target.at ? Math.round(pointsDistanceFeet(active.at, target.at, tileWidth, tileFeet)) : 0
    try {
      const msg = await engine('game.useAbility', {
        sheet: active.sheet,
        ability: chosen.id,
        target: target.sheet ? { sheet: target.sheet } : { creature: target.id },
        world,
        at: target.at ?? null,
        distance: dist
      })
      toast.info(chosen.name, msg)
    } catch (err) {
      failed(`Could not use ${chosen.name}`)(err)
    }
  },

  executeAiTurn: async () => {
    const { world } = get()
    if (!world) return
    try {
      const saved = await engine('battle.stepAi', { world })
      syncBattleRecord(get, saved.battle)
    } catch (err) {
      failed('Enemy turn failed')(err)
    }
  },

  parleyWithEnemy: async (enemyId, recruited = false, checkId) => {
    const { world } = get()
    if (!world) return
    try {
      const saved = await engine('battle.parley', { world, targetId: enemyId, mode: recruited ? 'recruit' : 'truce', checkId })
      syncBattleRecord(get, saved.battle)
    } catch (err) {
      failed('Could not parley')(err)
    }
  },

  endBattle: async (outcome) => {
    const { world, battle } = get()
    if (!world) {
      set({ record: null, battle: null })
      usePlayScene.getState().endBattle()
      return
    }
    try {
      if (outcome === 'flee' && battle?.status === 'active') {
        await engine('battle.flee', { world })
      }
      const saved = await engine('battle.end', { world })
      syncBattleRecord(get, saved.battle)
      usePlayScene.getState().endBattle()
    } catch (err) {
      failed('Could not close battle')(err)
    }
  }
}))
