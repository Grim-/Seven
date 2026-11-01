import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import readline from 'node:readline'
import { finished } from 'node:stream/promises'
import { WINDOW_STATE_FILE } from '@shared/sealed'
import { dataDir } from './paths'

const KEEP = ['settings.json', 'models.json', WINDOW_STATE_FILE]

interface Header {
  seven: 'backup'
  version: 1
  createdAt: number
  encrypted: boolean
}

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(abs, out)
    else if (entry.isFile()) out.push(abs)
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

export async function writeBackup(target: string): Promise<{ files: number; bytes: number }> {
  const files: string[] = []
  walk(dataDir, files)
  const gz = zlib.createGzip()
  const out = fs.createWriteStream(target)
  gz.pipe(out)
  const write = (line: string) => new Promise<void>((resolve) => (gz.write(`${line}\n`) ? resolve() : gz.once('drain', () => resolve())))
  const header: Header = { seven: 'backup', version: 1, createdAt: Date.now(), encrypted: fs.existsSync(path.join(dataDir, 'vault.json')) }
  await write(JSON.stringify(header))
  let bytes = 0
  let count = 0
  for (const abs of files) {
    let data: Buffer
    try {
      data = await fs.promises.readFile(abs)
    } catch {
      continue
    }
    bytes += data.length
    count += 1
    await write(JSON.stringify({ p: path.relative(dataDir, abs).split(path.sep).join('/'), d: data.toString('base64') }))
  }
  gz.end()
  await finished(out)
  return { files: count, bytes }
}

function lines(source: string): readline.Interface {
  return readline.createInterface({ input: fs.createReadStream(source).pipe(zlib.createGunzip()), crlfDelay: Infinity })
}

export async function readHeader(source: string): Promise<Header> {
  const rl = lines(source)
  try {
    for await (const line of rl) {
      const h = JSON.parse(line) as Header
      if (h?.seven !== 'backup' || h.version !== 1) break
      return h
    }
  } catch {
    throw new Error('That is not a Seven backup')
  } finally {
    rl.close()
  }
  throw new Error('That is not a Seven backup')
}

function swap(next: string, label: string): string {
  const aside = `${dataDir}-${label}-${stamp()}`
  if (fs.existsSync(dataDir)) fs.renameSync(dataDir, aside)
  fs.renameSync(next, dataDir)
  return aside
}

export async function restoreInto(source: string, target: string): Promise<void> {
  await readHeader(source)
  const staging = `${target}.restoring`
  fs.rmSync(staging, { recursive: true, force: true })
  fs.mkdirSync(staging, { recursive: true })
  let first = true
  try {
    for await (const line of lines(source)) {
      if (first) {
        first = false
        continue
      }
      if (!line.trim()) continue
      const { p, d } = JSON.parse(line) as { p: string; d: string }
      const file = path.resolve(staging, p)
      if (!file.startsWith(path.resolve(staging) + path.sep)) continue
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, Buffer.from(d, 'base64'))
    }
  } catch (err) {
    fs.rmSync(staging, { recursive: true, force: true })
    throw err
  }
  if (fs.existsSync(target)) fs.rmdirSync(target)
  fs.renameSync(staging, target)
}

export function clearAll(keepSettings: boolean): void {
  const fresh = `${dataDir}.fresh`
  fs.rmSync(fresh, { recursive: true, force: true })
  fs.mkdirSync(fresh, { recursive: true })
  if (keepSettings) for (const name of KEEP) if (fs.existsSync(path.join(dataDir, name))) fs.copyFileSync(path.join(dataDir, name), path.join(fresh, name))
  const aside = swap(fresh, 'cleared')
  fs.rmSync(aside, { recursive: true, force: true })
}
