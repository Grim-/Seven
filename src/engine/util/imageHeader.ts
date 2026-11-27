export interface RasterHeader {
  format: string
  width: number
  height: number
}

interface RasterReader {
  format: string
  matches(b: Buffer): boolean
  size(b: Buffer): { width: number; height: number } | null
}

const starts = (b: Buffer, ascii: string, at = 0) => b.length >= at + ascii.length && b.toString('latin1', at, at + ascii.length) === ascii

const PNG: RasterReader = {
  format: 'png',
  matches: (b) => b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && starts(b, 'IHDR', 12),
  size: (b) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) })
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

const JPEG: RasterReader = {
  format: 'jpeg',
  matches: (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8,
  size: (b) => {
    let at = 2
    while (at + 9 < b.length) {
      if (b[at] !== 0xff) {
        at++
        continue
      }
      const marker = b[at + 1]
      if (SOF.has(marker)) return { height: b.readUInt16BE(at + 5), width: b.readUInt16BE(at + 7) }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
        at += marker === 0xff ? 1 : 2
        continue
      }
      at += 2 + b.readUInt16BE(at + 2)
    }
    return null
  }
}

const WEBP: RasterReader = {
  format: 'webp',
  matches: (b) => b.length >= 30 && starts(b, 'RIFF') && starts(b, 'WEBP', 8),
  size: (b) => {
    if (starts(b, 'VP8 ', 12)) return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
    if (starts(b, 'VP8L', 12)) return { width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) }
    if (starts(b, 'VP8X', 12)) return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    return null
  }
}

const GIF: RasterReader = {
  format: 'gif',
  matches: (b) => b.length >= 10 && (starts(b, 'GIF87a') || starts(b, 'GIF89a')),
  size: (b) => ({ width: b.readUInt16LE(6), height: b.readUInt16LE(8) })
}

const READERS = [PNG, JPEG, WEBP, GIF]

export function rasterHeader(bytes: Buffer): RasterHeader | null {
  const reader = READERS.find((r) => r.matches(bytes))
  const size = reader?.size(bytes) ?? null
  return reader && size && size.width > 0 && size.height > 0 ? { format: reader.format, ...size } : null
}

const FONT_MAGIC = ['wOF2', 'wOFF', 'OTTO', 'true', '\u0000\u0001\u0000\u0000']

export function isFontFile(bytes: Buffer): boolean {
  return FONT_MAGIC.some((m) => starts(bytes, m))
}
