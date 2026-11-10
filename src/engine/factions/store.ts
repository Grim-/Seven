import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import { cleanStoredFaction, STARTER_FACTIONS, type StoredFaction } from '@shared/game/factions'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { ToolError } from '../tools/types'

const FILE = path.join(dataRoot, 'factions.json')

export class FactionStore extends EventEmitter {
  constructor(private readonly file: string = FILE) {
    super()
  }

  list(): StoredFaction[] {
    const raw = readJson<unknown[]>(this.file, [])
    if (!raw.length) {
      // Seed starter factions if brand new / empty
      this.write(STARTER_FACTIONS)
      return STARTER_FACTIONS
    }
    return raw
      .map(cleanStoredFaction)
      .filter((f): f is StoredFaction => f !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): StoredFaction {
    const hit = this.list().find((f) => f.id === id)
    if (!hit) throw new ToolError(`No faction "${id}". find with kind faction lists them.`)
    return hit
  }

  find(ref: string): StoredFaction | null {
    const id = toId(ref.trim().replace(/^@?faction:/i, '').replace(/^"|"$/g, ''))
    const all = this.list()
    return all.find((f) => f.id === id) ?? all.find((f) => toId(f.name) === id) ?? null
  }

  save(raw: unknown, previousId: string | null = null): StoredFaction {
    const f = cleanStoredFaction(raw)
    if (!f) throw new ToolError('Give the faction a name.')
    this.write([...this.list().filter((x) => x.id !== f.id && x.id !== previousId), f])
    return f
  }

  remove(id: string): void {
    const all = this.list()
    if (!all.some((f) => f.id === id)) throw new ToolError(`No faction "${id}".`)
    this.write(all.filter((f) => f.id !== id))
  }

  private write(list: StoredFaction[]): void {
    writeJson(this.file, list)
    this.emit('changed')
  }
}

export const factions = new FactionStore()
