import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { pipeline } from 'node:stream/promises'

export async function extractZip(zip: string, pick: (name: string) => string | null, dir: string): Promise<Set<string>> {
  const written = new Set<string>()
  const fd = await fs.promises.open(zip, 'r')
  try {
    const { size } = await fd.stat()
    const tailLength = Math.min(size, 65557)
    const tail = Buffer.alloc(tailLength)
    await fd.read(tail, 0, tailLength, size - tailLength)
    let end = -1
    for (let i = tailLength - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        end = i
        break
      }
    }
    if (end < 0) throw new Error(`${path.basename(zip)} is not a valid archive. Try the download again.`)
    const count = tail.readUInt16LE(end + 10)
    const dirSize = tail.readUInt32LE(end + 12)
    const dirOffset = tail.readUInt32LE(end + 16)
    const central = Buffer.alloc(dirSize)
    await fd.read(central, 0, dirSize, dirOffset)
    let at = 0
    for (let n = 0; n < count; n++) {
      if (central.readUInt32LE(at) !== 0x02014b50) break
      const method = central.readUInt16LE(at + 10)
      const packed = central.readUInt32LE(at + 20)
      const unpacked = central.readUInt32LE(at + 24)
      const nameLength = central.readUInt16LE(at + 28)
      const extraLength = central.readUInt16LE(at + 30)
      const commentLength = central.readUInt16LE(at + 32)
      const local = central.readUInt32LE(at + 42)
      const name = central.toString('utf8', at + 46, at + 46 + nameLength)
      at += 46 + nameLength + extraLength + commentLength
      if (name.endsWith('/')) continue
      const target = pick(name)
      if (!target) continue
      const header = Buffer.alloc(30)
      await fd.read(header, 0, 30, local)
      const start = local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
      const out = path.join(dir, target)
      if (!path.resolve(out).startsWith(path.resolve(dir) + path.sep)) throw new Error(`${name} would unpack outside ${dir}, so the archive was not used.`)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      const part = `${out}.part`
      if (packed === 0) fs.writeFileSync(part, Buffer.alloc(0))
      else {
        const source = fs.createReadStream(zip, { start, end: start + packed - 1 })
        if (method === 8) await pipeline(source, zlib.createInflateRaw(), fs.createWriteStream(part))
        else if (method === 0) await pipeline(source, fs.createWriteStream(part))
        else throw new Error(`${name} uses an unsupported compression method (${method}).`)
      }
      if (fs.statSync(part).size !== unpacked) throw new Error(`${target} came out the wrong size. Try the download again.`)
      fs.renameSync(part, out)
      written.add(name)
    }
  } finally {
    await fd.close()
  }
  return written
}
