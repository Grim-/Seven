import { fileName, isAssetId } from '@shared/ids'
import fs from 'node:fs'
import path from 'node:path'
import type { AssetKind, AssetMeta, PictureArea } from '@shared/types'
import crypto from 'node:crypto'
import { newId, readJson, removePath, writeJson } from '../util/fs'
import { secure } from '../util/secure'
import { DirIndex } from '../util/dirIndex'
import type { WriteContext } from './pages'
import { DataError } from './validate'

const MAX_ASSET = 500 * 1024 * 1024

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/opus',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  log: 'text/plain',
  json: 'application/json',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  zip: 'application/zip'
}

const CODE = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'cs', 'java', 'kt', 'go', 'rs', 'c', 'h', 'cpp', 'hpp', 'rb', 'php', 'lua', 'sh', 'bash', 'ps1',
  'bat', 'cmd', 'sql', 'css', 'scss', 'yaml', 'yml', 'toml', 'ini', 'json', 'xml', 'html', 'htm', 'swift', 'dart', 'r', 'gd', 'shader', 'hlsl', 'glsl'
])

const TEXT = new Set(['txt', 'md', 'csv', 'log', 'tsv', 'rst', 'cfg', 'conf', 'env'])

export function classify(name: string): { mime: string; kind: AssetKind } {
  const ext = path.extname(name).slice(1).toLowerCase()
  const mime = MIME[ext] ?? (CODE.has(ext) || TEXT.has(ext) ? 'text/plain' : 'application/octet-stream')
  const kind: AssetKind = mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('audio/')
      ? 'audio'
      : mime.startsWith('video/')
        ? 'video'
        : mime === 'application/pdf'
          ? 'pdf'
          : CODE.has(ext)
            ? 'code'
            : TEXT.has(ext)
              ? 'text'
              : 'file'
  return { mime, kind }
}

function safeName(name: string): string {
  return fileName(path.basename(name))
}

const stem = (name: string) => name.replace(/\.[a-z0-9]+$/, '')

export class AssetStore {
  private defaultParent: () => string | null = () => null

  constructor(
    private dir: string,
    private changed: (id: string, meta: AssetMeta | null) => void
  ) {}

  setDefaultParent(fn: () => string | null): void {
    this.defaultParent = fn
  }

  private folder(id: string): string {
    return path.join(this.dir, id)
  }

  metaFile(id: string): string {
    return path.join(this.folder(id), 'meta.json')
  }

  filePath(meta: AssetMeta): string {
    return path.join(this.folder(meta.id), meta.stored ?? meta.file)
  }

  readBytes(meta: AssetMeta): Buffer {
    return secure.readBytes(this.filePath(meta))
  }

  readText(meta: AssetMeta): string {
    return this.readBytes(meta).toString('utf8')
  }

  exists(id: string): boolean {
    return isAssetId(id) && this.metaFor(id) !== null
  }

  private metaIndex: DirIndex<AssetMeta> | null = null

  private get index(): DirIndex<AssetMeta> {
    this.metaIndex ??= new DirIndex(
      'files',
      this.dir,
      (name, isDir) => (isDir && isAssetId(name) ? this.metaFile(name) : null),
      (file) => {
        const meta = readJson<AssetMeta | null>(file, null)
        return meta && typeof meta.file === 'string' ? meta : null
      }
    )
    return this.metaIndex
  }

  private stored(id: string, meta: AssetMeta): boolean {
    return fs.existsSync(path.join(this.folder(id), meta.stored ?? meta.file))
  }

  metaFor(id: string): AssetMeta | null {
    if (!isAssetId(id)) return null
    const meta = this.index.get(this.metaFile(id))
    return meta && this.stored(id, meta) ? { ...meta } : null
  }

