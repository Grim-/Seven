import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import type { LinkedFolder } from '@shared/types'
import { dataRoot } from '../util/paths'
import { matchesProtected } from '../permissions/paths'
import { ToolBlocked, ToolError } from './types'

export type Scope = string | null | { workspace: string | null; folders?: LinkedFolder[] }

export interface Place {
  root: string
  folder: LinkedFolder | null
}

function within(root: string, target: string): boolean {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function split(scope: Scope): { workspace: string | null; folders: LinkedFolder[] } {
  if (scope === null || typeof scope === 'string') return { workspace: scope, folders: [] }
  return { workspace: scope.workspace, folders: scope.folders ?? [] }
}

function folderNames(folders: LinkedFolder[]): string {
  return folders.length ? folders.map((f) => `@${f.name}`).join(', ') : 'none'
}

export function workspaceRoot(scope: Scope): string {
  const { workspace, folders } = split(scope)
  if (!workspace) {
    throw new ToolError(
      folders.length
        ? `This agent has no workspace folder, so start the path with a linked folder's name, e.g. "@${folders[0].name}/notes.md". Linked folders: ${folderNames(folders)}`
        : 'This agent has no workspace folder and no linked folders, so it cannot use files on this computer. Carry on without files, or tell the user to set a workspace folder for this agent.'
    )
  }
  const root = path.resolve(workspace)
  if (!fs.existsSync(root)) throw new ToolError(`The workspace folder ${root} no longer exists. Tell the user to recreate it or choose another workspace folder for this agent.`)
  return fs.realpathSync(root)
}

function folderRoot(folder: LinkedFolder): string {
  const root = path.resolve(folder.path)
  if (!fs.existsSync(root)) throw new ToolError(`The linked folder @${folder.name} (${root}) no longer exists. Use the workspace or another linked folder, or tell the user to link it again.`)
  return fs.realpathSync(root)
}

function realTarget(target: string): string {
  if (fs.existsSync(target)) return fs.realpathSync(target)
  const rest: string[] = []
  let current = target
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return target
    rest.unshift(path.basename(current))
    current = parent
  }
  return path.join(fs.realpathSync(current), ...rest)
}

function relIn(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/')
}

export function excludedBy(folder: LinkedFolder, rel: string): string | null {
  if (!rel || !folder.exclude.length) return null
  return matchesProtected(rel, folder.exclude)
}

export const DISK_ROOT = 'workspace'

function rooted(scope: Scope, raw: string): string {
  const { workspace, folders } = split(scope)
  const m = /^([^/\\@:]+)(?:[/\\](.*))?$/.exec(raw)
  if (!m) return raw
  const name = m[1].toLowerCase()
  if (name === DISK_ROOT && workspace) return m[2] || '.'
  const folder = folders.find((f) => f.name.toLowerCase() === name)
  return folder ? `@${folder.name}/${m[2] ?? ''}` : raw
}

function placeOf(scope: Scope, input: string): { place: Place; target: string; label: string } {
  const { folders } = split(scope)
  const raw = rooted(scope, input)
  if (raw.startsWith('@')) {
    const m = /^@([^/\\]+)[/\\]?(.*)$/.exec(raw)
    const name = (m?.[1] ?? '').toLowerCase()
    const folder = folders.find((f) => f.name === name)
    if (!folder) throw new ToolError(folders.length ? `There is no linked folder @${name}. Start the path with one of: ${folderNames(folders)}, or leave off the @ to use the workspace.` : `There is no linked folder @${name}, and this agent has none. Leave off the @ to use a path in the workspace.`)
    const root = folderRoot(folder)
    return { place: { root, folder }, target: path.resolve(root, m?.[2] || '.'), label: `@${folder.name}` }
  }
  if (path.isAbsolute(raw)) {
    const abs = path.resolve(raw)
    for (const folder of folders) {
      const root = folderRoot(folder)
      if (within(root, abs) || within(path.resolve(folder.path), abs)) return { place: { root, folder }, target: within(root, abs) ? abs : path.join(root, path.relative(path.resolve(folder.path), abs)), label: `@${folder.name}` }
    }
  }
  const root = workspaceRoot(scope)
  return { place: { root, folder: null }, target: path.resolve(root, raw), label: 'the workspace' }
}

