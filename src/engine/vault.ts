import fs from 'node:fs'
import path from 'node:path'
import type { VaultStatus } from '@shared/types'
import { isPlainRel, isSealed } from '@shared/sealed'
import { secure } from './util/secure'
import { dataRoot } from './util/paths'
import { readJson, writeJson } from './util/fs'

export function vaultStatus(): VaultStatus {
  return { configured: secure.enabled, unlocked: secure.unlocked }
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.isFile()) out.push(full)
  }
}

function relOf(file: string): string {
  return path.relative(dataRoot, file).split(path.sep).join('/')
}

function sealedAlready(file: string): boolean {
  const fd = fs.openSync(file, 'r')
  try {
    const head = Buffer.alloc(4)
    const n = fs.readSync(fd, head, 0, 4, 0)
    if (file.endsWith('.jsonl')) return n === 0 || head[0] === 0x7e
    return n === 0 || isSealed(head)
  } finally {
    fs.closeSync(fd)
  }
}

function migrateAssets(root: string): number {
  let count = 0
  let dirs: string[] = []
  try {
    dirs = fs.readdirSync(root)
  } catch {
    return 0
  }
  for (const id of dirs) {
    const dir = path.join(root, id)
    const metaFile = path.join(dir, 'meta.json')
    if (!fs.existsSync(metaFile)) continue
    const meta = readJson<{ file: string; stored?: string } | null>(metaFile, null)
    if (!meta) continue
    const physical = path.join(dir, meta.stored ?? meta.file)
    if (meta.stored === 'blob' && fs.existsSync(physical) && sealedAlready(physical)) {
      if (!sealedAlready(metaFile)) writeJson(metaFile, meta)
      continue
    }
    if (!fs.existsSync(physical)) continue
    const blob = path.join(dir, 'blob')
    secure.copyIn(physical, blob)
    if (physical !== blob) fs.rmSync(physical, { force: true })
    writeJson(metaFile, { ...meta, stored: 'blob' })
    count++
  }
  return count
}

export function migrate(): { sealed: number; removed: number } {
  if (!secure.unlocked) throw new Error('Unlock the vault first')
  let sealed = migrateAssets(path.join(dataRoot, 'data', 'assets'))
  let removed = 0
  const files: string[] = []
  walk(dataRoot, files)
  for (const file of files) {
    const rel = relOf(file)
    if (isPlainRel(rel) || rel.startsWith('data/assets/')) continue
    if (file.endsWith('.tmp')) continue
    if (/(^|\/)state\.bin(\.json)?$/.test(rel)) {
      fs.rmSync(file, { force: true })
      removed++
      continue
    }
    if (sealedAlready(file)) continue
    if (file.endsWith('.jsonl')) secure.writeLines(file, secure.readLines(file))
    else secure.writeBytes(file, fs.readFileSync(file))
    sealed++
  }
  return { sealed, removed }
}

export interface FileCheck {
  checked: number
  sealed: number
  plain: number
  failed: { file: string; error: string }[]
}

export function checkFiles(): FileCheck {
  const files: string[] = []
  walk(dataRoot, files)
  const out: FileCheck = { checked: 0, sealed: 0, plain: 0, failed: [] }
  for (const file of files) {
    const rel = relOf(file)
    if (rel.startsWith('tools/') || file.endsWith('.tmp') || rel === 'vault.json') continue
    out.checked++
    try {
      const head = Buffer.alloc(4)
      const fd = fs.openSync(file, 'r')
      const n = fs.readSync(fd, head, 0, 4, 0)
      fs.closeSync(fd)
      if ((n === 4 && isSealed(head)) || (file.endsWith('.jsonl') && head[0] === 0x7e)) out.sealed++
      else out.plain++
      if (file.endsWith('.jsonl')) {
        const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim())
        let bad = 0
        let first = ''
        for (const line of lines) {
          try {
            secure.decodeLine(line)
          } catch (err) {
            bad++
            first ||= err instanceof Error ? err.message : String(err)
          }
        }
        if (bad) out.failed.push({ file: rel, error: `${bad} of ${lines.length} lines unreadable: ${first}` })
        continue
      }
      const bytes = secure.readBytes(file)
      if (file.endsWith('.json')) {
        const text = bytes.toString('utf8')
        try {
          JSON.parse(text)
        } catch (err) {
          out.failed.push({ file: rel, error: `not valid JSON (${err instanceof Error ? err.message : String(err)}), starts with ${JSON.stringify(text.slice(0, 12))}` })
        }
      }
    } catch (err) {
      out.failed.push({ file: rel, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return out
}