  list(): AssetMeta[] {
    return this.index
      .values()
      .filter((v) => this.stored(v.name, v.value))
      .map((v) => ({ ...v.value }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  get(id: string): AssetMeta {
    const meta = this.metaFor(id)
    if (!meta) throw new DataError(`There is no file with id "${id}". Use find with kind file to list the files Seven has.`)
    return meta
  }

  register(source: string, origin: AssetMeta['source'], ctx: WriteContext = {}): AssetMeta {
    const stat = fs.statSync(source, { throwIfNoEntry: false })
    if (!stat || !stat.isFile()) throw new DataError(`${origin.original ?? source} is not a file. Give the path of a file that exists, not a folder.`)
    if (stat.size > MAX_ASSET) throw new DataError(`${origin.original ?? source} is over 500 MB, the most Seven keeps. Use a smaller file.`)
    const fingerprint = `${path.resolve(source)}|${stat.size}|${Math.round(stat.mtimeMs)}`
    const existing = this.list().find((a) => a.fingerprint === fingerprint)
    if (existing) return existing
    return this.add(safeName(source), stat.size, fingerprint, origin, ctx, (target) => secure.copyIn(source, target))
  }

  registerBytes(name: string, bytes: Buffer, origin: AssetMeta['source'], ctx: WriteContext = {}): AssetMeta {
    if (bytes.length > MAX_ASSET) throw new DataError(`${name} is over 500 MB, the most Seven keeps. Use a smaller file.`)
    const fingerprint = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`
    const existing = this.list().find((a) => a.fingerprint === fingerprint)
    if (existing) return existing
    return this.add(safeName(name), bytes.length, fingerprint, origin, ctx, (target) => secure.writeBytes(target, bytes))
  }

  private add(file: string, size: number, fingerprint: string, origin: AssetMeta['source'], ctx: WriteContext, write: (target: string) => void): AssetMeta {
    const id = newId('a').toLowerCase()
    const { mime, kind } = classify(file)
    const parent = this.defaultParent()
    const meta: AssetMeta = { id, name: file, file, mime, kind, size, source: origin, fingerprint, ...(parent ? { parent } : {}), ...(secure.enabled ? { stored: 'blob' } : {}), createdAt: Date.now() }
    const target = this.filePath(meta)
    ctx.checkpoint?.(target, null)
    ctx.checkpoint?.(this.metaFile(id), null)
    write(target)
    writeJson(this.metaFile(id), meta)
    this.changed(id, meta)
    return meta
  }

  setNetwork(id: string, on: boolean): AssetMeta {
    const meta = this.get(id)
    if (meta.mime !== 'text/html') throw new DataError(`${meta.name} is not an HTML page. Only .html files can be allowed to use the network.`)
    const next = { ...meta, network: on }
    writeJson(this.metaFile(id), next)
    this.changed(id, next)
    return next
  }

  describe(id: string, description: string, areas: PictureArea[]): AssetMeta {
    const meta = this.get(id)
    if (areas.length && meta.kind !== 'image') throw new DataError(`${meta.name} is not a picture, so it can't have areas.`)
    const unit = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
    const clean = areas
      .map((a) => ({ id: a.id, name: a.name.trim(), note: a.note.trim(), x: unit(a.x), y: unit(a.y), w: unit(a.w), h: unit(a.h) }))
      .map((a) => ({ ...a, w: Math.min(a.w, 1 - a.x), h: Math.min(a.h, 1 - a.y) }))
    const text = description.trim()
    const next: AssetMeta = { ...meta, description: text || undefined, areas: clean.length ? clean : undefined }
    writeJson(this.metaFile(id), next)
    this.changed(id, next)
    return next
  }

  findByName(ref: string, accept: (a: AssetMeta) => boolean = () => true): AssetMeta | null {
    const want = fileName(ref)
    const list = this.list().filter(accept)
    return list.find((a) => fileName(a.name) === want) ?? list.find((a) => stem(fileName(a.name)) === want) ?? null
  }

  rename(id: string, name: string): AssetMeta {
    const meta = this.get(id)
    if (!name.trim()) throw new DataError('Give the file a name, e.g. notes.txt')
    const ext = /\.[A-Za-z0-9]{1,8}$/.exec(meta.name)?.[0] ?? ''
    const next = { ...meta, name: fileName(ext && !/\.[A-Za-z0-9]{1,8}$/.test(name.trim()) ? `${name.trim()}${ext}` : name) }
    writeJson(this.metaFile(id), next)
    this.changed(id, next)
    return next
  }

  move(id: string, parent: string | null): AssetMeta {
    const next = { ...this.get(id), parent }
    writeJson(this.metaFile(id), next)
    this.changed(id, next)
    return next
  }

  reparent(from: string, to: string | null): void {
    for (const meta of this.list()) if (meta.parent === from) this.move(meta.id, to)
  }

  delete(id: string): boolean {
    this.get(id)
    removePath(this.folder(id))
    this.changed(id, null)
    return true
  }

  idFromPath(abs: string): string | null {
    const rel = path.relative(this.dir, abs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null
    const first = rel.split(path.sep)[0]
    return first && isAssetId(first) ? first : null
  }
}
