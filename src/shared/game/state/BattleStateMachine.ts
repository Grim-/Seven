import type { Point } from '../../shapes'
import type { PlaceVisitor } from '../../maps'
import { rollDie } from '../../storyRolls'

export interface CombatAttack {
  name: string
  bonus: number
  damage: string
}

export interface Combatant {
  id: string
  name: string
  sheet?: string
  image?: string | null
  isPlayer: boolean
  dexMod?: number
  initiative: number
  hp: { cur: number; max: number }
  ac?: number
  speedMax: number
  at?: Point
  attacks?: CombatAttack[]
  faction?: string | null
}

export interface ActionEconomy {
  movementRemaining: number
  actionUsed: boolean
  bonusActionUsed: boolean
  reactionUsed: boolean
  isDodging?: boolean
}

export interface CombatLogEntry {
  id: string
  round: number
  actorName: string
  text: string
  type: 'attack' | 'damage' | 'heal' | 'move' | 'turn' | 'parley' | 'info'
  timestamp: number
}

export interface BattleState {
  round: number
  queue: Combatant[]
  activeTurnIndex: number
  economy: ActionEconomy
  status: 'active' | 'victory' | 'defeat' | 'fled'
  logs: CombatLogEntry[]
}

export function rollInitiative(combatants: Omit<Combatant, 'initiative'>[]): Combatant[] {
  const rolled = combatants.map((c) => {
    const roll = rollDie(20)
    const mod = c.dexMod ?? 0
    return {
      ...c,
      initiative: roll + mod
    }
  })

  // Sort descending by initiative; player breaks ties
  return rolled.sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    if (a.isPlayer && !b.isPlayer) return -1
    if (!a.isPlayer && b.isPlayer) return 1
    return 0
  })
}

export function rollDamage(expr: string): number {
  const match = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/i.exec(expr.trim())
  if (!match) {
    const num = parseInt(expr, 10)
    return Number.isFinite(num) && num > 0 ? num : rollDie(6)
  }
  const count = parseInt(match[1], 10) || 1
  const sides = parseInt(match[2], 10) || 6
  const sign = match[3] === '-' ? -1 : 1
  const mod = match[4] ? parseInt(match[4], 10) * sign : 0
  let total = 0
  for (let i = 0; i < count; i++) {
    total += rollDie(sides)
  }
  return Math.max(1, total + mod)
}

export function createInitialBattleState(
  combatants: Omit<Combatant, 'initiative'>[]
): BattleState {
  const queue = rollInitiative(combatants)
  const first = queue[0]

  const initLogs: CombatLogEntry[] = [
    {
      id: crypto.randomUUID(),
      round: 1,
      actorName: 'Combat Initiated',
      text: `Battle begun! Initiative order: ${queue.map((c) => `${c.name} (${c.initiative})`).join(', ')}.`,
      type: 'info',
      timestamp: Date.now()
    }
  ]

  return {
    round: 1,
    queue,
    activeTurnIndex: 0,
    economy: {
      movementRemaining: first?.speedMax ?? 30,
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      isDodging: false
    },
    status: 'active',
    logs: initLogs
  }
}

export function advanceBattleTurn(state: BattleState): BattleState {
  if (state.queue.length === 0) return state

  // Skip defeated combatants
  let nextIndex = (state.activeTurnIndex + 1) % state.queue.length
  let attempts = 0
  while (state.queue[nextIndex].hp.cur <= 0 && attempts < state.queue.length) {
    nextIndex = (nextIndex + 1) % state.queue.length
    attempts++
  }

  const newRound = nextIndex <= state.activeTurnIndex ? state.round + 1 : state.round
  const nextActor = state.queue[nextIndex]

  const turnLog: CombatLogEntry = {
    id: crypto.randomUUID(),
    round: newRound,
    actorName: nextActor.name,
    text: `Round ${newRound}: Turn passes to ${nextActor.name}.`,
    type: 'turn',
    timestamp: Date.now()
  }

  return {
    ...state,
    round: newRound,
    activeTurnIndex: nextIndex,
    economy: {
      movementRemaining: nextActor?.speedMax ?? 30,
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      isDodging: false
    },
    logs: [...state.logs.slice(-30), turnLog]
  }
}

export function spendMovement(state: BattleState, feet: number): BattleState {
  const remaining = Math.max(0, state.economy.movementRemaining - feet)
  return {
    ...state,
    economy: {
      ...state.economy,
      movementRemaining: remaining
    }
  }
}

export function spendAction(state: BattleState): BattleState {
  return {
    ...state,
    economy: {
      ...state.economy,
      actionUsed: true
    }
  }
}

export function spendBonusAction(state: BattleState): BattleState {
  return {
    ...state,
    economy: {
      ...state.economy,
      bonusActionUsed: true
    }
  }
}

