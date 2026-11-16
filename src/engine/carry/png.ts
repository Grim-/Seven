const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface Chunk {
  type: string
  start: number
  end: number
  data: Buffer
}

export function isPng(buf: Buffer): boolean {
  return buf.length > SIGNATURE.length && buf.subarray(0, SIGNATURE.length).equals(SIGNATURE)
}

function chunks(buf: Buffer): Chunk[] {
  if (!isPng(buf)) throw new Error('That file is not a PNG picture')
  const out: Chunk[] = []
  let at = SIGNATURE.length
  while (at + 12 <= buf.length) {
    const length = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    const end = at + 12 + length
    if (end > buf.length) throw new Error('That PNG picture is cut short')
    out.push({ type, start: at, end, data: buf.subarray(at + 8, at + 8 + length) })
    at = end
    if (type === 'IEND') break
  }
  return out
}

export function readChunk(buf: Buffer, type: string): Buffer | null {
  return chunks(buf).find((c) => c.type === type)?.data ?? null
}

export function writeChunk(buf: Buffer, type: string, data: Buffer): Buffer {
  const all = chunks(buf)
  const end = all.find((c) => c.type === 'IEND')
  if (!end) throw new Error('That PNG picture has no end marker')
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const body = Buffer.concat([head.subarray(4), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  const kept = all.filter((c) => c.type !== type && c.type !== 'IEND').map((c) => buf.subarray(c.start, c.end))
  return Buffer.concat([SIGNATURE, ...kept, head.subarray(0, 4), body, crc, buf.subarray(end.start, end.end)])
}
