import fs from 'node:fs'
import { isVaultLocked } from '@shared/sealed'
import path from 'node:path'
import { secure } from './secure'
import { dataRoot } from './paths'

export interface StorageChange {
  op: 'write' | 'remove' | 'rename' | 'copy'
  path: string
  to?: string
}

const listeners = new Set<(change: StorageChange) => void>()

export function onStorageChange(fn: (change: StorageChange) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function changed(change: StorageChange): void {
  for (const fn of listeners) fn(change)
}

export function readJson<T>(file: string, fallback: T): T {
  let text: string
  try {
    text = secure.readText(file)
  } catch (err) {
    if (isVaultLocked(err)) throw err
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback
    throw new Error(`Could not read ${path.relative(dataRoot, file) || file}: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!text.trim()) return fallback
  try {
    return JSON.parse(text) as T
  } catch (err) {
    throw new Error(`Could not read ${path.relative(dataRoot, file) || file}: it is not valid JSON (${err instanceof Error ? err.message : String(err)}; starts with ${JSON.stringify(text.slice(0, 12))}). Fix that file by hand, or restore it from a backup.`)
  }
}

export function writeJson(file: string, value: unknown): void {
  secure.writeText(file, JSON.stringify(value, null, 2))
  changed({ op: 'write', path: file })
}

export function appendLine(file: string, value: unknown): void {
  secure.appendLine(file, value)
  changed({ op: 'write', path: file })
}

export function readLines<T>(file: string): T[] {
  return secure.readLines<T>(file)
}

export function writeLines(file: string, values: unknown[]): void {
  secure.writeLines(file, values)
  changed({ op: 'write', path: file })
}

export function readText(file: string): string {
  return secure.readText(file)
}

export function writeText(file: string, text: string): void {
  secure.writeText(file, text)
  changed({ op: 'write', path: file })
}

export function readBytes(file: string): Buffer {
  return secure.readBytes(file)
}

export function writeBytes(file: string, data: Buffer): void {
  secure.writeBytes(file, data)
  changed({ op: 'write', path: file })
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function removePath(file: string): void {
  fs.rmSync(file, { recursive: true, force: true })
  secure.forget(file)
  changed({ op: 'remove', path: file })
}

export function renamePath(from: string, to: string): void {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.renameSync(from, to)
  secure.forget(from)
  secure.forget(to)
  changed({ op: 'rename', path: from, to })
}

export function writeUserFile(file: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
  secure.forget(file)
}

export function copyPath(from: string, to: string): void {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
  secure.forget(to)
  changed({ op: 'copy', path: from, to })
}
