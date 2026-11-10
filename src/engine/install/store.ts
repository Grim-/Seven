import fs from 'node:fs'
import path from 'node:path'
import { resolveParams } from '@shared/game/core/params'
import { machineRoot } from './paths'
import { helperOf, schemaOf, type Checked, type Settings, type StoredRelease } from './registry'

export interface StoredVersion {
  id: string
  tag: string | null
  build: string | null
  label: string | null
  folder: string
  external: boolean
  installedAt: number | null
  checksum: boolean | null
}

export interface HelperRecord {
  root: string | null
  active: string | null
  versions: StoredVersion[]
  settings: Settings
  releases: StoredRelease[]
  checkedAt: number | null
}

interface InstallsFile {
  helpers: Record<string, HelperRecord>
}

export interface StoredCheck extends Checked {
  at: number
}

const blank = (): HelperRecord => ({ root: null, active: null, versions: [], settings: {}, releases: [], checkedAt: null })

function recordFile(): string {
  return path.join(machineRoot(), 'installs.json')
}

function readAll(): InstallsFile {
  let text: string
  try {
    text = fs.readFileSync(recordFile(), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return { helpers: {} }
    throw err
  }
  try {
    const value = JSON.parse(text) as Partial<InstallsFile>
    return { helpers: value.helpers ?? {} }
  } catch (err) {
    throw new Error(`Could not read ${recordFile()}: it is not valid JSON (${err instanceof Error ? err.message : String(err)}). Fix it by hand, or move it away to start a new record.`)
  }
}

function writeAll(all: InstallsFile): void {
  const file = recordFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  fs.writeFileSync(temp, JSON.stringify(all, null, 2))
  fs.renameSync(temp, file)
}

export function record(id: string): HelperRecord {
  return { ...blank(), ...readAll().helpers[id] }
}

export function change(id: string, edit: (r: HelperRecord) => void): HelperRecord {
  const all = readAll()
  const r = { ...blank(), ...all.helpers[id] }
  edit(r)
  all.helpers[id] = r
  writeAll(all)
  return r
}

export function settingsOf(id: string): Settings {
  return resolveParams(schemaOf(helperOf(id)), record(id).settings)
}

export function rootOf(id: string): string {
  return record(id).root ?? helperOf(id).defaultRoot()
}

export function samePath(a: string, b: string): boolean {
  const x = path.resolve(a)
  const y = path.resolve(b)
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y
}

export function hasProgram(id: string, folder: string): boolean {
  return fs.existsSync(path.join(folder, helperOf(id).program))
}

function checkFile(id: string, version: string): string {
  return path.join(machineRoot(), 'installs', id, `${version}.json`)
}

export function readCheck(id: string, version: string): StoredCheck | null {
  try {
    return JSON.parse(fs.readFileSync(checkFile(id, version), 'utf8')) as StoredCheck
  } catch {
    return null
  }
}

export function writeCheck(id: string, version: string, checked: Checked): StoredCheck {
  const file = checkFile(id, version)
  const stored = { ...checked, at: Date.now() }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(stored, null, 2))
  return stored
}

export function forgetCheck(id: string, version: string): void {
  fs.rmSync(checkFile(id, version), { force: true })
}
