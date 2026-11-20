import type { EffectResult } from '@shared/effects'
import { actionHasGroup, AddMovement, Health, usableAbilities, type Ability } from '@shared/game/components'
import type { GameEntity } from '@shared/game/core'
import { HARM } from '@shared/game/effectGroups'
import { buildNavGrid, findPath, pointsDistanceFeet } from '@shared/game/nav'
import type { GameSave } from '@shared/game/save'
import type { Point } from '@shared/shapes'
import { maps } from '../maps/store'
import { noteFailure } from '../util/report'
import { consumeTurnCost, type CombatCost } from './battleGate'
import { advanceTurnInContext, withBattleWorld, type BattleWorldContext } from './battle'
import { saveInPlay } from './playLayer'

interface PlannedStep {
  ability: Ability
  cost: CombatCost
  targetId: string
  targetEntity: GameEntity
  standPoint: Point
  stepFeet: number
  score: number
}

function canAffordCost(battle: NonNullable<BattleWorldContext['battle']>, cost: CombatCost): boolean {
  if (cost === 'action') return !battle.economy.actionUsed
  if (cost === 'bonus') return !battle.economy.bonusActionUsed
  return true
}

/**
 * Executes one engine-driven AI turn (`battle.stepAi`):
 * - Moves before acting so `OnMove` traps/traits resolve prior to attacks.
 * - Evaluates both `'action'` and `'bonus'` abilities using polymorphic `ActionPiece.score(ctx)`.
 * - Falls back to a real `AddMovement` ability (e.g. Dash) + shortest `NavGrid` advance when out of reach.
 * - Always advances the turn in `finally`.
 */
