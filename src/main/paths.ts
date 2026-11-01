import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'

export const defaultDataDir = path.join(os.homedir(), '.seven')
export const vaultsFile = path.join(app.getPath('userData'), 'vaults.json')

export interface VaultsFile {
  current: string
  list: { name: string; path: string }[]
}

export function samePath(a: string, b: string): boolean {
  const x = path.resolve(a)
  const y = path.resolve(b)
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y
}

export function readVaults(): VaultsFile {
  let file: VaultsFile = { current: defaultDataDir, list: [] }
  try {
    const raw = JSON.parse(fs.readFileSync(vaultsFile, 'utf8')) as Partial<VaultsFile>
    const list = (Array.isArray(raw.list) ? raw.list : [])
      .filter((v) => v && typeof v.path === 'string' && v.path.trim() && typeof v.name === 'string')
      .map((v) => ({ name: v.name.trim() || path.basename(v.path), path: path.resolve(v.path) }))
    file = { current: typeof raw.current === 'string' && raw.current.trim() ? path.resolve(raw.current) : defaultDataDir, list }
  } catch {
    file = { current: defaultDataDir, list: [] }
  }
  if (!file.list.length) file.list.push({ name: 'Default', path: defaultDataDir })
  if (!file.list.some((v) => samePath(v.path, file.current))) file.list.push({ name: samePath(file.current, defaultDataDir) ? 'Default' : path.basename(file.current), path: file.current })
  return file
}

function start(): { dir: string; missing: string | null } {
  if (process.env.SEVEN_HOME) return { dir: process.env.SEVEN_HOME, missing: null }
  const current = readVaults().current
  if (samePath(current, defaultDataDir) || fs.existsSync(current)) return { dir: current, missing: null }
  return { dir: defaultDataDir, missing: current }
}

const started = start()

export const dataDir = started.dir
export const missingVault = started.missing
export const pinnedBy = process.env.SEVEN_HOME ? 'SEVEN_HOME' : null