export function applyDamage(
  state: BattleState,
  targetId: string,
  amount: number,
  sourceName?: string
): BattleState {
  let isVictory = false
  let isDefeat = false

  const nextQueue = state.queue.map((c) => {
    if (c.id !== targetId) return c
    const nextCur = Math.max(0, c.hp.cur - amount)
    return { ...c, hp: { ...c.hp, cur: nextCur } }
  })

  // Check victory / defeat conditions
  const livingEnemies = nextQueue.filter((c) => !c.isPlayer && c.hp.cur > 0)
  const livingPlayers = nextQueue.filter((c) => c.isPlayer && c.hp.cur > 0)

  if (livingEnemies.length === 0) isVictory = true
  else if (livingPlayers.length === 0) isDefeat = true

  const target = state.queue.find((c) => c.id === targetId)
  const dmgLog: CombatLogEntry = {
    id: crypto.randomUUID(),
    round: state.round,
    actorName: sourceName ?? 'Combat',
    text: `${target?.name ?? 'Target'} took ${amount} damage! (${Math.max(0, (target?.hp.cur ?? 0) - amount)}/${target?.hp.max} HP remaining)${amount >= (target?.hp.cur ?? 0) ? ' — DEFEATED!' : ''}`,
    type: 'damage',
    timestamp: Date.now()
  }

  const status = isVictory ? 'victory' : isDefeat ? 'defeat' : state.status

  return {
    ...state,
    queue: nextQueue,
    status,
    logs: [...state.logs.slice(-30), dmgLog]
  }
}

export function executeAttack(
  state: BattleState,
  attackerId: string,
  targetId: string,
  attackName?: string
): {
  nextState: BattleState
  hit: boolean
  isCrit: boolean
  isCritFail: boolean
  d20: number
  bonus: number
  roll: number
  targetAc: number
  damage: number
} {
  const attacker = state.queue.find((c) => c.id === attackerId)
  const target = state.queue.find((c) => c.id === targetId)

  if (!attacker || !target) {
    return {
      nextState: state,
      hit: false,
      isCrit: false,
      isCritFail: false,
      d20: 0,
      bonus: 0,
      roll: 0,
      targetAc: 10,
      damage: 0
    }
  }

  const chosenAttack = attacker.attacks?.find((a) => a.name === attackName) ?? attacker.attacks?.[0] ?? {
    name: 'Strike',
    bonus: 3,
    damage: '1d6 + 2'
  }

  const d20 = rollDie(20)
  const isCrit = d20 === 20
  const isCritFail = d20 === 1
  const totalAttack = d20 + chosenAttack.bonus
  const targetAc = target.ac ?? 10
  const hit = isCrit || (!isCritFail && totalAttack >= targetAc)

  let damage = 0
  if (hit) {
    damage = isCrit ? rollDamage(chosenAttack.damage) + rollDamage(chosenAttack.damage) : rollDamage(chosenAttack.damage)
  }

  const logText = isCrit
    ? `NATURAL 20! Critical Hit! ${attacker.name} strikes ${target.name} with ${chosenAttack.name} for ${damage} critical damage!`
    : hit
    ? `${attacker.name} rolled ${d20} + ${chosenAttack.bonus} = ${totalAttack} vs AC ${targetAc} -> HIT! Dealt ${damage} damage.`
    : `${attacker.name} rolled ${d20} + ${chosenAttack.bonus} = ${totalAttack} vs AC ${targetAc} -> MISS!`

  const attackLog: CombatLogEntry = {
    id: crypto.randomUUID(),
    round: state.round,
    actorName: attacker.name,
    text: logText,
    type: 'attack',
    timestamp: Date.now()
  }

  let stateWithAction = spendAction(state)
  stateWithAction = {
    ...stateWithAction,
    logs: [...stateWithAction.logs.slice(-30), attackLog]
  }

  const finalState = hit ? applyDamage(stateWithAction, targetId, damage, attacker.name) : stateWithAction

  return {
    nextState: finalState,
    hit,
    isCrit,
    isCritFail,
    d20,
    bonus: chosenAttack.bonus,
    roll: totalAttack,
    targetAc,
    damage
  }
}

export function combatantFromVisitor(
  visitor: PlaceVisitor,
  at?: Point,
  isPlayer = false,
  id = visitor.sheet
): Omit<Combatant, 'initiative'> {
  const dnd = visitor.dnd
  return {
    id,
    sheet: visitor.sheet || undefined,
    name: visitor.name,
    image: visitor.image,
    isPlayer,
    hp: dnd ? { cur: dnd.hp.cur, max: dnd.hp.max } : { cur: 12, max: 12 },
    ac: dnd?.ac ?? (isPlayer ? 14 : 11),
    speedMax: 30,
    at,
    attacks: [
      {
        name: isPlayer ? 'Strike' : 'Attack',
        bonus: 3,
        damage: isPlayer ? '1d8 + 2' : '1d6 + 2'
      }
    ],
    faction: visitor.faction ?? (isPlayer ? 'player' : 'hostile')
  }
}

