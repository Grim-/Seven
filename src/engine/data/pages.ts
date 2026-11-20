import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import { referencePattern } from '@shared/text'
import { FOLDER_TYPE, idSegment, stripRef, toId } from '@shared/ids'
import fs from 'node:fs'
import path from 'node:path'
import type { CollectionRecord, CollectionViewKind, FieldChange, FieldDef, FieldType, FieldValue, Page, PageHit, PageMeta, VoiceRef } from '@shared/types'
import { COLLECTION_VIEWS, FIELD_TYPES, cleanVoice, pageKindOf } from '@shared/types'
import { copyPath, readJson, readText, removePath, renamePath, writeJson } from '../util/fs'
import { DirIndex } from '../util/dirIndex'
import { LIMITS } from '../limits'
import { DataError, cleanFields, coerce, compare, matches, slug, validateValues } from './validate'
import { kindFolders } from './kindFolders'
import { scoreDoc } from '../library/query'

export interface WriteContext {
  checkpoint?: (absPath: string, previous: Buffer | null) => void
}

export type PagePack = Pick<Page, 'title' | 'type' | 'body' | 'fields' | 'records' | 'data' | 'image' | 'view' | 'voice'>

interface StoredPage extends Page {
  nextRecord: number
}

export interface QueryOptions {
  where?: Record<string, unknown> | null
  search?: string | null
  sort?: string | null
  descending?: boolean | null
  limit?: number | null
}

export type WriteMode = 'replace' | 'append'

const MAX_RECORDS = 5000
const MAX_BODY = 1_000_000
const DEFAULT_ITEM_FIELDS: FieldDef[] = [
  { name: 'title', type: 'text', options: [], required: false },
  { name: 'done', type: 'boolean', options: [], required: false }
]

function readFile(file: string): Buffer | null {
  try {
    return fs.readFileSync(file)
  } catch (err) {
    noteFailure(err, 'data', 'Could not read a page file')
    return null
  }
}

function fieldsOrNone(input: unknown): FieldDef[] {
  return Array.isArray(input) && input.length === 0 ? [] : cleanFields(input)
}

export function linksIn(body: string): string[] {
  return [...body.matchAll(referencePattern())]
    .filter((m) => m[2].toLowerCase() === 'page')
    .map((m) => m[3].replace(/^"|"$/g, '').trim())
    .filter(Boolean)
}

function summaryOf(body: string): string {
  const line = body
    .split('\n')
    .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
    .find(Boolean)
  return line ? (line.length > 120 ? `${line.slice(0, 117)}...` : line) : ''
}

interface Section {
  start: number
  end: number
  bodyStart: number
}

function findSection(body: string, heading: string): Section | null {
  const wanted = heading.replace(/^#+\s*/, '').trim().toLowerCase()
  const lines = body.split('\n')
  let offset = 0
  let found: { level: number; start: number; bodyStart: number } | null = null
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (m) {
      if (found && m[1].length <= found.level) return { start: found.start, end: offset, bodyStart: found.bodyStart }
      if (!found && m[2].trim().toLowerCase() === wanted) found = { level: m[1].length, start: offset, bodyStart: offset + line.length + 1 }
    }
    offset += line.length + 1
  }
  return found ? { start: found.start, end: body.length, bodyStart: Math.min(found.bodyStart, body.length) } : null
}

export function readSection(body: string, heading: string): string | null {
  const s = findSection(body, heading)
  return s ? body.slice(s.start, s.end).trimEnd() : null
}

export function headingsIn(body: string): string[] {
  return body
    .split('\n')
    .map((l) => /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => `${m[1]} ${m[2]}`)
}

