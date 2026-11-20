export type BattleSide = 'party' | 'ally' | 'hostile'
export type BattleParticipantKind = 'sheet' | 'creature'
export type BattleStatus = 'active' | 'victory' | 'defeat' | 'fled'
export type BattleLogType = 'attack' | 'damage' | 'heal' | 'move' | 'turn' | 'parley' | 'info' | 'death'

export interface BattleParticipant {
  id: string
  kind: BattleParticipantKind
  faction: string
  side: BattleSide
  initiative: number
}

export interface TurnEconomy {
  actionUsed: boolean
  bonusActionUsed: boolean
  reactionUsedBy: Record<string, boolean>
  movementRemaining: number
  movementMax: number
}

export interface BattleLogEntry {
  id: string
  round: number
  actorId: string
  actorName: string
  type: BattleLogType
  text: string
  timestamp: number
}

export interface BattleRecord {
  id: string
  map: string
  round: number
  activeIndex: number
  status: BattleStatus
  queue: BattleParticipant[]
  economy: TurnEconomy
  logs: BattleLogEntry[]
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

const SIDES = new Set<BattleSide>(['party', 'ally', 'hostile'])
const KINDS = new Set<BattleParticipantKind>(['sheet', 'creature'])
const STATUSES = new Set<BattleStatus>(['active', 'victory', 'defeat', 'fled'])
const LOG_TYPES = new Set<BattleLogType>(['attack', 'damage', 'heal', 'move', 'turn', 'parley', 'info', 'death'])

function cleanParticipant(raw: unknown): BattleParticipant | null {
  const v = obj(raw)
  const id = str(v.id)
  if (!id) return null
  return {
    id,
    kind: KINDS.has(v.kind as BattleParticipantKind) ? (v.kind as BattleParticipantKind) : 'creature',
    faction: str(v.faction),
    side: SIDES.has(v.side as BattleSide) ? (v.side as BattleSide) : 'hostile',
    initiative: num(v.initiative, 0)
  }
}

function cleanEconomy(raw: unknown): TurnEconomy {
  const v = obj(raw)
  const reactions: Record<string, boolean> = {}
  for (const [k, used] of Object.entries(obj(v.reactionUsedBy))) reactions[k] = used === true
  const max = Math.max(0, num(v.movementMax, 0))
  return {
    actionUsed: v.actionUsed === true,
    bonusActionUsed: v.bonusActionUsed === true,
    reactionUsedBy: reactions,
    movementRemaining: Math.max(0, num(v.movementRemaining, max)),
    movementMax: max
  }
}

function cleanLog(raw: unknown): BattleLogEntry | null {
  const v = obj(raw)
  const text = str(v.text)
  if (!text) return null
  return {
    id: str(v.id) || crypto.randomUUID(),
    round: Math.max(1, num(v.round, 1)),
    actorId: str(v.actorId),
    actorName: str(v.actorName),
    type: LOG_TYPES.has(v.type as BattleLogType) ? (v.type as BattleLogType) : 'info',
    text,
    timestamp: num(v.timestamp, 0)
  }
}

/** Validates and normalizes persisted battle state on a save file. */
export function cleanBattleRecord(raw: unknown): BattleRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = obj(raw)
  const id = str(v.id)
  const map = str(v.map)
  if (!id || !map) return null
  const queue = (Array.isArray(v.queue) ? v.queue : []).map(cleanParticipant).filter((p): p is BattleParticipant => p !== null)
  if (!queue.length) return null
  const activeIndex = Math.min(Math.max(0, Math.floor(num(v.activeIndex, 0))), queue.length - 1)
  return {
    id,
    map,
    round: Math.max(1, Math.floor(num(v.round, 1))),
    activeIndex,
    status: STATUSES.has(v.status as BattleStatus) ? (v.status as BattleStatus) : 'active',
    queue,
    economy: cleanEconomy(v.economy),
    logs: (Array.isArray(v.logs) ? v.logs : []).map(cleanLog).filter((l): l is BattleLogEntry => l !== null).slice(-60)
  }
}
