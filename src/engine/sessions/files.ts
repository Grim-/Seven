import fs from 'node:fs'
import path from 'node:path'
import { appendLine, readJson, readLines, removePath, writeJson, writeLines } from '../util/fs'

export interface SessionFiles {
  readJson<T>(name: string, fallback: T): T
  writeJson(name: string, value: unknown): void
  readLines<T>(name: string): T[]
  appendLine(name: string, value: unknown): void
  writeLines(name: string, values: unknown[]): void
  exists(name: string): boolean
  remove(name: string): void
}

export function diskFiles(dir: string): SessionFiles {
  const at = (name: string) => path.join(dir, name)
  return {
    readJson: (name, fallback) => readJson(at(name), fallback),
    writeJson: (name, value) => writeJson(at(name), value),
    readLines: (name) => readLines(at(name)),
    appendLine: (name, value) => appendLine(at(name), value),
    writeLines: (name, values) => writeLines(at(name), values),
    exists: (name) => fs.existsSync(at(name)),
    remove: (name) => removePath(at(name))
  }
}

export class MemoryFiles implements SessionFiles {
  private files = new Map<string, unknown>()

  readJson<T>(name: string, fallback: T): T {
    return this.files.has(name) ? structuredClone(this.files.get(name) as T) : fallback
  }

  writeJson(name: string, value: unknown): void {
    this.files.set(name, structuredClone(value))
  }

  readLines<T>(name: string): T[] {
    return structuredClone((this.files.get(name) as T[] | undefined) ?? [])
  }

  appendLine(name: string, value: unknown): void {
    this.files.set(name, [...((this.files.get(name) as unknown[] | undefined) ?? []), structuredClone(value)])
  }

  writeLines(name: string, values: unknown[]): void {
    this.files.set(name, structuredClone(values))
  }

  exists(name: string): boolean {
    return this.files.has(name)
  }

  remove(name: string): void {
    this.files.delete(name)
  }
}
