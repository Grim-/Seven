import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { FolderAccess, LinkedFolder } from '@shared/types'
import { newId, readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'

const FILE = path.join(dataRoot, 'folders.json')

export function folderSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function inside(root: string, target: string): boolean {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export class FolderStore extends EventEmitter {
  private data: LinkedFolder[]

  constructor() {
    super()
    const raw = readJson<{ folders?: LinkedFolder[] }>(FILE, {})
    this.data = Array.isArray(raw.folders) ? raw.folders : []
  }

  list(): LinkedFolder[] {
    return [...this.data].sort((a, b) => a.name.localeCompare(b.name))
  }

  forAgent(agentId: string): LinkedFolder[] {
    return this.list().filter((f) => f.agents.includes(agentId))
  }

  private persist(): LinkedFolder[] {
    writeJson(FILE, { folders: this.data })
    const list = this.list()
    this.emit('changed', list)
    return list
  }

  save(input: Partial<LinkedFolder> & { path: string }): LinkedFolder[] {
    const abs = path.resolve(input.path.trim())
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error(`${abs} is not a folder. Pick a folder that exists on this computer.`)
    const data = fs.existsSync(dataRoot) ? fs.realpathSync(dataRoot) : path.resolve(dataRoot)
    const real = fs.realpathSync(abs)
    if (inside(data, real) || inside(real, data)) throw new Error("Seven's own data folder, and any folder containing it, can't be linked. Pick a folder outside it.")
    const name = folderSlug(input.name || path.basename(abs)) || 'folder'
    const existing = input.id ? this.data.find((f) => f.id === input.id) : undefined
    if (this.data.some((f) => f.name === name && f.id !== existing?.id)) throw new Error(`There is already a linked folder called @${name}. Give one of them a different Name.`)
    const access: FolderAccess = input.access === 'write' ? 'write' : 'read'
    const exclude = [...new Set((input.exclude ?? existing?.exclude ?? []).map((g) => g.trim().replace(/\\/g, '/')).filter(Boolean))]
    const agents = [...new Set(input.agents ?? existing?.agents ?? [])]
    const folder: LinkedFolder = { id: existing?.id ?? newId('fold'), name, path: abs, access, exclude, agents }
    this.data = existing ? this.data.map((f) => (f.id === existing.id ? folder : f)) : [...this.data, folder]
    return this.persist()
  }

  delete(id: string): LinkedFolder[] {
    this.data = this.data.filter((f) => f.id !== id)
    return this.persist()
  }
}

export const linkedFolders = new FolderStore()