function writeSection(body: string, heading: string, text: string, mode: WriteMode): string {
  const s = findSection(body, heading)
  const clean = text.replace(/^\s+|\s+$/g, '')
  if (!s) {
    const title = heading.replace(/^#+\s*/, '').trim()
    return `${body.replace(/\s+$/, '')}${body.trim() ? '\n\n' : ''}## ${title}\n\n${clean}\n`
  }
  const head = body.slice(s.start, s.bodyStart)
  const current = body.slice(s.bodyStart, s.end).replace(/^\s+|\s+$/g, '')
  const next = mode === 'append' && current.trim() ? `${current}\n\n${clean}` : clean
  const tail = body.slice(s.end)
  return `${body.slice(0, s.start)}${head}${head.endsWith('\n') ? '' : '\n'}\n${next}\n${tail ? `\n${tail.replace(/^\n+/, '')}` : ''}`
}

export interface SinglePage {
  type: string
  label: string
}

export class PageStore {
  private migrated = false
  private idsDone = false
  private aliasCache: Record<string, string> | null = null
  private singles: () => SinglePage[] = () => []
  private ensured = new Set<string>()

  constructor(
    private root: string,
    private assetExists: (id: string) => boolean,
    private changed: (id: string, meta: PageMeta | null) => void
  ) {}

  setSingles(fn: () => SinglePage[]): void {
    this.singles = fn
  }

  private removed: (id: string, up: string | null) => void = () => undefined
  private defaultParent: () => string | null = () => null

  setDefaultParent(fn: () => string | null): void {
    this.defaultParent = fn
  }

  setOnRemove(fn: (id: string, up: string | null) => void): void {
    this.removed = fn
  }

  private ensureSingles(pages: StoredPage[]): void {
    for (const s of this.singles()) {
      if (this.ensured.has(s.type)) continue
      this.ensured.add(s.type)
      if (pages.some((p) => p.type === s.type)) continue
      const base = idSegment(s.label) || 'page'
      let title = base
      for (let i = 2; pages.some((p) => !this.parentOf(p) && idSegment(p.title) === title); i++) title = `${base}_${i}`
      const now = Date.now()
      const id = slug(title)
      const page: StoredPage = { id: pages.some((p) => p.id === id) ? `${id}_${now.toString(36)}` : id, title, type: s.type, image: null, data: null, body: '', fields: [], records: [], nextRecord: 1, view: null, parent: null, version: 0, createdAt: now, updatedAt: now }
      this.save(page, {})
      pages.push(page)
    }
  }

  private get dir(): string {
    return path.join(this.root, 'pages')
  }

  private get aliasFile(): string {
    return path.join(this.dir, '_aliases.json')
  }

  fileFor(id: string): string {
    return path.join(this.dir, `${id}.json`)
  }

  private migrate(): void {
    if (this.migrated) return
    const collections = path.join(this.root, 'collections')
    const notes = path.join(this.root, 'notes')
    if (!fs.existsSync(collections) && !fs.existsSync(notes)) {
      this.migrated = true
      return
    }
    const taken = new Set(fs.existsSync(this.dir) ? fs.readdirSync(this.dir).filter((n) => n.endsWith('.json') && !n.startsWith('_')).map((n) => n.slice(0, -5)) : [])
    const aliases = readJson<Record<string, string>>(this.aliasFile, {})
    const writes: [string, StoredPage][] = []
    if (fs.existsSync(collections)) {
      for (const name of fs.readdirSync(collections)) {
        if (!name.endsWith('.json')) continue
        const c = readJson<Record<string, unknown> | null>(path.join(collections, name), null)
        if (!c || !Array.isArray(c.records) || !Array.isArray(c.fields)) continue
        const id = String(c.id ?? name.slice(0, -5))
        if (taken.has(id)) continue
        taken.add(id)
        writes.push([
          id,
          {
            id,
            title: String(c.name ?? id),
            body: typeof c.description === 'string' && c.description.trim() ? `${c.description.trim()}\n` : '',
            fields: c.fields as FieldDef[],
            records: c.records as CollectionRecord[],
            nextRecord: typeof c.nextRecord === 'number' ? c.nextRecord : (c.records as unknown[]).length + 1,
            type: null,
            image: null,
            data: null,
            view: null,
            parent: null,
            version: typeof c.version === 'number' ? c.version : 1,
            createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
            updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now()
          }
        ])
      }
    }
    if (fs.existsSync(notes)) {
      for (const name of fs.readdirSync(notes)) {
        if (!name.endsWith('.json')) continue
        const original = name.slice(0, -5)
        const meta = readJson<Record<string, unknown> | null>(path.join(notes, name), null)
        const textFile = path.join(notes, `${original}.md`)
        if (!meta || !fs.existsSync(textFile)) continue
        let id = original
        for (let i = 2; taken.has(id); i++) id = `${original}_${i}`
        if (id !== original) aliases[`note:${original}`] = id
        taken.add(id)
        writes.push([
          id,
          {
            id,
            title: String(meta.title ?? original),
            body: readText(textFile),
            fields: [],
            records: [],
            nextRecord: 1,
            type: null,
            image: null,
            data: null,
            view: null,
            parent: null,
            version: typeof meta.version === 'number' ? meta.version : 1,
            createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : Date.now(),
            updatedAt: typeof meta.updatedAt === 'number' ? meta.updatedAt : Date.now()
          }
        ])
      }
    }
    fs.mkdirSync(this.dir, { recursive: true })
    for (const [id, page] of writes) writeJson(this.fileFor(id), page)
    if (Object.keys(aliases).length) writeJson(this.aliasFile, aliases)
    const stamp = Date.now()
    for (const dir of [collections, notes]) {
      if (!fs.existsSync(dir)) continue
      const target = path.join(this.root, `_old-${path.basename(dir)}`)
      renamePath(dir, fs.existsSync(target) ? `${target}-${stamp}` : target)
    }
    this.migrated = true
  }

  private get idsFlag(): string {
    return path.join(this.dir, '_ids.json')
  }

  private migrateIds(): void {
    if (this.idsDone) return
    if (fs.existsSync(this.idsFlag)) {
      this.idsDone = true
      return
    }
    const stamp = Date.now()
    const names = fs.existsSync(this.dir) ? fs.readdirSync(this.dir).filter((n) => n.endsWith('.json') && !n.startsWith('_')) : []
    const pages: StoredPage[] = []
    for (const n of names) {
      const p = this.load(n.slice(0, -5))
      if (p) pages.push(p)
    }
    if (!pages.length) {
      fs.mkdirSync(this.dir, { recursive: true })
      writeJson(this.idsFlag, { version: 1, at: stamp, backup: null })
      this.idsDone = true
      return
    }
    const backup = path.join(this.root, '_backup', `pages-before-ids-${stamp}`)
    copyPath(this.dir, backup)

    const byId = new Map(pages.map((p) => [p.id, p]))
    const up = (p: StoredPage): string | null => (p.parent && p.parent !== p.id && byId.has(p.parent) ? p.parent : null)
    const oldKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    const oldPaths = new Map<string, string>()
    for (const p of pages) {
      const chain: string[] = []
      const seen = new Set<string>()
      for (let at: StoredPage | undefined = p; at && !seen.has(at.id); at = up(at) ? byId.get(up(at)!) : undefined) {
        seen.add(at.id)
        chain.unshift(at.title)
      }
      oldPaths.set(p.id, `/${chain.join('/')}`)
    }
    const oldTitles = new Map(pages.map((p) => [p.id, p.title]))
    const aliases = readJson<Record<string, string>>(this.aliasFile, {})
    const oldFind = (raw: string): string | null => {
      const wanted = raw.trim().replace(/^"|"$/g, '')
      if (!wanted) return null
      if (wanted.startsWith('/')) {
        const key = wanted.split('/').filter(Boolean).map(oldKey).join('/')
        for (const [id, at] of oldPaths) if (at.split('/').filter(Boolean).map(oldKey).join('/') === key) return id
        return null
      }
      if (aliases[wanted] && byId.has(aliases[wanted])) return aliases[wanted]
      const plain = wanted.replace(/^note:/, '')
      if (byId.has(plain)) return plain
      const titled = pages.filter((p) => oldTitles.get(p.id)?.toLowerCase() === plain.toLowerCase())
      if (titled.length === 1) return titled[0].id
      if (titled.length > 1) return null
      return byId.has(slug(plain)) ? slug(plain) : null
    }

    const changed = new Set<string>()
    const made: string[] = []
    for (const p of pages) {
      if (p.parent && !up(p)) {
        p.parent = null
        changed.add(p.id)
      }
    }
    const parents = new Set(pages.map((p) => up(p)).filter((id): id is string => Boolean(id)))
    for (const id of parents) {
      const p = byId.get(id)!
      if (p.type === FOLDER_TYPE) continue
      const empty = !p.type && !p.body.trim() && !p.records.length && !p.fields.length && !p.image && (p.data === null || p.data === undefined)
      if (empty) {
        p.type = FOLDER_TYPE
        p.view = null
        changed.add(p.id)
        continue
      }
      let folderId = `${p.id}_folder`
      for (let i = 2; byId.has(folderId); i++) folderId = `${p.id}_folder_${i}`
      const folder: StoredPage = { id: folderId, title: p.title, type: FOLDER_TYPE, image: null, data: null, body: '', fields: [], records: [], nextRecord: 1, view: null, parent: up(p), version: 0, createdAt: p.createdAt, updatedAt: stamp }
      for (const kid of pages) {
        if (kid.id !== p.id && up(kid) === p.id) {
          kid.parent = folderId
          changed.add(kid.id)
        }
      }
      p.parent = folderId
      changed.add(p.id)
      pages.push(folder)
      byId.set(folderId, folder)
      changed.add(folderId)
      made.push(folderId)
    }

    const groups = new Map<string | null, StoredPage[]>()
    for (const p of pages) groups.set(up(p), [...(groups.get(up(p)) ?? []), p])
    for (const group of groups.values()) {
      const used = new Set<string>()
      for (const p of [...group].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
        const base = idSegment(p.title) || (p.type === FOLDER_TYPE ? 'folder' : 'page')
        let name = base
        for (let i = 2; used.has(name); i++) name = `${base}_${i}`
        used.add(name)
        if (p.title !== name) {
          p.title = name
          changed.add(p.id)
        }
      }
    }

    const newPath = (id: string): string => {
      const chain: string[] = []
      const seen = new Set<string>()
      for (let at = byId.get(id); at && !seen.has(at.id); at = up(at) ? byId.get(up(at)!) : undefined) {
        seen.add(at.id)
        chain.unshift(at.title)
      }
      return chain.join('/')
    }
    const relink = (text: string): string =>
      text.replace(referencePattern(), (whole, lead: string, kind: string, ref: string, part: string | undefined) => {
        const tail = part ? `#${part}` : ''
        if (kind.toLowerCase() === 'page') {
          const target = oldFind(ref)
          if (!target) return whole
          return `${lead}@${byId.get(target)?.type === FOLDER_TYPE ? 'folder' : 'page'}:${newPath(target)}${tail}`
        }
        const id = toId(ref)
        return id && id !== ref ? `${lead}@${kind.toLowerCase()}:${id}${tail}` : whole
      })
    for (const p of pages) {
      const body = relink(p.body)
      if (body !== p.body) {
        p.body = body
        changed.add(p.id)
      }
      for (const r of p.records) {
        for (const [key, value] of Object.entries(r.values)) {
          if (typeof value !== 'string') continue
          const next = relink(value)
          if (next !== value) {
            r.values[key] = next
            changed.add(p.id)
          }
        }
      }
    }

    const counts = new Map<string, number>()
    const wanted: [string, string][] = []
    for (const p of pages) {
      if (p.type === FOLDER_TYPE || made.includes(p.id)) continue
      const now = newPath(p.id)
      for (const key of new Set([toId(oldTitles.get(p.id) ?? ''), toId(oldPaths.get(p.id) ?? '')])) {
        if (!key || key === now) continue
        counts.set(key, (counts.get(key) ?? 0) + 1)
        wanted.push([key, p.id])
      }
    }
    for (const [key, id] of wanted) if (counts.get(key) === 1 && !aliases[key]) aliases[key] = id

    const report = pages.map((p) => ({ id: p.id, before: oldPaths.get(p.id) ?? null, after: newPath(p.id), type: p.type ?? null }))
    for (const id of changed) writeJson(this.fileFor(id), byId.get(id)!)
    if (Object.keys(aliases).length) writeJson(this.aliasFile, aliases)
    this.aliasCache = null
    const after = fs.readdirSync(this.dir).filter((n) => n.endsWith('.json') && !n.startsWith('_')).length
    const wrong = [...changed].filter((id) => {
      const saved = this.load(id)
      const p = byId.get(id)!
      return !saved || saved.title !== p.title || (saved.parent ?? null) !== (p.parent ?? null)
    })
    if (after !== names.length + made.length || wrong.length) {
      throw new Error(`Seven could not finish renaming pages to the new ids (${after} page files where ${names.length + made.length} were expected${wrong.length ? `; ${wrong.length} did not save` : ''}). Your pages from before are kept in ${backup}. Restart Seven to try again.`)
    }
    writeJson(path.join(backup, '_report.json'), report)
    writeJson(this.idsFlag, { version: 1, at: stamp, backup, folders: made.length, changed: changed.size })
    this.idsDone = true
  }

  private pageIndex: DirIndex<{ page: StoredPage; meta: PageMeta }> | null = null
  private metaMemo: { items: unknown; list: PageMeta[] } | null = null

  private get index(): DirIndex<{ page: StoredPage; meta: PageMeta }> {
    this.pageIndex ??= new DirIndex(
      'pages',
      this.dir,
      (name, isDir) => (!isDir && name.endsWith('.json') && !name.startsWith('_') ? path.join(this.dir, name) : null),
      (file) => {
        const data = readJson<StoredPage | null>(file, null)
        if (!data || !Array.isArray(data.records) || !Array.isArray(data.fields) || typeof data.body !== 'string') return null
        return { page: data, meta: this.metaWith(data, data.parent ?? null) }
      }
    )
    return this.pageIndex
  }

  private load(id: string): StoredPage | null {
    const hit = this.index.get(this.fileFor(id))
    return hit ? structuredClone(hit.page) : null
  }

  private parentOf(data: Page): string | null {
    const parent = data.parent
    return parent && parent !== data.id && fs.existsSync(this.fileFor(parent)) ? parent : null
  }

  private checkParent(id: string, parent: string | null): void {
    if (!parent) return
    const seen = new Set<string>()
    for (let at: string | null = parent; at && !seen.has(at); at = this.load(at)?.parent ?? null) {
      if (at === id) throw new DataError(parent === id ? "A page can't go under itself. Pick another page to put it under, or move it to the top level." : "A page can't go under a page that's under it. Move that page out first, or pick another page to put it under.")
      seen.add(at)
    }
  }

  private meta(data: Page): PageMeta {
    return this.metaWith(data, this.parentOf(data))
  }

  private metaWith(data: Page, parent: string | null): PageMeta {
    return {
      id: data.id,
      title: data.title,
      type: data.type ?? null,
      image: data.image ?? null,
      voice: data.voice ?? null,
      summary: summaryOf(data.body),
      fields: data.fields,
      view: data.view ?? null,
      parent,
      count: data.records.length,
      size: data.body.length,
      version: data.version,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    }
  }

  private strip(data: StoredPage): Page {
    const { nextRecord: _n, ...rest } = data
    return { ...rest, view: rest.view ?? null, type: rest.type ?? null, image: rest.image ?? null, voice: rest.voice ?? null, data: rest.data ?? null, parent: this.parentOf(rest) }
  }

  private save(data: StoredPage, ctx: WriteContext): void {
    if (data.body.length > MAX_BODY) throw new DataError('That page would be over 1 MB of text. Make the text shorter, or split it across several pages.')
    const file = this.fileFor(data.id)
    ctx.checkpoint?.(file, readFile(file))
    data.version += 1
    data.updatedAt = Date.now()
    fs.mkdirSync(this.dir, { recursive: true })
    writeJson(file, data)
    this.changed(data.id, this.meta(data))
  }

  private all(): StoredPage[] {
    this.migrate()
    this.migrateIds()
    if (!fs.existsSync(this.dir)) return []
    const out = this.index.values().map((v) => v.value.page)
    try {
      this.ensureSingles(out)
    } catch (err) {
      noteFailure(err, 'data', 'Could not set up the single pages')
      this.ensured.clear()
    }
    return out
  }

  list(): PageMeta[] {
    this.all()
    const items = this.index.values()
    if (this.metaMemo?.items !== items) {
      const ids = new Set(items.map((v) => v.value.page.id))
      const list = items
        .map(({ value: { page, meta } }) => ({ ...meta, parent: page.parent && page.parent !== page.id && ids.has(page.parent) ? page.parent : null }))
        .sort((a, b) => a.title.localeCompare(b.title))
      this.metaMemo = { items, list }
    }
    return [...this.metaMemo.list]
  }

  tree(): PageTree {
    return new PageTree(this.list())
  }

  pathOf(id: string): string {
    return this.tree().pathOf(id)
  }

  under(parent: string | null): PageMeta[] {
    return this.tree().under(parent)
  }

  findPath(path: string): PageMeta | null {
    return this.tree().at(toId(path))
  }

  private aliases(): Record<string, string> {
    if (!this.aliasCache) this.aliasCache = readJson<Record<string, string>>(this.aliasFile, {})
    return this.aliasCache
  }

  find(ref: string, accept: (p: PageMeta) => boolean = () => true): PageMeta | null {
    const raw = stripRef(ref ?? '')
    if (!raw) return null
    const rawLower = raw.toLowerCase()
    const list = this.list()
    const id = toId(raw)
    const byPath = id ? new PageTree(list).at(id) : null
    if (byPath && accept(byPath)) return byPath
    const byId =
      list.find((p) => p.id === raw && accept(p)) ??
      list.find((p) => (p.id.toLowerCase() === rawLower || (id !== '' && (p.id === id || toId(p.id) === id))) && accept(p))
    if (byId) return byId
    const aliases = this.aliases()
    const alias = aliases[raw] ?? aliases[rawLower] ?? aliases[id]
    if (alias) {
      const aliased = list.find((p) => p.id === alias && accept(p))
      if (aliased) return aliased
    }
    if (!raw.includes('/') && id) {
      const byTitle = list.find((p) => idSegment(p.title) === id && accept(p))
      if (byTitle) return byTitle
      const compact = id.replace(/[_.-]+/g, '')
      if (compact) {
        const byCompact = list.find((p) => (idSegment(p.id).replace(/[_.-]+/g, '') === compact || idSegment(p.title).replace(/[_.-]+/g, '') === compact) && accept(p))
        if (byCompact) return byCompact
      }
    }
    return null
  }

  named(ref: string): PageMeta[] {
    return this.tree().named(ref)
  }

  refFor(id: string): string {
    return this.tree().pathOf(id)
  }

  taken(title: string, parent: string | null, except: string | null = null): PageMeta | null {
    return this.tree().taken(title, parent, except)
  }

  private checkName(title: string, parent: string | null, except: string | null): void {
    const tree = this.tree()
    const clash = tree.taken(title, parent, except)
    if (clash) throw new DataError(`${pageKindOf(clash.type)} ${tree.pathOf(clash.id)} already exists. Pick another id.`)
  }

  close(ref: string): string[] {
    const id = toId(ref)
    const want = id.split('/').pop() ?? ''
    if (!want) return []
    const tree = this.tree()
    return tree.list
      .map((p) => {
        const name = idSegment(p.title)
        const at = tree.pathOf(p.id)
        let score = 0
        if (name === want) score = 3
        else if (want.length >= 3 && name.length >= 3 && (name.includes(want) || want.includes(name))) score = 2
        else if (distance(name, want) <= Math.max(1, Math.floor(want.length / 4))) score = 2
        if (score && id.includes('/') && at.startsWith(id.split('/')[0])) score += 1
        return { p, at, score }
      })
      .filter((x) => x.score > 0 && x.at !== id)
      .sort((a, b) => b.score - a.score || a.at.length - b.at.length)
      .slice(0, LIMITS.closeMatches)
      .map((x) => `${pageKindOf(x.p.type)} ${x.at}`)
  }

  missing(ref: string, what: string): string {
    const id = toId(ref)
    const tree = this.tree()
    const hit = id ? tree.at(id) : null
    if (hit) {
      const kind = pageKindOf(hit.type)
      return `${id} is a ${kind}, not a ${what}. read_kind(${kind}, ${id}) reads it.`
    }
    const near = this.close(ref)
    if (near.length) return `No ${what} ${id || ref.trim()}. Close: ${near.join(', ')}.`
    const parts = id.split('/')
    let folder = ''
    for (let i = parts.length - 1; i > 0; i--) {
      const at = tree.at(parts.slice(0, i).join('/'))
      if (at && at.type === FOLDER_TYPE) {
        folder = parts.slice(0, i).join('/')
        break
      }
    }
    return `No ${what} ${id || ref.trim()}. read_kind(folder, ${folder || '/'}) lists what ${folder || 'the top level'} holds.`
  }

  resolve(ref: string, accept?: (p: PageMeta) => boolean, what = 'page'): string {
    const found = this.find(ref, accept)
    if (found) return found.id
    throw notFound(new DataError(this.missing(ref, what)))
  }

  private require(ref: string): StoredPage {
    const id = this.resolve(ref)
    const data = this.load(id)
    if (!data) throw new DataError(`Page "${ref}" could not be read; its saved file may be damaged. Use another page, or make a new one.`)
    return data
  }

  get(ref: string): Page {
    return this.strip(this.require(ref))
  }

  metaFor(id: string): PageMeta | null {
    const hit = this.index.get(this.fileFor(id))
    return hit ? this.meta(hit.page) : null
  }

  folderOf(ref: string | null): string | null {
    if (!ref || !toId(ref)) return null
    const found = this.find(ref)
    if (!found) throw notFound(new DataError(this.missing(ref, 'folder')))
    if (found.type !== FOLDER_TYPE) throw new DataError(`${this.pathOf(found.id)} is a ${pageKindOf(found.type)}, not a folder. Pick a folder to put it in.`)
    return found.id
  }

  makeFolders(path: string, ctx: WriteContext = {}, base: string | null = null): string | null {
    let parent: string | null = base
    let at = ''
    for (const part of toId(path).split('/').filter(Boolean)) {
      at = at ? `${at}/${part}` : part
      const hit = this.tree().under(parent).find((p) => idSegment(p.title) === part)
      if (hit) {
        if (hit.type !== FOLDER_TYPE) throw new DataError(`${at} is a ${pageKindOf(hit.type)}, not a folder. Pick a path whose folders are folders.`)
        parent = hit.id
        continue
      }
      parent = this.create({ title: part, type: FOLDER_TYPE, parent }, ctx).id
    }
    return parent
  }

  create(input: { title: string; body?: string | null; fields?: unknown; type?: string | null; data?: unknown; parent?: string | null }, ctx: WriteContext = {}): Page {
    const path = (input.title ?? '').split('/').map(idSegment).filter(Boolean)
    if (path.length > 1) {
      const folder = this.makeFolders(path.slice(0, -1).join('/'), ctx, input.parent === undefined ? null : this.folderOf(input.parent))
      return this.create({ ...input, title: path[path.length - 1], parent: folder }, ctx)
    }
    const title = path[0] ?? ''
    if (!title) throw new DataError('An id needs letters or numbers.')
    if (input.type === FOLDER_TYPE && input.body?.trim()) throw new DataError('A folder holds no text. Put the text in a page inside it.')
    let resolvedParent: string | null
    if (input.parent !== undefined && input.parent !== null) {
      resolvedParent = this.folderOf(input.parent)
    } else if (input.type && input.type !== FOLDER_TYPE) {
      const configured = kindFolders.forKind(pageKindOf(input.type))
      resolvedParent = configured ? this.makeFolders(configured, ctx) : this.folderOf(input.parent === undefined ? this.defaultParent() : null)
    } else {
      resolvedParent = this.folderOf(input.parent === undefined ? this.defaultParent() : input.parent)
    }
    const parent = resolvedParent
    this.checkName(title, parent, null)
    const now = Date.now()
    const id = slug(title) || 'page'
    const data: StoredPage = {
      id: this.list().some((p) => p.id === id) ? `${id}_${now.toString(36)}` : id,
      title,
      body: input.body ?? '',
      fields: fieldsOrNone(input.fields ?? []),
      records: [],
      nextRecord: 1,
      type: input.type ?? null,
      image: null,
      data: input.data ?? null,
      view: null,
      parent,
      version: 0,
      createdAt: now,
      updatedAt: now
    }
    this.save(data, ctx)
    return this.strip(data)
  }

  put(input: PagePack, target: { replace: string | null; parent: string | null }, ctx: WriteContext = {}): Page {
    const fields = fieldsOrNone(input.fields ?? [])
    const records: CollectionRecord[] = (Array.isArray(input.records) ? input.records : []).map((r, i) => ({
      id: typeof r?.id === 'string' && /^r\d+$/.test(r.id) ? r.id : `r${i + 1}`,
      values: validateValues(fields, r?.values, { partial: false, label: `Item ${i + 1}`, assetExists: this.assetExists }),
      createdAt: typeof r?.createdAt === 'number' ? r.createdAt : Date.now(),
      updatedAt: typeof r?.updatedAt === 'number' ? r.updatedAt : Date.now()
    }))
    if (input.image && !this.assetExists(input.image)) throw new DataError(`The picture of ${input.title} did not come with it.`)
    const data = target.replace ? this.require(target.replace) : this.require(this.create({ title: input.title, type: input.type, parent: target.parent }, ctx).id)
    data.body = input.body ?? ''
    data.fields = fields
    data.records = records.map((r) => ({ ...r, values: this.complete({ ...data, fields }, r.values) }))
    data.nextRecord = records.reduce((n, r) => Math.max(n, Number(r.id.slice(1)) + 1), 1)
    data.type = input.type ?? null
    data.data = JSON.parse(JSON.stringify(input.data ?? null))
    data.image = input.image ?? null
    data.view = input.view && COLLECTION_VIEWS.includes(input.view) ? input.view : null
    data.voice = cleanVoice(input.voice ?? null)
    this.save(data, ctx)
    return this.strip(data)
  }

  write(input: { ref: string; title?: string | null; body?: string | null; mode?: WriteMode; section?: string | null; parent?: string | null }, ctx: WriteContext = {}): Page {
    const found = this.find(input.ref)
    if (!found) return this.create({ title: input.title?.trim() || input.ref, body: input.section ? writeSection('', input.section, input.body ?? '', 'replace') : (input.body ?? ''), parent: input.parent ?? null }, ctx)
    const data = this.require(found.id)
    const title = input.title ? idSegment(input.title) : ''
    if (input.title && !title) throw new DataError('An id needs letters or numbers.')
    if (input.parent !== undefined) {
      const parent = this.folderOf(input.parent)
      this.checkParent(data.id, parent)
      this.checkName(title || data.title, parent, data.id)
      data.parent = parent
    }
    if (title && title !== data.title) {
      this.checkName(title, data.parent && fs.existsSync(this.fileFor(data.parent)) ? data.parent : null, data.id)
      data.title = title
    }
    if (typeof input.body === 'string') {
      if (data.type === FOLDER_TYPE) throw new DataError(`${this.pathOf(data.id)} is a folder, so it holds no text. Put the text in a page inside it.`)
      const mode = input.mode ?? 'replace'
      if (input.section) data.body = writeSection(data.body, input.section, input.body, mode)
      else if (mode === 'append' && data.body.trim()) data.body = `${data.body.replace(/\s+$/, '')}\n\n${input.body.replace(/^\s+/, '')}`
      else data.body = input.body
    }
    this.save(data, ctx)
    return this.strip(data)
  }

  relocate(ref: string, to: string, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    const parts = toId(to).split('/').filter(Boolean)
    const title = parts.pop()
    if (!title) throw new DataError('Give the new id, e.g. recipes/pancakes.')
    const parent = parts.length ? this.makeFolders(parts.join('/'), ctx) : null
    this.checkParent(data.id, parent)
    this.checkName(title, parent, data.id)
    data.title = title
    data.parent = parent
    this.save(data, ctx)
    return this.strip(data)
  }

  setData(ref: string, value: unknown, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    const json = JSON.stringify(value ?? null)
    if (json.length > MAX_BODY) throw new DataError('That page data would be over 1 MB. Store less in it, or split it across several pages.')
    data.data = JSON.parse(json)
    this.save(data, ctx)
    return this.strip(data)
  }

  retype(ref: string, type: string | null, value: unknown, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    data.type = type
    data.data = JSON.parse(JSON.stringify(value ?? null))
    this.save(data, ctx)
    return this.strip(data)
  }

  ofType(type: string): PageMeta[] {
    return this.list().filter((p) => p.type === type)
  }

  setImage(ref: string, image: string | null, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    if (image && !this.assetExists(image)) throw new DataError(`There is no file with id "${image}". Give the id of a picture Seven has (show gives each file an id), or no picture.`)
    data.image = image
    this.save(data, ctx)
    return this.strip(data)
  }

  setVoice(ref: string, voice: VoiceRef | null, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    data.voice = cleanVoice(voice)
    this.save(data, ctx)
    return this.strip(data)
  }

  setView(ref: string, view: CollectionViewKind | null, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    if (view && !COLLECTION_VIEWS.includes(view)) throw new DataError(`view must be one of ${COLLECTION_VIEWS.join(', ')}`)
    data.view = view
    this.save(data, ctx)
    return this.strip(data)
  }

  private complete(data: Page, values: Record<string, FieldValue>): Record<string, FieldValue> {
    const out: Record<string, FieldValue> = {}
    for (const f of data.fields) out[f.name] = values[f.name] ?? (f.type === 'tags' ? [] : f.type === 'boolean' ? false : null)
    return out
  }

  addRecords(ref: string, inputs: unknown[], ctx: WriteContext = {}, at: number | null = null): CollectionRecord[] {
    const data = this.require(ref)
    if (!Array.isArray(inputs) || inputs.length === 0) throw new DataError('Give at least one item to add')
    if (data.records.length + inputs.length > MAX_RECORDS) throw new DataError(`A page holds at most ${MAX_RECORDS} items. Remove some items first, or put these on another page.`)
    if (!data.fields.length) data.fields = DEFAULT_ITEM_FIELDS.map((f) => ({ ...f }))
    const now = Date.now()
    const values = inputs.map((input, i) =>
      validateValues(data.fields, input, { partial: false, label: inputs.length > 1 ? `Item ${i + 1}` : 'Item', assetExists: this.assetExists })
    )
    const added = values.map((v) => ({ id: `r${data.nextRecord++}`, values: this.complete(data, v), createdAt: now, updatedAt: now }))
    const index = at === null ? data.records.length : Math.max(0, Math.min(at, data.records.length))
    data.records.splice(index, 0, ...added)
    this.save(data, ctx)
    return added
  }

  updateRecords(ref: string, updates: { id: string; values: unknown }[], ctx: WriteContext = {}): CollectionRecord[] {
    const data = this.require(ref)
    if (!Array.isArray(updates) || updates.length === 0) throw new DataError('Give at least one item to update')
    const missing = updates.map((u) => u?.id).filter((id) => !data.records.some((r) => r.id === id))
    if (missing.length) throw new DataError(`No items with id ${missing.map((m) => `"${m}"`).join(', ')} in "${data.title}". read lists item ids.`)
    const now = Date.now()
    const changes = updates.map((u) => ({ id: u.id, values: validateValues(data.fields, u.values, { partial: true, label: `Item ${u.id}`, assetExists: this.assetExists }) }))
    const updated: CollectionRecord[] = []
    for (const change of changes) {
      const record = data.records.find((r) => r.id === change.id)!
      record.values = { ...record.values, ...change.values }
      record.updatedAt = now
      updated.push(record)
    }
    this.save(data, ctx)
    return updated
  }

  moveRecord(ref: string, id: string, to: number, ctx: WriteContext = {}): void {
    const data = this.require(ref)
    const from = data.records.findIndex((r) => r.id === id)
    if (from === -1) throw new DataError(`No item "${id}" in "${data.title}"`)
    const [record] = data.records.splice(from, 1)
    data.records.splice(Math.max(0, Math.min(to, data.records.length)), 0, record)
    this.save(data, ctx)
  }

  deleteRecords(ref: string, ids: string[], ctx: WriteContext = {}): string[] {
    const data = this.require(ref)
    const missing = ids.filter((id) => !data.records.some((r) => r.id === id))
    if (missing.length) throw new DataError(`No items with id ${missing.map((m) => `"${m}"`).join(', ')} in "${data.title}". read lists item ids.`)
    const wanted = new Set(ids)
    data.records = data.records.filter((r) => !wanted.has(r.id))
    this.save(data, ctx)
    return ids
  }

  editFields(ref: string, changes: FieldChange[] | null, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    let fields: FieldDef[] = data.fields.map((f) => ({ ...f, options: [...f.options] }))
    const records = data.records.map((r) => ({ ...r, values: { ...r.values } }))
    const find = (name: string) => fields.find((f) => f.name.toLowerCase() === (name ?? '').trim().toLowerCase())

    ;(changes ?? []).forEach((change, i) => {
      const label = `Change ${i + 1} (${change?.action ?? '?'} "${change?.field ?? ''}")`
      const fail = (message: string): never => {
        throw new DataError(`${label}: ${message}`)
      }
      const fieldName = (change?.field ?? '').trim()
      switch (change?.action) {
        case 'add': {
          if (find(fieldName)) fail('a field with that name already exists. Change that field instead, or pick another name.')
          const type = (change.type ?? 'text') as FieldType
          if (!FIELD_TYPES.includes(type)) fail(`type must be one of ${FIELD_TYPES.join(', ')}`)
          const field: FieldDef = { name: fieldName, type, options: type === 'select' ? [...new Set((change.options ?? []).map((o) => o.trim()).filter(Boolean))] : [], required: change.required === true }
          if (field.required && records.length) fail('a new field can only be required while the page has no items. Add it as not required, fill it in, then make it required.')
          fields.push(field)
          for (const r of records) r.values[field.name] = type === 'tags' ? [] : type === 'boolean' ? false : null
          return
        }
        case 'rename': {
          const field = find(fieldName) ?? fail(`there is no field "${fieldName}". Fields: ${fields.map((f) => f.name).join(', ') || 'none'}`)
          const next = (change.newName ?? '').trim()
          if (!next) fail('give the field its new name in rename')
          const clash = find(next)
          if (clash && clash !== field) fail(`there is already a field named "${next}". Pick another name.`)
          for (const r of records) {
            const value = r.values[field.name]
            delete r.values[field.name]
            r.values[next] = value ?? null
          }
          field.name = next
          return
        }
        case 'remove': {
          const field = find(fieldName) ?? fail(`there is no field "${fieldName}". Fields: ${fields.map((f) => f.name).join(', ') || 'none'}`)
          if (fields.length === 1 && records.length) fail('the last field can only be removed once the page has no items. Remove the items first, or keep this field.')
          fields = fields.filter((f) => f !== field)
          for (const r of records) delete r.values[field.name]
          return
        }
        case 'update': {
          const field = find(fieldName) ?? fail(`there is no field "${fieldName}". Fields: ${fields.map((f) => f.name).join(', ') || 'none'}`)
          const type = (change.type ?? field.type) as FieldType
          if (!FIELD_TYPES.includes(type)) fail(`type must be one of ${FIELD_TYPES.join(', ')}`)
          const options = type === 'select' ? [...new Set((change.options ?? (field.type === 'select' ? field.options : [])).map((o) => o.trim()).filter(Boolean))] : []
          if (type === 'select' && !options.length) fail('a select field needs options, e.g. low, medium, high')
          const next: FieldDef = { name: field.name, type, options, required: change.required ?? field.required }
          const problems: string[] = []
          for (const r of records) {
            const value = r.values[field.name]
            if (value === null || value === undefined || (Array.isArray(value) && !value.length)) {
              if (next.required) problems.push(`${r.id} is empty`)
              r.values[field.name] = type === 'tags' ? [] : type === 'boolean' ? false : null
              continue
            }
            try {
              const raw = field.type === 'tags' && type !== 'tags' && Array.isArray(value) ? value.join(', ') : value
              r.values[field.name] = coerce(next, raw, this.assetExists)
            } catch (err) {
              problems.push(`${r.id} has ${JSON.stringify(value)} (${err instanceof Error ? err.message : String(err)})`)
            }
          }
          if (problems.length) fail(`existing items don't fit: ${problems.slice(0, 8).join('; ')}${problems.length > 8 ? `; and ${problems.length - 8} more` : ''}. Fix those items first.`)
          Object.assign(field, next)
          return
        }
        default:
          fail('action must be add, rename, remove or update')
      }
    })

    data.fields = fieldsOrNone(fields)
    data.records = records
    this.save(data, ctx)
    return this.strip(data)
  }

  move(ref: string, parentRef: string | null, ctx: WriteContext = {}): Page {
    const data = this.require(ref)
    const parent = this.folderOf(parentRef)
    this.checkParent(data.id, parent)
    this.checkName(data.title, parent, data.id)
    data.parent = parent
    this.save(data, ctx)
    return this.strip(data)
  }

  children(id: string): PageMeta[] {
    return this.list().filter((p) => p.parent === id)
  }

  delete(ref: string, ctx: WriteContext = {}): boolean {
    const id = this.resolve(ref)
    const gone = this.load(id)
    const up = gone ? this.parentOf(gone) : null
    for (const child of this.all()) {
      if (child.parent !== id) continue
      this.save({ ...structuredClone(child), parent: up }, ctx)
    }
    const file = this.fileFor(id)
    ctx.checkpoint?.(file, readFile(file))
    removePath(file)
    this.removed(id, up)
    this.changed(id, null)
    return true
  }

  query(ref: string, options: QueryOptions = {}): { page: Page; records: CollectionRecord[]; total: number } {
    const data = this.strip(this.require(ref))
    const byName = new Map(data.fields.map((f) => [f.name.toLowerCase(), f]))
    let records = data.records
    if (options.where && typeof options.where === 'object') {
      for (const [key, wanted] of Object.entries(options.where)) {
        if (key === 'id') {
          records = records.filter((r) => r.id === String(wanted))
          continue
        }
        const field = byName.get(key.toLowerCase())
        if (!field) throw new DataError(`"${key}" is not a field of "${data.title}". Filter on one of: ${[...data.fields.map((f) => f.name), 'id'].join(', ')}`)
        records = records.filter((r) => matches(field, r.values[field.name], wanted))
      }
    }
    if (options.search && options.search.trim()) {
      const needle = options.search.trim().toLowerCase()
      records = records.filter((r) => Object.values(r.values).some((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase().includes(needle)))
    }
    if (options.sort) {
      const field = byName.get(options.sort.toLowerCase())
      if (!field) throw new DataError(`"${options.sort}" is not a field of "${data.title}". Sort by one of: ${data.fields.map((f) => f.name).join(', ')}`)
      records = [...records].sort((a, b) => compare(a.values[field.name], b.values[field.name]))
      if (options.descending) records.reverse()
    }
    const total = records.length
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 500) : 100
    return { page: data, records: records.slice(0, limit), total }
  }

  search(text: string, limit = 20, filter?: (page: Page) => boolean): PageHit[] {
    const trimmed = text.trim()
    const pages = filter ? this.all().filter(filter) : this.all()
    if (!trimmed) return pages.slice(0, limit).map((p) => ({ id: p.id, title: p.title, snippet: summaryOf(p.body) }))
    const hits: (PageHit & { score: number })[] = []
    for (const p of pages) {
      const pathStr = this.pathOf(p.id)
      const fields = [
        ...(pathStr && pathStr !== p.title ? [{ name: 'Path', value: pathStr }] : []),
        { name: 'Id', value: p.id },
        ...p.records.flatMap((r) =>
          Object.entries(r.values).map(([name, v]) => ({
            name,
            value: Array.isArray(v) ? v.join(' ') : String(v ?? '')
          }))
        )
      ]
      const matched = scoreDoc(trimmed, { title: p.title, labels: ['page', 'pages'], fields, body: p.body })
      if (!matched) continue
      hits.push({ id: p.id, title: p.title, snippet: matched.snippet || summaryOf(p.body), score: matched.score })
    }
    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _s, ...h }) => h)
  }

  backlinks(ref: string): { id: string; title: string }[] {
    const target = this.require(ref)
    const names = new Set([target.id, this.pathOf(target.id)])
    return this.all()
      .filter((p) => p.id !== target.id && linksIn(p.body).some((l) => names.has(l) || names.has(toId(l))))
      .map((p) => ({ id: p.id, title: p.title }))
  }

  idFromPath(abs: string): string | null {
    const rel = path.relative(this.dir, abs)
    if (rel.startsWith('..') || path.isAbsolute(rel) || !rel.endsWith('.json') || rel.includes(path.sep) || rel.startsWith('_')) return null
    return rel.slice(0, -5)
  }
}

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = row
  }
  return prev[b.length]
}

