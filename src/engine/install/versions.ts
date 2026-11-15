import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import { partOf } from '../net/resumable'
import { helperOf } from './registry'
import { installEvents } from './events'
import { change, forgetCheck, hasProgram, record, rootOf, samePath, settingsOf, writeCheck, type HelperRecord, type StoredVersion } from './store'

const leases = new Map<string, Map<number, string>>()
const activated = new Map<string, Set<() => Promise<void>>>()
let nextLease = 0

const leaseKey = (id: string, version: string) => `${id}\u0000${version}`

export function lease(id: string, version: string, holder: string): () => void {
  const key = leaseKey(id, version)
  const held = leases.get(key) ?? new Map<number, string>()
  const n = nextLease++
  held.set(n, holder)
  leases.set(key, held)
  installEvents.changed(id)
  return () => {
    if (held.delete(n)) installEvents.changed(id)
  }
}

export function holders(id: string, version: string): string[] {
  return [...(leases.get(leaseKey(id, version))?.values() ?? [])]
}

export function onActivated(id: string, fn: () => Promise<void>): void {
  const set = activated.get(id) ?? new Set()
  set.add(fn)
  activated.set(id, set)
}

function uniqueId(r: HelperRecord, base: string): string {
  let id = base
  for (let n = 2; r.versions.some((v) => v.id === id); n++) id = `${base}-${n}`
  return id
}

export function addVersion(id: string, version: Omit<StoredVersion, 'id'>, idBase: string): StoredVersion {
  let added: StoredVersion | null = null
  change(id, (r) => {
    added = { ...version, id: uniqueId(r, idBase) }
    r.versions.push(added)
  })
  installEvents.changed(id)
  return added!
}

export function adopt(id: string): HelperRecord {
  const helper = helperOf(id)
  const r = record(id)
  const root = rootOf(id)
  let found: string[] = []
  try {
    found = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.endsWith(partOf('')) && hasProgram(id, path.join(root, d.name)))
      .map((d) => path.join(root, d.name))
  } catch (err) {
    noteFailure(err, 'install', 'Could not list the installed versions')
    found = []
  }
  const fresh = found.filter((f) => !r.versions.some((v) => samePath(v.folder, f)))
  const before = r.active === null && helper.activeBefore ? helper.activeBefore(root) : null
  if (!fresh.length && !before) return r
  const next = change(id, (rec) => {
    for (const folder of fresh) rec.versions.push({ id: uniqueId(rec, path.basename(folder)), tag: null, build: null, label: null, folder, external: false, installedAt: null, checksum: null })
    if (rec.active === null && before) rec.active = rec.versions.find((v) => samePath(v.folder, path.join(root, before)))?.id ?? null
  })
  installEvents.changed(id)
  return next
}

export function versionOf(id: string, version: string): StoredVersion {
  const found = record(id).versions.find((v) => v.id === version)
  if (!found) throw notFound(new Error(`That version of ${helperOf(id).title} is no longer listed.`))
  return found
}

export function activeVersion(id: string): StoredVersion | null {
  const r = record(id)
  const v = r.versions.find((x) => x.id === r.active) ?? null
  return v && hasProgram(id, v.folder) ? v : null
}

export async function verifyVersion(id: string, version: string): Promise<void> {
  const v = versionOf(id, version)
  writeCheck(id, v.id, await helperOf(id).verify(v.folder, settingsOf(id)))
  installEvents.changed(id)
}

const checking = new Set<string>()

export function checkOnce(id: string, version: string): void {
  const key = leaseKey(id, version)
  if (checking.has(key)) return
  checking.add(key)
  void verifyVersion(id, version)
    .catch((err: unknown) => noteFailure(err, 'install', 'Could not check an installed version'))
    .finally(() => checking.delete(key))
}

export async function addExisting(id: string, folder: string): Promise<StoredVersion> {
  const helper = helperOf(id)
  if (!hasProgram(id, folder)) throw new Error(`There is no ${helper.program} in ${folder}. Pick the folder that has it.`)
  const known = record(id).versions.find((v) => samePath(v.folder, folder))
  if (known) throw new Error(`${folder} is already listed as ${known.label ?? known.id}.`)
  const v = addVersion(id, { tag: null, build: null, label: null, folder, external: true, installedAt: null, checksum: null }, path.basename(folder))
  await verifyVersion(id, v.id)
  return v
}

export async function activate(id: string, version: string, restart: boolean): Promise<void> {
  const v = versionOf(id, version)
  if (!hasProgram(id, v.folder)) throw new Error(`${v.folder} has no ${helperOf(id).program} any more.`)
  change(id, (r) => {
    r.active = v.id
  })
  installEvents.changed(id)
  if (restart) for (const fn of activated.get(id) ?? []) await fn()
}

export function removeVersion(id: string, version: string): void {
  const v = versionOf(id, version)
  if (record(id).active === v.id) throw new Error('This is the active version. Make another one active first.')
  const using = holders(id, v.id)
  if (using.length) throw new Error(`This version is in use by ${using.join(', ')}. Stop it first.`)
  if (!v.external) fs.rmSync(v.folder, { recursive: true, force: true })
  change(id, (r) => {
    r.versions = r.versions.filter((x) => x.id !== v.id)
  })
  forgetCheck(id, v.id)
  installEvents.changed(id)
}
