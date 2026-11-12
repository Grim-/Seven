import type { ClockState } from './core/clock'
import type { EntityRecord } from './core/GameEntity'
import { cleanStand, type JourneyEntry, type Standing } from '../maps'
import type { WorldPost } from '../world'

export interface SaveCharacter {
  game: EntityRecord | null
  where: string
}

export interface SaveCreature extends EntityRecord {
  faction: string
}

export type SaveRecord = Record<string, unknown> | null

export interface GameSave {
  id: string
  name: string
  world: string
  createdAt: number
  updatedAt: number
  clockId: string
  clock: ClockState
  creatures: SaveCreature[]
  flags: Record<string, string | number | boolean>
  used: string[]
  characters: Record<string, SaveCharacter>
  stand: Record<string, Record<string, Standing>>
  records: Record<string, Record<string, SaveRecord>>
  journeys: Record<string, JourneyEntry[]>
  board: WorldPost[]
}

export interface SaveMeta {
  id: string
  name: string
  world: string
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
  return { time: Math.max(0, num(c.time, 0)), ticks: Math.max(0, Math.floor(num(c.ticks, 0))), speed: num(c.speed, 1) > 0 ? num(c.speed, 1) : 1, paused: c.paused === true, carry: Math.max(0, num(c.carry, 0)) }
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

export function cleanSave(raw: unknown, id: string): GameSave {
  const v = obj(raw)
  const flags: Record<string, string | number | boolean> = {}
  for (const [k, f] of Object.entries(obj(v.flags))) if (typeof f === 'string' || typeof f === 'number' || typeof f === 'boolean') flags[k] = f
  return {
    id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : id,
    world: str(v.world),
    createdAt: num(v.createdAt, 0),
    updatedAt: num(v.updatedAt, 0),
    clockId: str(v.clockId),
    clock: cleanClockState(v.clock),
    creatures: Array.isArray(v.creatures) ? v.creatures.filter(isRecord).map((c) => ({ ...c, faction: str(obj(c).faction) })) : [],
    flags,
    used: Array.isArray(v.used) ? v.used.filter((u): u is string => typeof u === 'string') : [],
    characters: cleanCharacters(v.characters),
    stand: Object.fromEntries(Object.entries(obj(v.stand)).map(([map, s]) => [map, cleanStand(s)])),
    records: cleanRecords(v.records),
    journeys: cleanJourneys(v.journeys),
    board: cleanBoard(v.board)
  }
}

export function saveMeta(save: GameSave): SaveMeta {
  return { id: save.id, name: save.name, world: save.world, updatedAt: save.updatedAt, time: save.clock.time, characters: Object.keys(save.characters) }
}
