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

export async function installStarterPacks(): Promise<{ installed: string[]; skipped: string[]; imported: string[] }> {
  if (secure.enabled && !secure.unlocked) return { installed: [], skipped: [], imported: [] }

  const installedRecord = readJson<Record<string, number>>(TRACKING_FILE, {})
  const installed: string[] = []
  const skipped: string[] = []
  const imported: string[] = []

  for (const filePath of listBundledPacks()) {
    const base = path.basename(filePath)
    if (installedRecord[base]) {
      skipped.push(base)
      continue
    }
    try {
      const result = await portabilityImport({
        source: { path: filePath },
        defaultMode: 'skip',
        keepPicture: false,
        folder: 'Starter packs'
      })
      const hadMissingModule = result.skipped.some((s) => s.reason.startsWith('Missing module'))
      if (hadMissingModule && result.imported.length === 0) {
        skipped.push(base)
        continue
      }
      installedRecord[base] = Date.now()
      installed.push(base)
      for (const item of result.imported) imported.push(item.title)
    } catch (err) {
      if (isVaultLocked(err)) return { installed, skipped, imported }
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

  return { installed, skipped, imported }
}
