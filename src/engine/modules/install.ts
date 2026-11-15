import fs from 'node:fs'
import path from 'node:path'
import yauzl, { type Entry as ZipEntry, type ZipFile } from 'yauzl'
import { ID_PATTERN, parseManifest, type Manifest } from './manifest'

const MANIFEST = 'module.json'
const SYMLINK = 0o120000
const TYPE_MASK = 0o170000
const MB = 1024 * 1024

export interface ZipInstallResult {
  installed: string | null
  needsReplace: { id: string; name: string; from: string; to: string } | null
}

function openZip(file: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => yauzl.open(file, { lazyEntries: true, autoClose: false }, (err, zip) => (err || !zip ? reject(err ?? new Error('Could not open the zip.')) : resolve(zip))))
}

function readEntries(zip: ZipFile): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    const out: ZipEntry[] = []
    zip.on('entry', (entry: ZipEntry) => {
      out.push(entry)
      zip.readEntry()
    })
    zip.on('end', () => resolve(out))
    zip.on('error', reject)
    zip.readEntry()
  })
}

function readBuffer(zip: ZipFile, entry: ZipEntry): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) return reject(err ?? new Error(`Could not read ${entry.fileName}.`))
      const parts: Buffer[] = []
      stream.on('data', (c: Buffer) => parts.push(c))
      stream.on('end', () => resolve(Buffer.concat(parts)))
      stream.on('error', reject)
    })
  )
}

function writeEntry(zip: ZipFile, entry: ZipEntry, target: string): Promise<void> {
  return new Promise((resolve, reject) =>
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) return reject(err ?? new Error(`Could not read ${entry.fileName}.`))
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const out = fs.createWriteStream(target)
      stream.on('error', reject)
      out.on('error', reject)
      out.on('finish', () => resolve())
      stream.pipe(out)
    })
  )
}

const isDir = (e: ZipEntry) => e.fileName.endsWith('/')
const isLink = (e: ZipEntry) => ((e.externalFileAttributes >>> 16) & TYPE_MASK) === SYMLINK

function unsafe(name: string): boolean {
  if (name.startsWith('/') || name.startsWith('\\') || /^[a-zA-Z]:/.test(name)) return true
  return name.split(/[\\/]/).some((part) => part === '..')
}

function checkEntries(entries: ZipEntry[], limitMb: number): void {
  const bad = entries.find((e) => unsafe(e.fileName))
  if (bad) throw new Error(`The zip has an unsafe path "${bad.fileName}". Nothing was installed.`)
  const link = entries.find(isLink)
  if (link) throw new Error(`The zip has a link "${link.fileName}". Links are not allowed. Nothing was installed.`)
  const total = entries.reduce((sum, e) => sum + e.uncompressedSize, 0)
  if (total > limitMb * MB) throw new Error(`The zip unpacks to ${Math.ceil(total / MB)} MB, more than the ${limitMb} MB limit set in Tools folders. Nothing was installed.`)
}

function findRoot(entries: ZipEntry[]): string {
  const files = entries.filter((e) => !isDir(e))
  if (files.some((e) => e.fileName === MANIFEST)) return ''
  const tops = new Set(files.map((e) => e.fileName.split('/')[0]))
  const [top] = [...tops]
  if (tops.size === 1 && files.some((e) => e.fileName === `${top}/${MANIFEST}`)) return `${top}/`
  throw new Error(`The zip has no ${MANIFEST} at its top, or inside one single folder at its top. Put the module's files there and zip it again.`)
}

export async function installZip(file: string, toolsFolder: string, limitMb: number, existing: (id: string) => Manifest | null, replace: boolean): Promise<ZipInstallResult> {
  const zip = await openZip(file)
  try {
    const entries = await readEntries(zip)
    checkEntries(entries, limitMb)
    const root = findRoot(entries)
    const manifestEntry = entries.find((e) => e.fileName === `${root}${MANIFEST}`)
    if (!manifestEntry) throw new Error(`The zip has no ${MANIFEST}.`)
    let raw: unknown
    try {
      raw = JSON.parse((await readBuffer(zip, manifestEntry)).toString('utf8'))
    } catch {
      throw new Error(`The zip's ${MANIFEST} is not valid JSON.`)
    }
    const folderName = root ? root.slice(0, -1) : path.basename(file, path.extname(file)).toLowerCase()
    const manifest = parseManifest(raw, ID_PATTERN.test(folderName) ? folderName : 'module', false)
    const old = existing(manifest.id)
    if (old && !replace) return { installed: null, needsReplace: { id: manifest.id, name: old.name, from: old.version, to: manifest.version } }

    const temp = path.join(toolsFolder, `.installing-${manifest.id}`)
    const dest = path.join(toolsFolder, manifest.id)
    fs.rmSync(temp, { recursive: true, force: true })
    fs.mkdirSync(temp, { recursive: true })
    try {
      for (const entry of entries) {
        if (!entry.fileName.startsWith(root) || isDir(entry)) continue
        const target = path.join(temp, entry.fileName.slice(root.length))
        if (!path.resolve(target).startsWith(path.resolve(temp) + path.sep)) throw new Error(`The zip has an unsafe path "${entry.fileName}". Nothing was installed.`)
        await writeEntry(zip, entry, target)
      }
      fs.rmSync(dest, { recursive: true, force: true })
      fs.renameSync(temp, dest)
    } catch (err) {
      fs.rmSync(temp, { recursive: true, force: true })
      throw err
    }
    return { installed: manifest.id, needsReplace: null }
  } finally {
    zip.close()
  }
}
