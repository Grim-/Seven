import fs from 'node:fs'
import path from 'node:path'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { noteFailure } from '../util/report'
import { secure } from '../util/secure'
import { isVaultLocked } from '@shared/sealed'
import { appFolder } from '../install/paths'
import { portabilityImport } from './index'

const TRACKING_FILE = path.join(dataRoot, 'starter-packs.json')

function packsDirs(): string[] {
  const dirs = [
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'packs') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'resources', 'packs') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'packs') : '',
    path.join(appFolder(), 'resources', 'packs'),
    path.join(process.cwd(), 'resources', 'packs')
  ].filter(Boolean)
  return [...new Set(dirs.filter((d) => fs.existsSync(d)))]
}

export function listBundledPacks(): string[] {
  const files: string[] = []
  for (const dir of packsDirs()) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const lower = entry.name.toLowerCase()
      if (lower.endsWith('.sevenpack') || lower.endsWith('.png') || lower.endsWith('.json')) {
        files.push(path.join(dir, entry.name))
      }
    }
  }
  return files
}

export async function installStarterPacks(): Promise<{ installed: string[]; skipped: string[] }> {
  if (secure.enabled && !secure.unlocked) return { installed: [], skipped: [] }

  const installedRecord = readJson<Record<string, number>>(TRACKING_FILE, {})
  const installed: string[] = []
  const skipped: string[] = []

  for (const filePath of listBundledPacks()) {
    const base = path.basename(filePath)
    if (installedRecord[base]) {
      skipped.push(base)
      continue
    }
    try {
      await portabilityImport({
        source: { path: filePath },
        defaultMode: 'copy',
        keepPicture: false
      })
      installedRecord[base] = Date.now()
      installed.push(base)
    } catch (err) {
      if (isVaultLocked(err)) return { installed, skipped }
      noteFailure(err, 'portability', `Could not install starter pack "${base}"`)
    }
  }

  if (installed.length) {
    try {
      writeJson(TRACKING_FILE, installedRecord)
    } catch (err) {
      if (!isVaultLocked(err)) noteFailure(err, 'portability', 'Could not record installed starter packs')
    }
  }

  return { installed, skipped }
}