export function stepAiTurn(worldId: string): GameSave {
  withBattleWorld(worldId, (ctx) => {
    const initialBattle = ctx.battle
    if (!initialBattle || initialBattle.status !== 'active') return

    try {
      const active = initialBattle.queue[initialBattle.activeIndex]
      if (!active || active.side === 'party') return

      const ai = ctx.entity(active.id)
      if (!ai || ai.comp(Health)?.isDead) return

      const mapData = maps.get(initialBattle.map)
      if (!mapData) return
      const grid = buildNavGrid(mapData, ctx.save.thingFlags)
      const standMap = ctx.save.stand[initialBattle.map] ?? {}
      const initialPos = standMap[active.id]?.at
      if (!initialPos) return

      const tileFeet = ctx.timeDef.tileFeet
      let currentAt: Point = initialPos

      const stepTo = (dest: Point, feet: number, label: string): boolean => {
        if (feet <= 0) return true
        const b = ctx.battle
        if (!b || b.status !== 'active') return false
        currentAt = dest
        ctx.moveStand(b.map, active.id, dest)
        ctx.setBattle({
          ...b,
          economy: { ...b.economy, movementRemaining: Math.max(0, b.economy.movementRemaining - feet) }
        })
        ctx.addLog(active.id, ai.name, 'move', `${ai.name} ${label} ${feet} ft.`)
        ai.emit('OnMove', { distance: feet })
        return !ai.comp(Health)?.isDead
      }

      const livingOpponents = () =>
        (ctx.battle?.queue ?? []).filter((p) => p.side !== active.side && !ctx.entity(p.id)?.comp(Health)?.isDead)
      const livingAllies = () =>
        (ctx.battle?.queue ?? []).filter((p) => p.side === active.side && !ctx.entity(p.id)?.comp(Health)?.isDead)

      const planBest = (allowMove: boolean): PlannedStep | null => {
        const b = ctx.battle
        if (!b || b.status !== 'active') return null
        const opponents = livingOpponents()
        const allies = livingAllies()
        if (!opponents.length) return null

        const maxSteps = allowMove ? Math.floor(b.economy.movementRemaining / tileFeet) : 0
        let best: PlannedStep | null = null

        const consider = (ability: Ability, cost: CombatCost, targetId: string, targetEnt: GameEntity, targetAt: Point) => {
          const reach = ability.reach()
          const currentDist = pointsDistanceFeet(currentAt, targetAt, mapData.tile.w, tileFeet)
          const losDirect = reach <= tileFeet || grid.clear(currentAt, targetAt)
          const checkCtx = { user: ai, target: targetEnt, at: targetAt, distance: currentDist }

          if (currentDist <= reach && losDirect && ability.canUse(checkCtx) === true) {
            const s = ability.score(checkCtx)
            if (s > 0 && (!best || s > best.score)) {
              best = { ability, cost, targetId, targetEntity: targetEnt, standPoint: currentAt, stepFeet: 0, score: s }
            }
            return
          }

          if (maxSteps <= 0) return
          const path = findPath(grid, currentAt, targetAt)
          if (!path || path.length < 2) return

          const stopCap = reach <= tileFeet ? path.length - 1 : path.length
          const limit = Math.min(maxSteps + 1, stopCap)
          for (let idx = limit - 1; idx >= 1; idx--) {
            const cand = path[idx]
            const dist = pointsDistanceFeet(cand, targetAt, mapData.tile.w, tileFeet)
            if (dist > reach) continue
            if (reach > tileFeet && !grid.clear(cand, targetAt)) continue
            const moveCtx = { user: ai, target: targetEnt, at: targetAt, distance: dist }
            if (ability.canUse(moveCtx) !== true) continue
            const s = ability.score(moveCtx)
            const feet = idx * tileFeet
            if (s > 0 && (!best || s > best.score || (s === best.score && feet < best.stepFeet))) {
              best = { ability, cost, targetId, targetEntity: targetEnt, standPoint: cand, stepFeet: feet, score: s }
              break
            }
          }
        }

        for (const ability of usableAbilities(ai)) {
          const cost = String(ability.params.action || 'action') as CombatCost
          if (!canAffordCost(b, cost)) continue
          const isHarm = actionHasGroup(ability, HARM)
          const candidates = isHarm ? opponents : allies
          for (const p of candidates) {
            const ent = ctx.entity(p.id)
            const at = p.id === active.id ? currentAt : standMap[p.id]?.at
            if (!ent || !at) continue
            consider(ability, cost, p.id, ent, at)
          }
        }
        return best
      }

      const executePlan = (chosen: PlannedStep): boolean => {
        if (chosen.stepFeet > 0) {
          if (!stepTo(chosen.standPoint, chosen.stepFeet, 'moves')) return false
        }
        const b = ctx.battle
        if (!b || b.status !== 'active' || ai.comp(Health)?.isDead) return false
        const targetAt = chosen.targetId === active.id ? currentAt : (standMap[chosen.targetId]?.at ?? currentAt)
        const finalDist = Math.round(pointsDistanceFeet(currentAt, targetAt, mapData.tile.w, tileFeet))
        let grantedFeet = 0
        const collected: EffectResult[] = []
        const done = chosen.ability.use({
          user: ai,
          target: chosen.targetEntity,
          at: targetAt,
          distance: finalDist,
          collect: (r) => collected.push(r),
          grantMovement: (feet) => {
            grantedFeet += feet
          }
        })
        if (done !== true) return false

        let next = consumeTurnCost(b, chosen.cost)
        if (grantedFeet > 0) {
          next = { ...next, economy: { ...next.economy, movementRemaining: next.economy.movementRemaining + grantedFeet } }
        }
        ctx.setBattle(next)
        const line = collected.map((c) => c.line).filter(Boolean).join(' ')
        ctx.addLog(
          active.id,
          ai.name,
          actionHasGroup(chosen.ability, HARM) ? 'attack' : 'info',
          line || `${ai.name} uses ${String(chosen.ability.params.label || chosen.ability.id)} on ${chosen.targetEntity.name}.`
        )
        return true
      }

      const advanceTowardNearestOpponent = (): boolean => {
        const b = ctx.battle
        if (!b || b.status !== 'active') return false
        const maxSteps = Math.floor(b.economy.movementRemaining / tileFeet)
        if (maxSteps <= 0) return false
        let shortestPath: Point[] | null = null
        for (const opp of livingOpponents()) {
          const oppAt = standMap[opp.id]?.at
          if (!oppAt) continue
          const p = findPath(grid, currentAt, oppAt)
          if (p && p.length > 2 && (!shortestPath || p.length < shortestPath.length)) shortestPath = p
        }
        if (!shortestPath) return false
        const steps = Math.min(maxSteps, shortestPath.length - 2)
        if (steps <= 0) return false
        return stepTo(shortestPath[steps], steps * tileFeet, 'advances')
      }

      // 1. Primary action / bonus action loop (up to 2 distinct action budgets per turn)
      let acted = false
      for (let pass = 0; pass < 2; pass++) {
        const chosen = planBest(true)
        if (!chosen) break
        if (!executePlan(chosen)) break
        acted = true
        if (ai.comp(Health)?.isDead) return
      }

      // 2. If nothing could reach, try a real movement-granting ability (e.g. Dash) and close distance
      if (!acted && livingOpponents().length > 0) {
        const b = ctx.battle
        if (b && b.status === 'active') {
          const dashAbility = usableAbilities(ai).find((a) => {
            if (!a.comps.some((c) => c instanceof AddMovement)) return false
            const cost = String(a.params.action || 'action') as CombatCost
            return canAffordCost(b, cost) && a.canUse({ user: ai, target: ai, at: currentAt, distance: 0 }) === true
          })
          if (dashAbility) {
            const cost = String(dashAbility.params.action || 'action') as CombatCost
            let grantedFeet = 0
            const collected: EffectResult[] = []
            if (
              dashAbility.use({
                user: ai,
                target: ai,
                at: currentAt,
                distance: 0,
                collect: (r) => collected.push(r),
                grantMovement: (feet) => {
                  grantedFeet += feet
                }
              }) === true
            ) {
              let next = consumeTurnCost(b, cost)
              if (grantedFeet > 0) {
                next = { ...next, economy: { ...next.economy, movementRemaining: next.economy.movementRemaining + grantedFeet } }
              }
              ctx.setBattle(next)
              const line = collected.map((c) => c.line).filter(Boolean).join(' ')
              ctx.addLog(active.id, ai.name, 'move', line || `${ai.name} uses ${String(dashAbility.params.label || dashAbility.id)}.`)
            }
          }
          advanceTowardNearestOpponent()

          // If Dash used a bonus action (or free), still take an available action if now in range
          if (!ai.comp(Health)?.isDead) {
            const followUp = planBest(false)
            if (followUp) executePlan(followUp)
          }
        }
      }
    } catch (err) {
      noteFailure(err, 'game', 'AI combat turn failed safely')
    } finally {
      advanceTurnInContext(ctx)
    }
  })

  return saveInPlay(worldId, false)!
}
