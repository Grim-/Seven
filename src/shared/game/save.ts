import type { ClockState } from './core/clock'
import type { EntityRecord } from './core/GameEntity'
import { cleanStand, type CreatureDisposition, type JourneyEntry, type Standing } from '../maps'
import type { WorldPost } from '../world'
import { cleanBattleRecord, type BattleRecord } from './state/battle'
import { cleanWorldEventRuntime, type WorldEventRuntime } from './worldEvents'

export interface SaveCharacter {
  game: EntityRecord | null
  where: string
}

export interface SaveCreature extends EntityRecord {
  faction: string
  disposition?: CreatureDisposition
}

export type SaveRecord = Record<string, unknown> | null

export interface SaveLoadoutOverride {
  classId?: string | null
  abilities?: string[]
  items?: string[]
  buffs?: string[]
}

export interface SaveCreateOptions {
  player?: string | null
  companions?: string[]
  startingMap?: string | null
  startingPlace?: string | null
  startingTime?: number
  premise?: string
  incitingIncident?: string
  tone?: string
  openingActionIds?: string[]
  loadout?: Record<string, SaveLoadoutOverride>
}

export interface GameSave {
  id: string
  name: string
  world: string
  almanacId?: string
  createdAt: number
  updatedAt: number
  clockId: string
  clock: ClockState
  creatures: SaveCreature[]
  flags: Record<string, string | number | boolean>
  used: string[]
  /** Sheet IDs belonging to the player's actual party (player + recruited companions). NPCs in `characters` are NOT in `party`. */
  party?: string[]
  characters: Record<string, SaveCharacter>
  stand: Record<string, Record<string, Standing>>
  records: Record<string, Record<string, SaveRecord>>
  journeys: Record<string, JourneyEntry[]>
  board: WorldPost[]
  placed: Record<string, EntityRecord>
  thingFlags: Record<string, Record<string, string | number | boolean>>
  longRestAt?: number
  battle?: BattleRecord | null
  eventStates?: Record<string, WorldEventRuntime>
}

export interface SaveMeta {
  id: string
  name: string
  world: string
  almanacId?: string
  updatedAt: number
  time: number
  characters: string[]
}

export interface WorldSaves {
  current: string | null
  saves: SaveMeta[]
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function cleanClockState(raw: unknown): ClockState {
  const c = obj(raw)
  return { time: Math.max(0, num(c.time, 0)) }
}

const isRecord = (c: unknown): c is EntityRecord => Boolean(c) && typeof c === 'object' && typeof (c as EntityRecord).uid === 'string' && Array.isArray((c as EntityRecord).comps)

function cleanCharacters(raw: unknown): Record<string, SaveCharacter> {
  return Object.fromEntries(Object.entries(obj(raw)).map(([sheet, v]) => [sheet, { game: isRecord(obj(v).game) ? (obj(v).game as EntityRecord) : null, where: str(obj(v).where) }]))
}

function cleanRecords(raw: unknown): Record<string, Record<string, SaveRecord>> {
  return Object.fromEntries(Object.entries(obj(raw)).map(([type, list]) => [type, Object.fromEntries(Object.entries(obj(list)).map(([key, v]) => [key, v === null ? null : obj(v)]))]))
}

function cleanJourneys(raw: unknown): Record<string, JourneyEntry[]> {
  return Object.fromEntries(Object.entries(obj(raw)).map(([sheet, list]) => [sheet, (Array.isArray(list) ? list : []).map(obj).filter((e) => typeof e.text === 'string').map((e) => ({ at: str(e.at), kind: e.kind as JourneyEntry['kind'], text: str(e.text) }))]))
}

function cleanBoard(raw: unknown): WorldPost[] {
  return (Array.isArray(raw) ? raw : []).map(obj).filter((p) => typeof p.message === 'string').map((p) => ({ at: str(p.at), author: str(p.author), to: str(p.to) || 'ALL', message: str(p.message), ...(p.edited === true ? { edited: true } : {}) }))
}

function cleanFlags(raw: unknown): Record<string, string | number | boolean> {
  const flags: Record<string, string | number | boolean> = {}
  for (const [k, f] of Object.entries(obj(raw))) if (typeof f === 'string' || typeof f === 'number' || typeof f === 'boolean') flags[k] = f
  return flags
}

export function cleanSave(raw: unknown, id: string): GameSave {
  const v = obj(raw)
  const flags = cleanFlags(v.flags)
  return {
    id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : id,
    world: str(v.world),
    ...(str(v.almanacId) ? { almanacId: str(v.almanacId) } : {}),
    createdAt: num(v.createdAt, 0),
    updatedAt: num(v.updatedAt, 0),
    clockId: str(v.clockId),
    clock: cleanClockState(v.clock),
    ...(typeof v.longRestAt === 'number' ? { longRestAt: v.longRestAt } : {}),
    ...(cleanBattleRecord(v.battle) ? { battle: cleanBattleRecord(v.battle) } : {}),
    ...(v.eventStates && typeof v.eventStates === 'object' && !Array.isArray(v.eventStates)
      ? {
          eventStates: Object.fromEntries(
            Object.entries(v.eventStates as Record<string, unknown>)
              .map(([k, val]) => [k, cleanWorldEventRuntime(val)] as const)
              .filter((e): e is [string, WorldEventRuntime] => Boolean(e[1]))
          )
        }
      : {}),
    creatures: Array.isArray(v.creatures)
      ? v.creatures.filter(isRecord).map((c) => {
          const disp = str(obj(c).disposition)
          return {
            ...c,
            faction: str(obj(c).faction),
            ...(disp === 'hostile' || disp === 'neutral' || disp === 'friendly' ? { disposition: disp as CreatureDisposition } : {})
          }
        })
      : [],
    flags,
    used: Array.isArray(v.used) ? v.used.filter((u): u is string => typeof u === 'string') : [],
    ...(Array.isArray(v.party) ? { party: v.party.filter((p): p is string => typeof p === 'string' && Boolean(p.trim())) } : {}),
    characters: cleanCharacters(v.characters),
    stand: Object.fromEntries(Object.entries(obj(v.stand)).map(([map, s]) => [map, cleanStand(s)])),
    records: cleanRecords(v.records),
    journeys: cleanJourneys(v.journeys),
    board: cleanBoard(v.board),
    thingFlags: Object.fromEntries(Object.entries(obj(v.thingFlags)).map(([key, f]) => [key, cleanFlags(f)])),
    placed: Object.fromEntries(Object.entries(obj(v.placed)).filter((e): e is [string, EntityRecord] => isRecord(e[1])))
  }
}

export function saveMeta(save: GameSave): SaveMeta {
  return {
    id: save.id,
    name: save.name,
    world: save.world,
    ...(save.almanacId ? { almanacId: save.almanacId } : {}),
    updatedAt: save.updatedAt,
    time: save.clock.time,
    characters: Object.keys(save.characters)
  }
}
