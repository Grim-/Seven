import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import { cleanStoredTriggerAction, STARTER_TRIGGER_ACTIONS, type StoredTriggerAction } from '@shared/game/triggerActions'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { ToolError } from '../tools/types'

const FILE = path.join(dataRoot, 'triggerActions.json')

export class TriggerActionStore extends EventEmitter {
  constructor(private readonly file: string = FILE) {
    super()
  }

  list(): StoredTriggerAction[] {
    let raw: unknown[] = []
    try {
      raw = readJson<unknown[]>(this.file, [])
    } catch {
      return STARTER_TRIGGER_ACTIONS
    }
    const cleaned = raw
      .map(cleanStoredTriggerAction)
      .filter((a): a is StoredTriggerAction => a !== null)
    if (cleaned.length === 0) {
      try {
        this.write(STARTER_TRIGGER_ACTIONS)
      } catch {
        // Vault may be temporarily locked
      }
      return STARTER_TRIGGER_ACTIONS
    }
    return cleaned.sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): StoredTriggerAction | null {
    return this.find(id)
  }

  find(ref: string): StoredTriggerAction | null {
    const id = toId(ref.trim().replace(/^@?trigger_action:/i, '').replace(/^"|"$/g, ''))
    const all = this.list()
    return all.find((a) => a.id === id) ?? all.find((a) => toId(a.name) === id) ?? null
  }

  save(raw: unknown, previousId: string | null = null): StoredTriggerAction {
    const a = cleanStoredTriggerAction(raw)
    if (!a) throw new ToolError('Give the trigger action a name.')
    this.write([...this.list().filter((x) => x.id !== a.id && x.id !== previousId), a])
    return a
  }

  remove(id: string): void {
    const all = this.list()
    if (!all.some((a) => a.id === id)) throw new ToolError(`No trigger action "${id}".`)
    this.write(all.filter((a) => a.id !== id))
  }

  private write(list: StoredTriggerAction[]): void {
    writeJson(this.file, list)
    this.emit('changed')
  }
}

export const triggerActionsStore = new TriggerActionStore()
