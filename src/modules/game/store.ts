import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { catalogData, cleanDef, defType, defTypes, splitDefRef, starterDefs, type CatalogData, type DefType, type GameDef } from '@shared/game/defs'
import { readJson, writeJson } from '../../engine/util/fs'
import { dataRoot } from '../../engine/util/paths'
import { ToolError } from '../../engine/tools/types'

const DIR = path.join(dataRoot, 'moduledata', 'game')

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

class GameDefs extends EventEmitter {
  typeOf(type: string): DefType {
    const t = defType(type)
    if (!t) throw new ToolError(`There is no game definition type "${type}". The types are ${defTypes().map((d) => d.type).join(', ')}.`)
    return t
  }

  private file(type: string): string {
    return path.join(DIR, `${type}.json`)
  }

  list(type: string): GameDef[] {
    const t = this.typeOf(type)
    const file = this.file(type)
    if (!fs.existsSync(file)) {
      const start = starterDefs(t)
      this.write(type, start, false)
      return [...start].sort(byName)
    }
    return readJson<unknown[]>(file, [])
      .map((raw) => cleanDef(t, raw))
      .filter((d): d is GameDef => d !== null)
      .sort(byName)
  }

  get(type: string, ref: string): GameDef {
    const { id } = splitDefRef(ref)
    const hit = this.list(type).find((d) => d.id === id)
    if (!hit) throw new ToolError(`No ${this.typeOf(type).label.toLowerCase()} "${id}". Use find with kind ${type} to list them.`)
    return hit
  }

  find(type: string, ref: string): GameDef | null {
    const { id } = splitDefRef(ref.replace(/^@?[a-z_]+:/i, '').trim().toLowerCase())
    const list = this.list(type)
    return list.find((d) => d.id === id) ?? list.find((d) => d.name.toLowerCase() === id) ?? null
  }

  private write(type: string, list: GameDef[], announce = true): void {
    fs.mkdirSync(DIR, { recursive: true })
    writeJson(this.file(type), list)
    if (announce) this.emit('changed')
  }

  save(type: string, raw: unknown, previousId: string | null): GameDef {
    const t = this.typeOf(type)
    const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const def = cleanDef(t, previousId ? { ...given, id: previousId } : given)
    if (!def) throw new ToolError(`Give the ${t.label.toLowerCase()} a name.`)
    const list = this.list(type)
    if (!previousId && list.some((d) => d.id === def.id)) throw new ToolError(`There is already a ${t.label.toLowerCase()} with the id "${def.id}". Pick another name.`)
    this.write(type, [...list.filter((d) => d.id !== def.id), def])
    return def
  }

  remove(type: string, id: string): boolean {
    const list = this.list(type)
    if (!list.some((d) => d.id === id)) throw new ToolError(`No ${this.typeOf(type).label.toLowerCase()} "${id}".`)
    this.write(type, list.filter((d) => d.id !== id))
    return true
  }

  catalog(): CatalogData {
    return catalogData(Object.fromEntries(defTypes().map((t) => [t.type, this.list(t.type)])))
  }
}

export const gameDefs = new GameDefs()
