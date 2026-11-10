import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export interface ResumableOptions {
  size: number
  what: string
  signal: AbortSignal
  headers?: Record<string, string>
  onBytes: (delta: number) => void
}

export function sizeOn(file: string): number {
  try {
    return fs.statSync(file).size
  } catch {
    return 0
  }
}

export function partOf(target: string): string {
  return `${target}.part`
}

export async function fetchResumable(url: string, target: string, o: ResumableOptions): Promise<void> {
  if (sizeOn(target) === o.size) return
  const part = partOf(target)
  let from = Math.min(sizeOn(part), o.size)
  if (from < o.size) {
    const res = await fetch(url, { headers: { ...o.headers, ...(from > 0 ? { Range: `bytes=${from}-` } : {}) }, signal: o.signal })
    if (!res.ok || !res.body) throw new Error(`Downloading ${o.what} failed: the server answered ${res.status}.`)
    if (from > 0 && res.status !== 206) {
      o.onBytes(-from)
      from = 0
    }
    fs.mkdirSync(path.dirname(part), { recursive: true })
    const count = new Transform({
      transform(chunk: Buffer, _enc, done) {
        o.onBytes(chunk.length)
        done(null, chunk)
      }
    })
    await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), count, fs.createWriteStream(part, { flags: from > 0 ? 'a' : 'w' }), { signal: o.signal })
  }
  if (sizeOn(part) !== o.size) throw new Error(`${o.what} came out the wrong size. Try again to resume it.`)
  fs.renameSync(part, target)
}

export async function sha256Of(file: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}
