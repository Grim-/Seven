import fs from 'node:fs'
import path from 'node:path'
import type { VaultList } from '@shared/types'
import { dataDir, pinnedBy, readVaults, samePath, vaultsFile, type VaultsFile } from './paths'
import { restoreInto } from './backup'

const SEVEN_MARKERS = ['settings.json', 'vault.json', 'agents', 'sessions', 'data']

function save(file: VaultsFile): void {
  fs.mkdirSync(path.dirname(vaultsFile), { recursive: true })
  fs.writeFileSync(vaultsFile, JSON.stringify(file, null, 2), 'utf8')
}

function inside(child: string, parent: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

function cleanName(name: string): string {
  const out = name.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!out) throw new Error('Give the vault a name')
  return out
}

function isSeven(dir: string): boolean {
  return SEVEN_MARKERS.some((m) => fs.existsSync(path.join(dir, m)))
}

function isEmpty(dir: string): boolean {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0
}

function checkPlace(file: VaultsFile, dir: string): void {
  for (const v of file.list) {
    if (samePath(v.path, dir)) throw new Error(`That folder is already the vault "${v.name}"`)
    if (inside(dir, v.path)) throw new Error(`That folder is inside the vault "${v.name}". Pick a folder outside it`)
    if (inside(v.path, dir)) throw new Error(`The vault "${v.name}" is inside that folder. Pick a folder that doesn't hold another vault`)
  }
}

export function listVaults(): VaultList {
  const file = readVaults()
  return {
    list: file.list.map((v) => ({ name: v.name, path: v.path, exists: fs.existsSync(v.path), current: samePath(v.path, dataDir) })),
    pinnedBy
  }
}

export function createVault(name: string, dir: string): VaultList {
  const file = readVaults()
  const target = path.resolve(dir)
  checkPlace(file, target)
  if (!isEmpty(target)) throw new Error(isSeven(target) ? 'That folder already holds Seven data. Use Add existing to add it' : 'That folder has other files in it. Pick an empty folder')
  fs.mkdirSync(target, { recursive: true })
  file.list.push({ name: cleanName(name), path: target })
  save(file)
  return listVaults()
}

export function addVault(name: string, dir: string): VaultList {
  const file = readVaults()
  const target = path.resolve(dir)
  checkPlace(file, target)
  if (!fs.existsSync(target)) throw new Error(`Folder not found: ${target}`)
  if (!isSeven(target)) throw new Error("That folder doesn't hold Seven data. Use New vault to start one there")
  file.list.push({ name: cleanName(name || path.basename(target)), path: target })
  save(file)
  return listVaults()
}

export async function restoreVault(source: string, name: string, dir: string): Promise<VaultList> {
  const file = readVaults()
  const target = path.resolve(dir)
  const label = cleanName(name)
  checkPlace(file, target)
  if (!isEmpty(target)) throw new Error('Restore into an empty folder')
  await restoreInto(source, target)
  const after = readVaults()
  after.list.push({ name: label, path: target })
  save(after)
  return listVaults()
}

export function renameVault(dir: string, name: string): VaultList {
  const file = readVaults()
  const entry = file.list.find((v) => samePath(v.path, dir))
  if (!entry) throw new Error('That vault is not in the list')
  entry.name = cleanName(name)
  save(file)
  return listVaults()
}

export function removeVault(dir: string): VaultList {
  if (samePath(dir, dataDir)) throw new Error('This vault is open. Switch to another one first')
  const file = readVaults()
  file.list = file.list.filter((v) => !samePath(v.path, dir))
  if (samePath(file.current, dir)) file.current = dataDir
  save(file)
  return listVaults()
}

export function chooseVault(dir: string): void {
  if (pinnedBy) throw new Error(`The data folder is set by ${pinnedBy}, so vaults can't be switched`)
  const file = readVaults()
  const entry = file.list.find((v) => samePath(v.path, dir))
  if (!entry) throw new Error('That vault is not in the list')
  if (!fs.existsSync(entry.path)) throw new Error(`Folder not found: ${entry.path}`)
  file.current = entry.path
  save(file)
}
