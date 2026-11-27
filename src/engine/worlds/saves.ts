import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { cleanClockState, cleanSave, saveMeta, type GameSave, type SaveMeta, type WorldSaves } from '@shared/game/save'
import type { ClockState } from '@shared/game/core/clock'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'
import { WorldError } from './store'

const ROOT = path.join(dataRoot, 'saves')
const POINTERS = path.join(ROOT, 'current.json')
const CHATS = path.join(ROOT, 'chats.json')

class SaveStore extends EventEmitter {
  private cache = new Map<string, GameSave>()

  private file(id: string): string {
    if (!/^[a-z0-9_-]+$/.test(id) || id === 'current' || id === 'chats') throw new WorldError(`There is no save "${id}"`)
    return path.join(ROOT, `${id}.json`)
  }

  private ids(): string[] {
    if (!fs.existsSync(ROOT)) return []
    return fs
      .readdirSync(ROOT)
      .filter((f) => f.endsWith('.json') && f !== 'current.json' && f !== 'chats.json')
      .map((f) => f.slice(0, -5))
  }

  read(id: string): GameSave | null {
    const hit = this.cache.get(id)
    if (hit) return hit
    const file = this.file(id)
    if (!fs.existsSync(file)) return null
    const save = cleanSave(readJson(file, {}), id)
    this.cache.set(id, save)
    return save
  }

  get(id: string): GameSave {
    const save = this.read(id)
    if (!save) throw new WorldError(`There is no save "${id}"`)
    return save
  }

  evict(id?: string): void {
    if (id) this.cache.delete(id)
    else this.cache.clear()
  }

  write(save: GameSave): GameSave {
    const next = { ...save, updatedAt: Date.now() }
    fs.mkdirSync(ROOT, { recursive: true })
    writeJson(this.file(save.id), next)
    this.cache.set(save.id, next)
    this.emit('changed', next.world)
    return next
  }

  change(id: string, fn: (save: GameSave) => GameSave): GameSave {
    return this.write(fn(this.get(id)))
  }

  all(): GameSave[] {
    return this.ids()
      .map((id) => this.read(id))
      .filter((s): s is GameSave => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  list(world?: string): SaveMeta[] {
    return this.all()
      .filter((s) => world === undefined || s.world === world)
      .map(saveMeta)
  }

  private pointers(): Record<string, string> {
    const raw = readJson<Record<string, unknown>>(POINTERS, {})
    return Object.fromEntries(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string'))
  }

  private point(world: string, id: string): void {
    fs.mkdirSync(ROOT, { recursive: true })
    writeJson(POINTERS, { ...this.pointers(), [world]: id })
    this.emit('changed', world)
  }

  currentId(world: string): string | null {
    const pointed = this.pointers()[world]
    if (pointed && this.read(pointed)?.world === world) return pointed
    return this.all().find((s) => s.world === world)?.id ?? null
  }

  currentOrNull(world: string): GameSave | null {
    const id = this.currentId(world)
    return id ? this.read(id) : null
  }

  current(world: string): GameSave | null {
    return this.currentOrNull(world)
  }

  worldSaves(world: string): WorldSaves {
    return { current: this.currentId(world), saves: this.list(world) }
  }

  create(world: string, name: string, copy: boolean): GameSave {
    const from = copy ? this.currentOrNull(world) : null
    const taken = new Set(this.ids())
    let n = 1
    while (taken.has(`save_${n}`)) n++
    const id = `save_${n}`
    const now = Date.now()
    const blank = cleanSave({ world }, id)
    const save: GameSave = from ? { ...from, id, world, characters: {}, stand: {}, journeys: {}, createdAt: now } : { ...blank, createdAt: now }
    const made = this.write({ ...save, name: name.trim() || `Save ${n}` })
    this.point(world, id)
    return made
  }

  select(world: string, id: string): GameSave {
    const save = this.get(id)
    if (save.world !== world) throw new WorldError(`${save.name} is a save of another world.`)
    this.point(world, id)
    return save
  }

  rename(id: string, name: string): GameSave {
    return this.change(id, (s) => ({ ...s, name: name.trim() || s.name }))
  }

  remove(id: string): boolean {
    const save = this.read(id)
    if (!save) return false
    if (Object.keys(save.characters).length) throw new WorldError(`${save.name} still has characters in it. Take them out first.`)
    removePath(this.file(id))
    this.cache.delete(id)
    const pins = this.pins()
    for (const [chat, list] of Object.entries(pins)) for (const [world, pinned] of Object.entries(list)) if (pinned === id) delete pins[chat][world]
    writeJson(CHATS, pins)
    this.emit('changed', save.world)
    return true
  }

  markUsed(id: string, trigger: string, flag: string): GameSave {
    return this.change(id, (s) => ({ ...s, used: s.used.includes(trigger) ? s.used : [...s.used, trigger], flags: flag ? { ...s.flags, [flag]: true } : s.flags }))
  }

  setFlag(id: string, flag: string): GameSave {
    return this.change(id, (s) => ({ ...s, flags: { ...s.flags, [flag]: true } }))
  }

  writeClock(id: string, clockId: string, clock: ClockState): GameSave {
    return this.change(id, (s) => ({ ...s, clockId, clock: cleanClockState(clock) }))
  }

  private pins(): Record<string, Record<string, string>> {
    return readJson<Record<string, Record<string, string>>>(CHATS, {})
  }

  pinned(chat: string, world: string): string | null {
    return this.pins()[chat]?.[world] ?? null
  }

  pin(chat: string, world: string, id: string): void {
    const pins = this.pins()
    if (pins[chat]?.[world] === id) return
    fs.mkdirSync(ROOT, { recursive: true })
    writeJson(CHATS, { ...pins, [chat]: { ...(pins[chat] ?? {}), [world]: id } })
  }

  holding(sheet: string): GameSave | null {
    return this.all().find((s) => sheet in s.characters) ?? null
  }
}

export const saves = new SaveStore()
