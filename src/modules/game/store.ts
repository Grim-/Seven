import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { catalogData, cleanDef, defId, defType, defTypes, ruleSetFor, splitDefRef, starterDefs, type CatalogData, type DefType, type GameDef, type RuleSet } from '@shared/game/defs'
import { readJson, removePath, writeJson } from '../../engine/util/fs'
import { dataRoot } from '../../engine/util/paths'
import { ToolError } from '../../engine/tools/types'

const DIR = path.join(dataRoot, 'moduledata', 'game')
const META = 'rules.json'
const STARTER: RuleSet = { id: 'starter', name: 'Starter', notes: 'The starter rules Seven puts in: attributes, Health, Stamina and Mana, the SRD damage types and skills, and a few buffs, abilities, items and creatures.' }

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

class GameDefs extends EventEmitter {
  typeOf(type: string): DefType {
    const t = defType(type)
    if (!t) throw new ToolError(`There is no game definition type "${type}". The types are ${defTypes().map((d) => d.type).join(', ')}.`)
    return t
  }

  private setDir(ruleSet: string): string {
    if (!/^[a-z0-9_]+$/.test(ruleSet)) throw new ToolError(`There is no rule set "${ruleSet}".`)
    return path.join(DIR, ruleSet)
  }

  private readMeta(id: string): RuleSet {
    const raw = readJson<Record<string, unknown>>(path.join(this.setDir(id), META), {})
    return { id, name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id, notes: typeof raw.notes === 'string' ? raw.notes : '' }
  }

  private writeMeta(set: RuleSet): void {
    fs.mkdirSync(this.setDir(set.id), { recursive: true })
    writeJson(path.join(this.setDir(set.id), META), { name: set.name, notes: set.notes })
  }

  ruleSets(): RuleSet[] {
    const found = fs.existsSync(DIR)
      ? fs
          .readdirSync(DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory() && /^[a-z0-9_]+$/.test(d.name) && fs.existsSync(path.join(DIR, d.name, META)))
          .map((d) => this.readMeta(d.name))
      : []
    if (found.length) return found.sort(byName)
    this.writeMeta(STARTER)
    return [STARTER]
  }

  ruleSet(id: string): RuleSet {
    const hit = this.ruleSets().find((s) => s.id === id)
    if (!hit) throw new ToolError(`There is no rule set "${id}". The rule sets are ${this.ruleSets().map((s) => s.id).join(', ')}.`)
    return hit
  }

  resolve(wanted: string | null | undefined): string {
    return ruleSetFor(wanted, this.ruleSets())
  }

  saveRuleSet(id: string | null, name: string, notes: string, copy: string | null): RuleSet {
    const clean = name.trim()
    if (!clean) throw new ToolError('Give the rule set a name.')
    if (id) {
      const set = { ...this.ruleSet(id), name: clean, notes }
      this.writeMeta(set)
      this.emit('changed')
      return set
    }
    const from = copy ? this.ruleSet(copy).id : null
    const base = defId(clean) || 'rules'
    const taken = new Set(this.ruleSets().map((s) => s.id))
    let made = base
    for (let n = 2; taken.has(made); n++) made = `${base}_${n}`
    const set: RuleSet = { id: made, name: clean, notes }
    const lists = defTypes().map((t) => [t.type, from ? this.list(from, t.type) : []] as const)
    this.writeMeta(set)
    for (const [type, list] of lists) writeJson(this.file(set.id, type), list)
    this.emit('changed')
    return set
  }

  removeRuleSet(id: string): boolean {
    this.ruleSet(id)
    removePath(this.setDir(id))
    this.emit('changed')
    return true
  }

  private file(ruleSet: string, type: string): string {
    return path.join(this.setDir(ruleSet), `${type}.json`)
  }

  list(ruleSet: string, type: string): GameDef[] {
    const t = this.typeOf(type)
    this.ruleSet(ruleSet)
    const file = this.file(ruleSet, type)
    if (!fs.existsSync(file)) {
      const start = starterDefs(t)
      this.write(ruleSet, type, start, false)
      return [...start].sort(byName)
    }
    return readJson<unknown[]>(file, [])
      .map((raw) => cleanDef(t, raw))
      .filter((d): d is GameDef => d !== null)
      .sort(byName)
  }

  get(ruleSet: string, type: string, id: string): GameDef {
    const hit = this.list(ruleSet, type).find((d) => d.id === id)
    if (!hit) throw new ToolError(`No ${this.typeOf(type).label.toLowerCase()} "${id}" in the rule set ${this.ruleSet(ruleSet).name}. Use find with kind ${type} to list them.`)
    return hit
  }

  find(type: string, ref: string): { ruleSet: string; def: GameDef } | null {
    const { ruleSet, id } = splitDefRef(ref.replace(/^@?[a-z_]+:/i, '').trim().toLowerCase())
    const sets = ruleSet ? [this.ruleSet(ruleSet).id] : this.ruleSets().map((s) => s.id)
    for (const set of sets) {
      const list = this.list(set, type)
      const def = list.find((d) => d.id === id) ?? list.find((d) => d.name.toLowerCase() === id)
      if (def) return { ruleSet: set, def }
    }
    return null
  }

  private write(ruleSet: string, type: string, list: GameDef[], announce = true): void {
    fs.mkdirSync(this.setDir(ruleSet), { recursive: true })
    writeJson(this.file(ruleSet, type), list)
    if (announce) this.emit('changed')
  }

  save(ruleSet: string, type: string, raw: unknown, previousId: string | null): GameDef {
    const t = this.typeOf(type)
    const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const def = cleanDef(t, previousId ? { ...given, id: previousId } : given)
    if (!def) throw new ToolError(`Give the ${t.label.toLowerCase()} a name.`)
    const list = this.list(ruleSet, type)
    if (!previousId && list.some((d) => d.id === def.id)) throw new ToolError(`There is already a ${t.label.toLowerCase()} with the id "${def.id}" in this rule set. Pick another name.`)
    this.write(ruleSet, type, [...list.filter((d) => d.id !== def.id), def])
    return def
  }

  remove(ruleSet: string, type: string, id: string): boolean {
    const list = this.list(ruleSet, type)
    if (!list.some((d) => d.id === id)) throw new ToolError(`No ${this.typeOf(type).label.toLowerCase()} "${id}" in this rule set.`)
    this.write(ruleSet, type, list.filter((d) => d.id !== id))
    return true
  }

  catalog(ruleSet: string): CatalogData {
    return catalogData(Object.fromEntries(defTypes().map((t) => [t.type, this.list(ruleSet, t.type)])))
  }
}

export const gameDefs = new GameDefs()
