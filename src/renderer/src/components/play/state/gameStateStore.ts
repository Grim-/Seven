import { create } from 'zustand'
import type { Point } from '@shared/shapes'
import {
  type GameStateContext,
  transitionGameState
} from '@shared/game/state/GameStateMachine'
import {
  type BattleState,
  type Combatant,
  createInitialBattleState,
  advanceBattleTurn,
  spendMovement as spendMove,
  spendAction as spendAct,
  spendBonusAction as spendBonus,
  executeAttack
} from '@shared/game/state/BattleStateMachine'
import { useDialogue } from '../dialogue/dialogueStore'

export interface LastCombatRoll {
  attackerName: string
  targetName: string
  attackName: string
  d20: number
  bonus: number
  total: number
  targetAc: number
  hit: boolean
  isCrit: boolean
  damage: number
  timestamp: number
}

interface GameEngineStore {
  context: GameStateContext
  battle: BattleState | null
  lastRoll: LastCombatRoll | null
  viewMode: 'map' | 'arena'

  // Exploration & State transitions
  startInteraction: (targetId: string, targetName?: string) => void
  endInteraction: () => void
  openModal: (modalId: string) => void
  closeModal: () => void

  // Combat State Machine
  startBattle: (combatants: Omit<Combatant, 'initiative'>[]) => void
  endTurn: () => void
  spendMovement: (feet: number) => void
  useAction: () => void
  useBonusAction: () => void
  dodgeAction: () => void
  dashAction: () => void
  moveActor: (at: Point, distanceFeet: number) => void
  attackTarget: (targetId: string, attackName?: string) => { hit: boolean; damage: number } | null
  executeAiTurn: () => void
  parleyWithEnemy: (enemyId: string, recruited?: boolean) => void
  clearLastRoll: () => void
  setViewMode: (mode: 'map' | 'arena') => void
  toggleViewMode: () => void
  endBattle: (outcome: 'victory' | 'defeat' | 'flee') => void
}

