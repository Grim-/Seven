import { currentToolName } from '@shared/toolnames'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { Toolset } from '@shared/types'
import { dataRoot } from '../util/paths'
import { newId, readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'toolsets.json')

class ToolsetStore extends EventEmitter {
  list(): Toolset[] {
    const raw = readJson<Toolset[]>(FILE, [])
    return (Array.isArray(raw) ? raw : []).filter((t) => t && typeof t.id === 'string')
  }

  get(id: string): Toolset | null {
    return this.list().find((t) => t.id === id) ?? null
  }

  save(input: Partial<Toolset> & { name: string }): Toolset {
    const list = this.list()
    const name = input.name.trim()
    if (!name) throw new Error('A toolset needs a name')
    const clean: Toolset = {
      id: input.id && list.some((t) => t.id === input.id) ? input.id : newId('ts'),
      name: name.slice(0, 60),
      description: (input.description ?? '').trim().slice(0, 300),
      tools: [...new Set((input.tools ?? []).filter((t) => typeof t === 'string' && t.trim()))]
    }
    const next = list.some((t) => t.id === clean.id) ? list.map((t) => (t.id === clean.id ? clean : t)) : [...list, clean]
    writeJson(FILE, next)
    this.emit('changed', next)
    return clean
  }

  delete(id: string): Toolset[] {
    const next = this.list().filter((t) => t.id !== id)
    writeJson(FILE, next)
    this.emit('changed', next)
    return next
  }

  toolNames(ids: string[] | undefined): Set<string> {
    if (!ids?.length) return new Set()
    const list = this.list()
    return new Set(ids.flatMap((id) => (list.find((t) => t.id === id)?.tools ?? []).map(currentToolName)))
  }
}

export const toolsets = new ToolsetStore()
