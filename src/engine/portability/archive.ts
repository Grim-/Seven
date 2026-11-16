import path from 'node:path'
import zlib from 'node:zlib'
import yauzl, { type Entry as ZipEntry, type ZipFile } from 'yauzl'
import { sanitizeFileName } from '@shared/portability'
import { crc32 } from '../carry/png'

const SYMLINK = 0o120000
const TYPE_MASK = 0o170000
const UTF8_FLAG = 0x0800
const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50

export interface ArchiveFileInput {
  name: string
  data: Buffer
  compress?: boolean
}

function dosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  const d = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const t = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
  return { time: t, date: d }
}

function normalizeZipPath(name: string): string {
  return name.replace(/\\/g, '/').replace(/^\/+/, '')
}

function isSafeRelSegments(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.endsWith('/') || /^[a-zA-Z]:/.test(rel) || rel.includes('\0')) return false
  return rel.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
}

function assertSafeZipPath(raw: string): string {
  const err = yauzl.validateFileName(raw)
  if (err) throw new Error(`Unsafe archive path "${raw}": ${err}`)
  const normalized = normalizeZipPath(raw)
  if (!isSafeRelSegments(normalized)) {
    throw new Error(`Rejected unsafe path in bundle: ${raw}`)
  }
  return normalized
}

export function writeZipArchive(entries: ArchiveFileInput[]): Buffer {
  const { time, date } = dosDateTime()
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const cleanName = assertSafeZipPath(entry.name)
    const nameBuf = Buffer.from(cleanName, 'utf8')
    const raw = entry.data
    const crc = crc32(raw)
    const wantCompress = entry.compress !== false && raw.length > 64
    const deflated = wantCompress ? zlib.deflateRawSync(raw) : raw
    const compressed = wantCompress && deflated.length < raw.length
    const method = compressed ? 8 : 0
    const body = compressed ? deflated : raw

    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(LOCAL_SIG, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_FLAG, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc >>> 0, 14)
    local.writeUInt32LE(body.length >>> 0, 18)
    local.writeUInt32LE(raw.length >>> 0, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    nameBuf.copy(local, 30)

    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(CENTRAL_SIG, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(UTF8_FLAG, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc >>> 0, 16)
    central.writeUInt32LE(body.length >>> 0, 20)
    central.writeUInt32LE(raw.length >>> 0, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset >>> 0, 42)
    nameBuf.copy(central, 46)

    localParts.push(local, body)
    centralParts.push(central)
    offset += local.length + body.length
  }

  const centralDir = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(EOCD_SIG, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralDir.length >>> 0, 12)
  eocd.writeUInt32LE(offset >>> 0, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDir, eocd])
}

function openZip(source: string | Buffer): Promise<ZipFile> {
  if (typeof source === 'string') {
    return new Promise((resolve, reject) =>
      yauzl.open(source, { lazyEntries: true, autoClose: false }, (err, zip) =>
        err || !zip ? reject(err ?? new Error('Could not open the bundle archive.')) : resolve(zip)
      )
    )
  }
  return new Promise((resolve, reject) =>
    yauzl.fromBuffer(source, { lazyEntries: true, autoClose: false }, (err, zip) =>
      err || !zip ? reject(err ?? new Error('Could not read the bundle archive.')) : resolve(zip)
    )
  )
}

function readZipStream(zip: ZipFile, entry: ZipEntry, remainingBudget: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) return reject(err ?? new Error(`Could not read ${entry.fileName}.`))
      const chunks: Buffer[] = []
      let seen = 0
      stream.on('data', (chunk: Buffer) => {
        seen += chunk.length
        if (seen > remainingBudget) {
          stream.destroy(new Error('Bundle exceeds the maximum unpack size configured in Settings.'))
          return
        }
        chunks.push(chunk)
      })
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  )
}

const isDir = (e: ZipEntry) => e.fileName.endsWith('/')
const isLink = (e: ZipEntry) => ((e.externalFileAttributes >>> 16) & TYPE_MASK) === SYMLINK

export async function readZipArchive(source: string | Buffer, maxBytes: number): Promise<Map<string, Buffer>> {
  const zip = await openZip(source)
  const files = new Map<string, Buffer>()
  let total = 0
  try {
    const entries = await new Promise<ZipEntry[]>((resolve, reject) => {
      const list: ZipEntry[] = []
      zip.on('entry', (e: ZipEntry) => {
        list.push(e)
        zip.readEntry()
      })
      zip.on('end', () => resolve(list))
      zip.on('error', reject)
      zip.readEntry()
    })
    for (const entry of entries) {
      if (isDir(entry)) continue
      if (isLink(entry)) throw new Error(`Symlinks are not allowed inside a bundle (${entry.fileName}).`)
      const rel = assertSafeZipPath(entry.fileName)
      if (entry.uncompressedSize > maxBytes - total) {
        throw new Error('Bundle exceeds the maximum unpack size configured in Settings.')
      }
      const data = await readZipStream(zip, entry, maxBytes - total)
      total += data.length
      files.set(rel, data)
    }
    return files
  } finally {
    zip.close()
  }
}

export function bundleAssetPath(id: string, name: string): string {
  const ext = path.posix.extname(name)
  const base = sanitizeFileName(path.posix.basename(name, ext), 'file')
  const safeId = sanitizeFileName(id, 'asset')
  return `assets/${safeId}/${base}${ext}`
}