export function resolvePlace(scope: Scope, input: string | null): { place: Place; target: string } {
  const raw = (input ?? '').trim() || '.'
  const { place, target, label } = placeOf(scope, raw)
  if (!within(place.root, target)) {
    const { folders } = split(scope)
    throw new ToolBlocked(
      `"${raw}" is outside ${label}. Only paths inside the workspace${folders.length ? ` or a linked folder (${folderNames(folders)})` : ''} are allowed; do not try to reach it another way.`,
      'path outside the allowed folders'
    )
  }
  const real = realTarget(target)
  if (!within(place.root, real)) throw new ToolBlocked(`"${raw}" points outside ${label} through a link. Do not try to reach it another way.`, 'link outside the allowed folders')
  if (place.folder) {
    const hit = excludedBy(place.folder, relIn(place.root, real))
    if (hit) throw new ToolBlocked(`"${raw}" is excluded from @${place.folder.name} (${hit}). Do not try to reach it another way.`, `excluded path in @${place.folder.name}`)
  }
  return { place, target: real }
}

export function resolveInWorkspace(scope: Scope, input: string | null): string {
  return resolvePlace(scope, input).target
}

let toolsFolderCheck: (abs: string) => boolean = () => false

export function setToolsFolderCheck(fn: (abs: string) => boolean): void {
  toolsFolderCheck = fn
}

export function isToolsFolder(abs: string): boolean {
  return toolsFolderCheck(abs)
}

export function resolveForWrite(scope: Scope, input: string): string {
  const { place, target } = resolvePlace(scope, input)
  if (place.folder && place.folder.access !== 'write') {
    throw new ToolBlocked(`@${place.folder.name} is read only. Do not try to change it another way.`, `write to read-only @${place.folder.name}`)
  }
  if (target === place.root) throw new ToolError(place.folder ? `@${place.folder.name} itself is a folder, not a file. Give a file path inside it, e.g. "@${place.folder.name}/notes.md".` : 'The workspace folder itself is not a file. Give a file path inside it, e.g. "notes.md".')
  const data = fs.existsSync(dataRoot) ? fs.realpathSync(dataRoot) : path.resolve(dataRoot)
  if (within(data, target) && !toolsFolderCheck(target)) throw new ToolBlocked("Seven's own data folder can't be changed by tools. Do not try to change it another way.", "write to Seven's data folder")
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) throw new ToolError(`"${input}" is a folder, not a file. Give a file path inside it, e.g. "${input.replace(/[/\\]+$/, '')}/notes.md".`)
  return target
}

export function displayPath(scope: Scope, absolute: string): string {
  const { workspace, folders } = split(scope)
  for (const folder of folders) {
    let root: string
    try {
      root = folderRoot(folder)
    } catch (err) {
      noteFailure(err, 'folders', 'A linked folder could not be reached')
      continue
    }
    if (within(root, absolute)) {
      const rel = relIn(root, absolute)
      return rel ? `@${folder.name}/${rel}` : `@${folder.name}`
    }
  }
  if (!workspace) return absolute
  const rel = path.relative(workspaceRoot(scope), absolute)
  return (rel || '.').split(path.sep).join('/')
}

export function isHidden(scope: Scope, absolute: string): boolean {
  const { folders } = split(scope)
  for (const folder of folders) {
    let root: string
    try {
      root = folderRoot(folder)
    } catch (err) {
      noteFailure(err, 'folders', 'A linked folder could not be reached')
      continue
    }
    if (within(root, absolute)) return excludedBy(folder, relIn(root, absolute)) !== null
  }
  return false
}
