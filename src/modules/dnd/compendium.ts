import path from 'node:path'
import { EventEmitter } from 'node:events'
import { cleanEntry, entryId, importEntries, type CompendiumEntry, type CompendiumKind } from '@shared/compendium'
import { readJson, writeJson } from '../../engine/util/fs'
import { dataRoot } from '../../engine/util/paths'
import { ToolError } from '../../engine/tools/types'
import spell from './srd/spell.json'
import cls from './srd/class.json'
import feature from './srd/feature.json'
import race from './srd/race.json'
import equipment from './srd/equipment.json'
import condition from './srd/condition.json'
import monster from './srd/monster.json'

const SRD = { spell, class: cls, feature, race, equipment, condition, monster } as unknown as Record<CompendiumKind, CompendiumEntry[]>
const DIR = path.join(dataRoot, 'moduledata', 'dnd')

class Compendium extends EventEmitter {
  private file(kind: CompendiumKind): string {
    return path.join(DIR, `${kind}.json`)
  }

  own(kind: CompendiumKind): CompendiumEntry[] {
    return readJson<unknown[]>(this.file(kind), [])
      .map((e) => cleanEntry(kind, e))
      .filter((e): e is CompendiumEntry => e !== null)
  }

  all(kind: CompendiumKind): CompendiumEntry[] {
    const own = this.own(kind)
    const mine = new Set(own.map((e) => e.id))
    return [...own, ...SRD[kind].filter((e) => !mine.has(e.id))].sort((a, b) => a.name.localeCompare(b.name))
  }

  isSrd(kind: CompendiumKind, id: string): boolean {
    return SRD[kind].some((e) => e.id === id)
  }

  get(kind: CompendiumKind, id: string): CompendiumEntry {
    const hit = this.own(kind).find((e) => e.id === id) ?? SRD[kind].find((e) => e.id === id)
    if (!hit) throw new ToolError(`No ${kind} "${id}". Use find with kind ${kind} to list them.`)
    return hit
  }

  find(kind: CompendiumKind, ref: string): CompendiumEntry | null {
    const id = entryId(ref.replace(/^@?[a-z]+:/i, ''))
    const all = this.all(kind)
    return all.find((e) => e.id === id) ?? all.find((e) => entryId(e.name) === id) ?? null
  }

  private write(kind: CompendiumKind, list: CompendiumEntry[]): void {
    writeJson(this.file(kind), list)
    this.emit('changed')
  }

  save(kind: CompendiumKind, raw: unknown, previousId: string | null = null): CompendiumEntry {
    const entry = cleanEntry(kind, raw)
    if (!entry) throw new ToolError('Give it a name.')
    const own = this.own(kind).filter((e) => e.id !== entry.id && e.id !== previousId)
    this.write(kind, [...own, { ...entry, source: 'Yours' }])
    return { ...entry, source: 'Yours' }
  }

  remove(kind: CompendiumKind, id: string): boolean {
    const own = this.own(kind)
    if (!own.some((e) => e.id === id)) throw new ToolError(this.isSrd(kind, id) ? 'This is an SRD entry; only your own entries can be deleted.' : `No ${kind} "${id}" of yours.`)
    this.write(kind, own.filter((e) => e.id !== id))
    return true
  }

  import(kind: CompendiumKind, raw: unknown, apply: boolean): { added: string[]; replaced: string[] } {
    const incoming = importEntries(kind, raw)
    if (!incoming.length) throw new ToolError('Nothing to import: give a JSON list of entries with at least a name.')
    const current = new Set(this.all(kind).map((e) => e.id))
    const added = incoming.filter((e) => !current.has(e.id)).map((e) => e.name)
    const replaced = incoming.filter((e) => current.has(e.id)).map((e) => e.name)
    if (apply) {
      const ids = new Set(incoming.map((e) => e.id))
      this.write(kind, [...this.own(kind).filter((e) => !ids.has(e.id)), ...incoming])
    }
    return { added, replaced }
  }
}

export const compendium = new Compendium()
