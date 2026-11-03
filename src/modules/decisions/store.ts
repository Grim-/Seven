import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import { cleanStoredDecision, type StoredDecision } from '@shared/storedDecision'
import { readJson, writeJson } from '../../engine/util/fs'
import { dataRoot } from '../../engine/util/paths'
import { ToolError } from '../../engine/tools/types'

const FILE = path.join(dataRoot, 'moduledata', 'decisions', 'decisions.json')

class Decisions extends EventEmitter {
  list(): StoredDecision[] {
    return readJson<unknown[]>(FILE, [])
      .map(cleanStoredDecision)
      .filter((d): d is StoredDecision => d !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): StoredDecision {
    const hit = this.list().find((d) => d.id === id)
    if (!hit) throw new ToolError(`No decision "${id}". find with kind decision lists them.`)
    return hit
  }

  find(ref: string): StoredDecision | null {
    const id = toId(ref.trim().replace(/^@?decision:/i, '').replace(/^"|"$/g, ''))
    const all = this.list()
    return all.find((d) => d.id === id) ?? all.find((d) => toId(d.name) === id) ?? null
  }

  save(raw: unknown, previousId: string | null = null): StoredDecision {
    const d = cleanStoredDecision(raw)
    if (!d) throw new ToolError('Give the decision a name.')
    this.write([...this.list().filter((x) => x.id !== d.id && x.id !== previousId), d])
    return d
  }

  remove(id: string): void {
    const all = this.list()
    if (!all.some((d) => d.id === id)) throw new ToolError(`No decision "${id}".`)
    this.write(all.filter((d) => d.id !== id))
  }

  private write(list: StoredDecision[]): void {
    writeJson(FILE, list)
    this.emit('changed')
  }
}

export const decisions = new Decisions()