export class PageTree {
  private byId: Map<string, PageMeta>
  private kids: Map<string | null, PageMeta[]> | null = null

  constructor(readonly list: PageMeta[]) {
    this.byId = new Map(list.map((p) => [p.id, p]))
  }

  private parentOf(p: PageMeta): string | null {
    return p.parent && p.parent !== p.id && this.byId.has(p.parent) ? p.parent : null
  }

  under(parent: string | null): PageMeta[] {
    if (!this.kids) {
      this.kids = new Map()
      for (const p of this.list) {
        const key = this.parentOf(p)
        const list = this.kids.get(key) ?? []
        list.push(p)
        this.kids.set(key, list)
      }
      for (const list of this.kids.values()) list.sort((a, b) => Number(b.type === FOLDER_TYPE) - Number(a.type === FOLDER_TYPE) || a.title.localeCompare(b.title))
    }
    return this.kids.get(parent) ?? []
  }

  pathOf(id: string): string {
    const chain: string[] = []
    const seen = new Set<string>()
    for (let at: string | null = id; at && !seen.has(at); ) {
      seen.add(at)
      const p = this.byId.get(at)
      if (!p) break
      chain.unshift(idSegment(p.title) || p.title)
      at = this.parentOf(p)
    }
    return chain.join('/') || id
  }

  at(id: string): PageMeta | null {
    return this.walk(id).hit
  }

  walk(path: string): { hit: PageMeta | null; reached: PageMeta | null; missing: string | null } {
    let reached: PageMeta | null = null
    for (const part of toId(path).split('/').filter(Boolean)) {
      const next = this.under(reached ? reached.id : null).find((p) => idSegment(p.title) === part)
      if (!next) return { hit: null, reached, missing: part }
      reached = next
    }
    return { hit: reached, reached, missing: null }
  }

  named(ref: string): PageMeta[] {
    const wanted = toId(ref).split('/').pop() ?? ''
    return this.list.filter((p) => idSegment(p.title) === wanted)
  }

  refFor(id: string): string {
    return this.pathOf(id)
  }

  taken(title: string, parent: string | null, except: string | null = null): PageMeta | null {
    const wanted = idSegment(title)
    return this.under(parent).find((p) => p.id !== except && idSegment(p.title) === wanted) ?? null
  }
}
