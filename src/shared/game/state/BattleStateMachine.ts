import type { Point } from '../../shapes'

export interface CombatAttack {
  id: string
  name: string
  range: number
  damage: string
}

export interface Combatant {
  id: string
  name: string
  sheet?: string
  image?: string | null
  isPlayer: boolean
  isAlly?: boolean
  initiative: number
  hp: { cur: number; max: number }
  ac: number
  speedMax: number
  at?: Point
  attacks: CombatAttack[]
  faction?: string | null
}

export interface ActionEconomy {
  movementRemaining: number
  movementMax: number
  actionUsed: boolean
  bonusActionUsed: boolean
  reactionUsed: boolean
  isDodging: boolean
}

export interface CombatLogEntry {
  id: string
  round: number
  actorName: string
  text: string
  type: 'attack' | 'damage' | 'heal' | 'move' | 'turn' | 'parley' | 'info' | 'death'
  timestamp: number
}

export interface BattleState {
  id: string
  round: number
  queue: Combatant[]
  activeTurnIndex: number
  economy: ActionEconomy
  status: 'active' | 'victory' | 'defeat' | 'fled'
  logs: CombatLogEntry[]
}