export const useGameState = create<GameEngineStore>((set, get) => ({
  context: {
    mode: 'EXPLORATION',
    activeEntityId: null,
    activeTargetId: null,
    activeModalId: null,
    paused: false
  },
  battle: null,
  lastRoll: null,
  viewMode: 'map',

  startInteraction: (targetId, targetName) => {
    set((s) => ({
      context: transitionGameState(s.context, {
        type: 'START_INTERACTION',
        targetId,
        targetName
      })
    }))
  },

  endInteraction: () => {
    set((s) => ({
      context: transitionGameState(s.context, { type: 'END_INTERACTION' })
    }))
  },

  openModal: (modalId) => {
    set((s) => ({
      context: transitionGameState(s.context, { type: 'OPEN_MODAL', modalId })
    }))
  },

  closeModal: () => {
    set((s) => ({
      context: transitionGameState(s.context, { type: 'CLOSE_MODAL' })
    }))
  },

  startBattle: (combatants) => {
    const battle = createInitialBattleState(combatants)
    set((s) => ({
      battle,
      lastRoll: null,
      context: transitionGameState(s.context, { type: 'START_BATTLE' })
    }))
    useDialogue.getState().addNarration(
      'dm',
      'WORLD NARRATOR',
      `Battle commenced! Initiative order established with ${combatants.length} combatants.`
    )
  },

  endTurn: () => {
    const current = get().battle
    if (!current) return
    const next = advanceBattleTurn(current)
    set({ battle: next })
  },

  spendMovement: (feet) => {
    const current = get().battle
    if (!current) return
    set({ battle: spendMove(current, feet) })
  },

  useAction: () => {
    const current = get().battle
    if (!current) return
    set({ battle: spendAct(current) })
  },

  useBonusAction: () => {
    const current = get().battle
    if (!current) return
    set({ battle: spendBonus(current) })
  },

  dodgeAction: () => {
    const current = get().battle
    if (!current) return
    const activeActor = current.queue[current.activeTurnIndex]
    const stateWithAct = spendAct(current)
    set({
      battle: {
        ...stateWithAct,
        economy: { ...stateWithAct.economy, isDodging: true },
        logs: [
          ...stateWithAct.logs.slice(-30),
          {
            id: crypto.randomUUID(),
            round: current.round,
            actorName: activeActor.name,
            text: `${activeActor.name} takes the Dodge action! Attacks against them have disadvantage.`,
            type: 'info',
            timestamp: Date.now()
          }
        ]
      }
    })
    useDialogue.getState().addNarration(
      'dm',
      'WORLD NARRATOR',
      `${activeActor.name} adopts a defensive dodge posture, increasing evasiveness.`
    )
  },

  dashAction: () => {
    const current = get().battle
    if (!current) return
    const activeActor = current.queue[current.activeTurnIndex]
    const stateWithAct = spendAct(current)
    set({
      battle: {
        ...stateWithAct,
        economy: {
          ...stateWithAct.economy,
          movementRemaining: stateWithAct.economy.movementRemaining + activeActor.speedMax
        },
        logs: [
          ...stateWithAct.logs.slice(-30),
          {
            id: crypto.randomUUID(),
            round: current.round,
            actorName: activeActor.name,
            text: `${activeActor.name} dashes! Movement increased by +${activeActor.speedMax} ft.`,
            type: 'move',
            timestamp: Date.now()
          }
        ]
      }
    })
    useDialogue.getState().addNarration(
      'dm',
      'WORLD NARRATOR',
      `${activeActor.name} dashes, extending tactical movement range by +${activeActor.speedMax} FT.`
    )
  },

  moveActor: (at, distanceFeet) => {
    const current = get().battle
    if (!current) return
    const activeActor = current.queue[current.activeTurnIndex]
    const nextQueue = current.queue.map((c) => (c.id === activeActor.id ? { ...c, at } : c))
    const withMove = spendMove({ ...current, queue: nextQueue }, distanceFeet)
    set({ battle: withMove })
  },

  attackTarget: (targetId, attackName) => {
    const current = get().battle
    if (!current || current.economy.actionUsed) return null
    const activeActor = current.queue[current.activeTurnIndex]
    const target = current.queue.find((c) => c.id === targetId)
    if (!activeActor || !target) return null

    const chosenAttack = activeActor.attacks?.find((a) => a.name === attackName) ?? activeActor.attacks?.[0]
    const { nextState, hit, isCrit, d20, bonus, roll, targetAc, damage } = executeAttack(
      current,
      activeActor.id,
      targetId,
      attackName
    )

    set({
      battle: nextState,
      lastRoll: {
        attackerName: activeActor.name,
        targetName: target.name,
        attackName: chosenAttack?.name ?? 'Strike',
        d20,
        bonus,
        total: roll,
        targetAc,
        hit,
        isCrit,
        damage,
        timestamp: Date.now()
      }
    })

    if (isCrit) {
      useDialogue.getState().say(activeActor.sheet ?? activeActor.id, activeActor.name, 'Critical strike landed!')
      useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${activeActor.name} lands a critical strike on ${target.name} for ${damage} damage!`)
    } else if (hit) {
      useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${activeActor.name} strikes ${target.name} dealing ${damage} damage.`)
    } else {
      useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${activeActor.name}'s attack misses ${target.name} (AC ${targetAc}).`)
    }

    return { hit, damage }
  },

  executeAiTurn: () => {
    const current = get().battle
    if (!current || current.status !== 'active') return
    const activeActor = current.queue[current.activeTurnIndex]
    if (!activeActor || activeActor.isPlayer) return

    // Find living player target
    const target = current.queue.find((c) => c.isPlayer && c.hp.cur > 0)
    if (target) {
      const chosenAttack = activeActor.attacks?.[0]
      const { nextState, hit, isCrit, d20, bonus, roll, targetAc, damage } = executeAttack(
        current,
        activeActor.id,
        target.id,
        chosenAttack?.name
      )
      const afterTurn = advanceBattleTurn(nextState)
      set({
        battle: afterTurn,
        lastRoll: {
          attackerName: activeActor.name,
          targetName: target.name,
          attackName: chosenAttack?.name ?? 'Strike',
          d20,
          bonus,
          total: roll,
          targetAc,
          hit,
          isCrit,
          damage,
          timestamp: Date.now()
        }
      })

      if (isCrit) {
        useDialogue.getState().say(activeActor.sheet ?? activeActor.id, activeActor.name, `${activeActor.name} lands a critical hit!`)
        useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${activeActor.name} scores a critical hit on ${target.name} for ${damage} damage!`)
      } else if (hit) {
        useDialogue.getState().say(activeActor.sheet ?? activeActor.id, activeActor.name, `${activeActor.name} attacks!`)
        useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${activeActor.name} hits ${target.name} dealing ${damage} damage.`)
      } else {
        useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${activeActor.name} attacks ${target.name} but misses.`)
      }
    } else {
      const afterTurn = advanceBattleTurn(current)
      set({ battle: afterTurn })
    }
  },

  parleyWithEnemy: (enemyId, recruited = false) => {
    const current = get().battle
    if (!current) return
    const enemy = current.queue.find((c) => c.id === enemyId)
    if (!enemy) return

    if (recruited) {
      useDialogue.getState().say(enemy.sheet ?? enemy.id, enemy.name, 'We have an accord. I stand down.')
      useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${enemy.name} yields to negotiation and allies with your party.`)

      // Enemy joins player party
      const nextQueue = current.queue.map((c) =>
        c.id === enemyId ? { ...c, isPlayer: true, faction: 'player' } : c
      )
      const livingEnemies = nextQueue.filter((c) => !c.isPlayer && c.hp.cur > 0)
      const nextStatus = livingEnemies.length === 0 ? 'victory' : current.status
      set({
        battle: {
          ...current,
          queue: nextQueue,
          status: nextStatus,
          logs: [
            ...current.logs.slice(-30),
            {
              id: crypto.randomUUID(),
              round: current.round,
              actorName: 'Diplomacy',
              text: `${enemy.name} was persuaded to join your party! Faction switched to Player.`,
              type: 'parley',
              timestamp: Date.now()
            }
          ]
        }
      })
    } else {
      useDialogue.getState().say(enemy.sheet ?? enemy.id, enemy.name, 'I accept this truce. We shall cross paths again.')
      useDialogue.getState().addNarration('dm', 'WORLD NARRATOR', `${enemy.name} agrees to a ceasefire and leaves the encounter field.`)

      // Truce / stand down
      const nextQueue = current.queue.filter((c) => c.id !== enemyId)
      const livingEnemies = nextQueue.filter((c) => !c.isPlayer && c.hp.cur > 0)
      const nextStatus = livingEnemies.length === 0 ? 'victory' : current.status
      set({
        battle: {
          ...current,
          queue: nextQueue,
          status: nextStatus,
          logs: [
            ...current.logs.slice(-30),
            {
              id: crypto.randomUUID(),
              round: current.round,
              actorName: 'Diplomacy',
              text: `A truce was agreed with ${enemy.name}. They stand down and depart.`,
              type: 'parley',
              timestamp: Date.now()
            }
          ]
        }
      })
    }
  },

  clearLastRoll: () => set({ lastRoll: null }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'map' ? 'arena' : 'map' })),

  endBattle: (outcome) => {
    set((s) => ({
      battle: null,
      lastRoll: null,
      context: transitionGameState(s.context, { type: 'END_BATTLE', outcome })
    }))
  }
}))
