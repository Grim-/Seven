import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import { cleanStoredDecision } from '@shared/storedDecision'
import { cleanStoredAction } from '@shared/storedAction'
import { readJson, writeJson } from '../../engine/util/fs'
import { dataRoot } from '../../engine/util/paths'
import { ToolError } from '../../engine/tools/types'

const DIR = path.join(dataRoot, 'moduledata', 'decisions')

export class NamedStore<T extends { id: string; name: string }> extends EventEmitter {
  constructor(
    private readonly file: string,
    private readonly kind: string,
    private readonly clean: (raw: unknown) => T | null
  ) {
    super()
  }

  list(): T[] {
    return readJson<unknown[]>(this.file, [])
      .map(this.clean)
      .filter((d): d is T => d !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): T {
    const hit = this.list().find((d) => d.id === id)
    if (!hit) throw new ToolError(`No ${this.kind} "${id}". find with kind ${this.kind} lists them.`)
    return hit
  }

  find(ref: string): T | null {
    const id = toId(ref.trim().replace(new RegExp(`^@?${this.kind}:`, 'i'), '').replace(/^"|"$/g, ''))
    const all = this.list()
    return all.find((d) => d.id === id) ?? all.find((d) => toId(d.name) === id) ?? null
  }

  save(raw: unknown, previousId: string | null = null): T {
    const d = this.clean(raw)
    if (!d) throw new ToolError('Give it a name.')
    this.write([...this.list().filter((x) => x.id !== d.id && x.id !== previousId), d])
    return d
  }

  remove(id: string): void {
    const all = this.list()
    if (!all.some((d) => d.id === id)) throw new ToolError(`No ${this.kind} "${id}".`)
    this.write(all.filter((d) => d.id !== id))
  }

  private write(list: T[]): void {
    writeJson(this.file, list)
    this.emit('changed')
  }
}

export const decisions = new NamedStore(path.join(DIR, 'decisions.json'), 'story_decision', cleanStoredDecision)
export const storyActions = new NamedStore(path.join(DIR, 'actions.json'), 'story_action', cleanStoredAction)
