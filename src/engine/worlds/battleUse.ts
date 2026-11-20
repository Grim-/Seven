import type { EffectResult, EffectTargetRef } from '@shared/effects'
import { Action, actionHasGroup, Equipment, Inventory, Item, usableAbilities, type UseContext } from '@shared/game/components'
import { HARM } from '@shared/game/effectGroups'
import { buildNavGrid, pointsDistanceFeet } from '@shared/game/nav'
import type { Point } from '@shared/shapes'
import { useAbility } from '../../modules/game/characters'
import { maps } from '../maps/store'
import { ToolError } from '../tools/types'
import { activeBattleOf, assertActionCost, assertTurnActor, consumeTurnCost, type CombatCost } from './battleGate'
import { saveInPlay } from './playLayer'
import { startBattle, withBattleWorld, type BattleWorldContext } from './battle'

function mapOfToken(save: ReturnType<typeof saveInPlay>, tokenId: string): string | null {
  if (!save) return null
  if (save.battle?.status === 'active') return save.battle.map
  for (const [mapId, list] of Object.entries(save.stand)) {
    if (tokenId in list) return mapId
  }
  return Object.keys(save.stand)[0] ?? null
}

function targetIdOf(ref: EffectTargetRef | null): string | null {
  if (!ref) return null
  return ref.sheet || ref.creature || null
}

function actionTitle(action: Action): string {
  const id = (action as Action & { id?: string }).id
  return String(action.params.label || id || action.type)
}

interface ResolvedAction {
  action: Action
  reach: number
  cost: CombatCost
  harmful: boolean
  run: (ctx: UseContext) => true | string
}

function runWorldAction(
  world: string,
  sheet: string,
  target: EffectTargetRef | null,
  at: Point | null,
  clientDistance: number,
  resolve: (ctx: BattleWorldContext, user: NonNullable<ReturnType<BattleWorldContext['entity']>>) => ResolvedAction
): string {
  const initial = saveInPlay(world, true)
  if (!initial) throw new ToolError('This world has no save in play.')

  const targetId = targetIdOf(target)
  const isSelf = !target || targetId === sheet
  const mapId = mapOfToken(initial, sheet)
  const mapData = mapId ? maps.get(mapId) : null

  let message = ''
  let autoEngage: { map: string; targetId: string; cost: CombatCost } | null = null

  withBattleWorld(
    world,
    (ctx) => {
      const user = ctx.entity(sheet)
      if (!user) throw new ToolError(`${sheet} is not in the game.`)
      const targetEntity = isSelf ? user : (targetId ? ctx.entity(targetId) : null)
      const resolved = resolve(ctx, user)

      const activeBattle = ctx.battle?.status === 'active' ? ctx.battle : null
      if (activeBattle) {
        assertTurnActor(activeBattle, sheet, true)
        assertActionCost(activeBattle, resolved.cost)
      }

      const stand = mapId ? (ctx.save.stand[mapId] ?? {}) : {}
      const userPos = stand[sheet]?.at ?? null
      const targetPos = (targetId ? stand[targetId]?.at : null) ?? at
      let dist = clientDistance
      if (mapData && userPos && targetPos && !isSelf) {
        dist = Math.round(pointsDistanceFeet(userPos, targetPos, mapData.tile.w, ctx.timeDef.tileFeet))
        if (resolved.reach > ctx.timeDef.tileFeet && !buildNavGrid(mapData, ctx.save.thingFlags).clear(userPos, targetPos)) {
          throw new ToolError('Target is behind an obstacle (no line of sight).')
        }
      } else if (isSelf) {
        dist = 0
      }

      let grantedFeet = 0
      const collected: EffectResult[] = []
      const done = resolved.run({
        user,
        target: targetEntity,
        at: targetPos,
        distance: dist,
        collect: (r) => collected.push(r),
        grantMovement: (feet) => {
          grantedFeet += feet
        }
      })
      if (done !== true) throw new ToolError(done)

      const label = actionTitle(resolved.action)
      const summary = collected.map((c) => c.line).filter(Boolean).join(' ')
      message = summary || `${user.name} used ${label}${targetEntity && !isSelf ? ` on ${targetEntity.name}` : ''}.`

      if (activeBattle) {
        let next = consumeTurnCost(activeBattle, resolved.cost)
        if (grantedFeet > 0) {
          next = {
            ...next,
            economy: { ...next.economy, movementRemaining: next.economy.movementRemaining + grantedFeet }
          }
        }
        ctx.setBattle(next)
        ctx.addLog(sheet, user.name, resolved.harmful ? 'attack' : 'info', message)
      } else if (!isSelf && targetId && mapId && resolved.harmful) {
        autoEngage = { map: mapId, targetId, cost: resolved.cost }
      }
    },
    {
      sheets: [sheet, ...(target?.sheet && target.sheet !== sheet ? [target.sheet] : [])],
      creatures: target?.creature ? [target.creature] : []
    }
  )

  if (autoEngage) {
    const eng = autoEngage as { map: string; targetId: string; cost: CombatCost }
    if (!activeBattleOf(saveInPlay(world, false))) {
      startBattle({
        world,
        map: eng.map,
        initiatorId: sheet,
        targetIds: [eng.targetId],
        initialActionSpent: eng.cost
      })
    }
  }

  return message
}

/**
 * Resolves ability use inside a world with strict active-turn gating, action economy checks,
 * authoritative map distance + NavGrid line-of-sight verification, and hostile auto-combat.
 */
export function useAbilityInWorld(
  sheet: string,
  ability: string,
  target: EffectTargetRef | null,
  world: string | null,
  at: Point | null,
  clientDistance: number
): string {
  if (!world) return useAbility(sheet, ability, target, null, at, clientDistance)
  if (!saveInPlay(world, true)) return useAbility(sheet, ability, target, null, at, clientDistance)

  return runWorldAction(world, sheet, target, at, clientDistance, (_ctx, user) => {
    const found = usableAbilities(user).find(
      (a) => a.uid === ability || a.id === ability || String(a.params.label ?? '').toLowerCase() === ability.toLowerCase()
    )
    if (!found) throw new ToolError(`${user.name} can't use that now.`)
    return {
      action: found,
      reach: found.reach(),
      cost: String(found.params.action || 'action') as CombatCost,
      harmful: actionHasGroup(found, HARM),
      run: (useCtx) => found.use(useCtx)
    }
  })
}

/**
 * Resolves usable Inventory/Equipment items on the engine inside combat turn/economy gates.
 */
export function useItemInWorld(
  sheet: string,
  itemKey: string,
  target: EffectTargetRef | null,
  world: string | null,
  at: Point | null
): string {
  if (!world) throw new ToolError('A world save is required to use items.')

  return runWorldAction(world, sheet, target, at, 0, (_ctx, user) => {
    const bag = user.comp(Inventory)?.items ?? []
    const worn = user.comp(Equipment)?.comps.filter((c): c is Item => c instanceof Item) ?? []
    const item = [...bag, ...worn].find((i) => i.uid === itemKey || i.id === itemKey)
    if (!item) throw new ToolError('Item not found.')
    if (!item.usable()) throw new ToolError(`${actionTitle(item)} cannot be used.`)
    return {
      action: item,
      reach: 0,
      cost: String(item.params.action || 'action') as CombatCost,
      harmful: actionHasGroup(item, HARM),
      run: (useCtx) => item.use(useCtx)
    }
  })
}
