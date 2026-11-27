import path from 'node:path'
import type { ConversionChoices, ConversionRunResult, PendingConversion } from '@shared/conversions'
import { isVaultLocked } from '@shared/sealed'
import { writeZipArchive, type ArchiveFileInput } from '../portability/archive'
import { ToolError } from '../tools/types'
import { readJson, writeJson, writeUserFile } from '../util/fs'
import { dataRoot } from '../util/paths'
import { noteFailure, reportError } from '../util/report'
import { secure } from '../util/secure'
import { conversionById, registeredConversions, type ConversionSpec } from './registry'

interface ConversionStamp {
  id: string
  completedAt: number
}

type ConversionLedger = Record<string, ConversionStamp>

const LEDGER_FILE = path.join(dataRoot, 'conversions.json')

const vaultLockedNow = (): boolean => Boolean(secure.keys && !secure.keys.privateKey)

function readLedger(): ConversionLedger {
  try {
    const raw = readJson<Record<string, unknown>>(LEDGER_FILE, {})
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: ConversionLedger = {}
    for (const [domain, val] of Object.entries(raw)) {
      if (val && typeof val === 'object' && typeof (val as ConversionStamp).id === 'string') {
        out[domain] = {
          id: (val as ConversionStamp).id,
          completedAt: typeof (val as ConversionStamp).completedAt === 'number' ? (val as ConversionStamp).completedAt : 0
        }
      }
    }
    return out
  } catch (err) {
    if (!isVaultLocked(err)) noteFailure(err, 'conversions', 'Could not read conversion ledger')
    return {}
  }
}

function writeLedger(ledger: ConversionLedger): void {
  writeJson(LEDGER_FILE, ledger)
}

function assertExternalZipTarget(targetPath: string): string {
  const trimmed = targetPath.trim()
  if (!trimmed) throw new ToolError('Choose where to save the backup file.')
  const resolved = path.resolve(trimmed)
  const resolvedData = path.resolve(dataRoot)
  const rel = path.relative(resolvedData, resolved)
  if (!rel || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new ToolError('Save the backup outside Seven’s live data folder.')
  }
  return resolved.toLowerCase().endsWith('.zip') ? resolved : `${resolved}.zip`
}

export function pendingConversions(domain?: string | null): PendingConversion[] {
  if (vaultLockedNow()) return []
  const ledger = readLedger()
  let ledgerChanged = false
  const vaultEncrypted = Boolean(secure.keys)
  const specs = domain
    ? registeredConversions().filter((s) => s.domain === domain || s.id === domain)
    : registeredConversions()

  const pending: PendingConversion[] = []
  for (const spec of specs) {
    try {
      const inspection = spec.inspect()
      if (!inspection) {
        if (ledger[spec.domain]?.id !== spec.id) {
          ledger[spec.domain] = { id: spec.id, completedAt: Date.now() }
          ledgerChanged = true
        }
        continue
      }
      pending.push({
        id: spec.id,
        domain: spec.domain,
        title: spec.title,
        description: spec.description,
        affects: inspection.affects,
        ...(inspection.options?.length ? { options: inspection.options } : {}),
        ...(inspection.decisions?.length ? { decisions: inspection.decisions } : {}),
        ...(spec.blocking ? { blocking: true } : {}),
        vaultEncrypted
      })
    } catch (err) {
      if (!isVaultLocked(err)) reportError('error', 'conversions', err, `Could not inspect converter "${spec.id}"`)
    }
  }

  if (ledgerChanged) {
    try {
      writeLedger(ledger)
    } catch (err) {
      noteFailure(err, 'conversions', 'Could not stamp conversion ledger')
    }
  }

  return pending
}

function resolveSpecs(ids: string[]): ConversionSpec[] {
  const specs = ids.map((id) => conversionById(id)).filter((s): s is ConversionSpec => Boolean(s))
  if (!specs.length) throw new ToolError('No matching data conversions were found.')
  return specs
}

export function backupConversions(ids: string[], targetPath: string): { files: number; bytes: number } {
  if (vaultLockedNow()) throw new ToolError('Unlock the vault before saving a conversion backup.')
  const dest = assertExternalZipTarget(targetPath)
  const specs = resolveSpecs(ids)
  const byName = new Map<string, ArchiveFileInput>()

  for (const spec of specs) {
    for (const file of spec.collectBackup()) {
      const cleanName = file.name.replace(/\\/g, '/').replace(/^\/+/, '')
      if (cleanName && !byName.has(cleanName)) {
        byName.set(cleanName, { ...file, name: cleanName })
      }
    }
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    conversions: specs.map((s) => ({ id: s.id, domain: s.domain, title: s.title })),
    files: [...byName.keys()]
  }
  const entries: ArchiveFileInput[] = [
    {
      name: 'conversion-manifest.json',
      data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
    },
    ...byName.values()
  ]

  const archive = writeZipArchive(entries)
  writeUserFile(dest, archive)
  return { files: byName.size, bytes: archive.byteLength }
}

export function runConversions(ids: string[], choices: ConversionChoices = {}): ConversionRunResult {
  if (vaultLockedNow()) throw new ToolError('Unlock the vault before converting data.')
  const specs = resolveSpecs(ids)
  const ledger = readLedger()
  const completed: string[] = []
  const summary: string[] = []

  for (const spec of specs) {
    const inspection = spec.inspect()
    if (!inspection) {
      ledger[spec.domain] = { id: spec.id, completedAt: Date.now() }
      continue
    }
    const specChoices = choices[spec.id] ?? {}
    if (inspection.decisions?.some((d) => d.required && !(specChoices[d.key]?.length))) {
      throw new ToolError(`Choose a destination for every required item in "${spec.title}".`)
    }
    try {
      const res = spec.apply(specChoices)
      ledger[spec.domain] = { id: spec.id, completedAt: Date.now() }
      completed.push(spec.id)
      summary.push(res?.summary ?? spec.title)
    } catch (err) {
      reportError('error', 'conversions', err, `Conversion "${spec.id}" failed`)
      throw err
    }
  }

  writeLedger(ledger)
  return { completed, summary }
}
