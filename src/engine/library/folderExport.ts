import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import { referencePattern } from '@shared/text'
import type { AssetMeta } from '@shared/types'
import { data } from '../data/hub'
import { writeUserFile } from '../util/fs'
import { tags as tagStore } from './tags'
import { USER, entriesTagged, resolveEntry, type Kind, kindNamed } from './kinds'

export type ExportTarget = 'obsidian' | 'markdown'

export interface FolderExportInput {
  entries: string[]
  kind: string | null
  tag: string | null
  target: ExportTarget
  dir: string
}

export interface FolderExportResult {
  folder: string
  files: number
  attachments: number
  skipped: string[]
}

interface Item {
  kind: Kind
  id: string
  title: string
  rel: string
}


function safeName(name: string): string {
  const out = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 120)
  return out || 'Untitled'
}

function stamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`
}

function unique(base: string, taken: Set<string>, ext: string): string {
  let name = `${base}${ext}`
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`
  taken.add(name.toLowerCase())
  return name
}

function relLink(from: string, to: string): string {
  const rel = path.posix.relative(path.posix.dirname(from), to)
  return rel
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/')
}

function collect(input: FolderExportInput): { items: Item[]; skipped: string[] } {
  const skipped: string[] = []
  const byKey = new Map<string, { kind: Kind; id: string }>()
  const add = (kind: Kind, id: string) => byKey.set(`${kind.kind}/${id}`, { kind, id })
  for (const entry of input.entries) {
    try {
      const { kind, id } = resolveEntry(entry, null, USER)
      add(kind, id)
    } catch {
      skipped.push(entry)
    }
  }
  if (input.kind) {
    const kind = kindNamed(input.kind)
    if (!kind) throw new Error(`No kind ${input.kind}`)
    for (const h of kind.search('', 100_000, USER)) if (!kind.isGenerated?.(h.id)) add(kind, h.id)
  }
  if (input.tag) for (const h of entriesTagged(input.tag)) add(h.kind, h.id)
  const takenByFolder = new Map<string, Set<string>>()
  const items: Item[] = []
  for (const { kind, id } of byKey.values()) {
    const asset = kind.asset?.(id) ?? null
    if (!kind.exportable && !asset) {
      skipped.push(`${kind.label}: ${kind.title(id)}`)
      continue
    }
    const title = kind.title(id)
    const folder = kind.exportAtRoot ? '' : safeName(kind.plural)
    const taken = takenByFolder.get(folder) ?? new Set<string>()
    takenByFolder.set(folder, taken)
    const ext = asset ? path.extname(asset.name) : '.md'
    const base = asset ? safeName(path.basename(asset.name, ext)) : safeName(title)
    const name = unique(base, taken, ext)
    items.push({ kind, id, title, rel: folder ? `${folder}/${name}` : name })
  }
  return { items, skipped }
}

class Writer {
  private attachments = new Map<string, string>()
  private taken = new Set<string>()
  count = 0

  constructor(
    private root: string,
    private items: Item[],
    private target: ExportTarget
  ) {}

  private find(kind: string, id: string): Item | undefined {
    return this.items.find((i) => i.kind.kind === kind && i.id === id)
  }

  attachment(meta: AssetMeta): string {
    const exported = this.items.find((i) => i.kind.asset?.(i.id)?.id === meta.id)
    if (exported) return exported.rel
    const known = this.attachments.get(meta.id)
    if (known) return known
    const ext = path.extname(meta.name)
    const name = unique(safeName(path.basename(meta.name, ext)), this.taken, ext)
    const rel = `attachments/${name}`
    writeUserFile(path.join(this.root, rel), data.assets.readBytes(meta))
    this.attachments.set(meta.id, rel)
    this.count += 1
    return rel
  }

  private fileRef(from: string, meta: AssetMeta, embed: boolean): string {
    const rel = this.attachment(meta)
    if (this.target === 'obsidian') return `${embed ? '!' : ''}[[${path.posix.basename(rel)}]]`
    return `${embed ? '!' : ''}[${meta.name.replace(/[[\]]/g, '')}](${relLink(from, rel)})`
  }

  private entryRef(from: string, item: Item, label: string): string {
    const noExt = item.rel.replace(/\.md$/, '')
    if (this.target === 'obsidian') {
      const target = path.posix.basename(noExt) === label ? noExt : `${noExt}|${label}`
      return `[[${target}]]`
    }
    return `[${label.replace(/[[\]]/g, '')}](${relLink(from, item.rel)})`
  }

  private resolve(kindName: string, ref: string): { item?: Item; title: string; asset?: AssetMeta } | null {
    try {
      const { kind, id } = resolveEntry(`${kindName}/${ref}`, null, USER)
      const asset = kind.asset?.(id) ?? undefined
      return { item: this.find(kind.kind, id), title: kind.title(id), asset }
    } catch (err) {
      noteFailure(err, 'export', 'Could not read an entry to export')
      return null
    }
  }

  rewrite(from: string, markdown: string): string {
    let out = markdown.replace(/(!?)\[([^\]]*)\]\(seven:([a-z][\w.-]*)\/([^)\s]+)\)/gi, (whole, bang: string, label: string, kind: string, raw: string) => {
      const found = this.resolve(kind, decodeURIComponent(raw))
      if (!found) return label || whole
      if (found.asset) return this.fileRef(from, found.asset, bang === '!')
      return found.item ? this.entryRef(from, found.item, label || found.title) : label || found.title
    })
    out = out.replace(referencePattern(), (_m, lead: string, kind: string, ref: string) => {
      const found = this.resolve(kind, ref.replace(/^"|"$/g, ''))
      if (!found) return `${lead}${ref.replace(/^"|"$/g, '')}`
      if (found.asset) return lead + this.fileRef(from, found.asset, false)
      return lead + (found.item ? this.entryRef(from, found.item, found.title) : found.title)
    })
    return out
  }
}

function frontmatter(item: Item): string {
  const lines = [`kind: ${item.kind.kind}`]
  const t = tagStore.of(item.kind.kind, item.id)
  if (t.length) lines.push(`tags: [${t.map((x) => JSON.stringify(x)).join(', ')}]`)
  const meta = item.kind.pageTypes ? data.pages.metaFor(item.id) : null
  if (meta) lines.push(`created: ${new Date(meta.createdAt).toISOString()}`, `updated: ${new Date(meta.updatedAt).toISOString()}`)
  return `---\n${lines.join('\n')}\n---\n\n`
}

export function exportToFolder(input: FolderExportInput): FolderExportResult {
  if (!input.dir || !fs.existsSync(input.dir)) throw new Error('Pick a folder to export into')
  const { items, skipped } = collect(input)
  if (!items.length) throw new Error('Nothing to export. Pick other entries, or a kind or tag that has entries in it.')
  const root = path.join(input.dir, `Seven export ${stamp()}`)
  if (fs.existsSync(root)) throw new Error(`${root} already exists. Wait a minute and export again, or pick another folder.`)
  fs.mkdirSync(root, { recursive: true })
  const writer = new Writer(root, items, input.target)
  let files = 0
  for (const item of items) {
    const file = path.join(root, item.rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const asset = item.kind.asset?.(item.id)
    if (asset) {
      writeUserFile(file, data.assets.readBytes(asset))
      files += 1
      continue
    }
    let markdown: string
    try {
      markdown = item.kind.card(item.id, USER)
    } catch {
      skipped.push(`${item.kind.label}: ${item.title}`)
      continue
    }
    const page = item.kind.pageTypes && data.pages.metaFor(item.id) ? data.pages.get(item.id) : null
    const picture = page?.image ? data.assets.metaFor(page.image) : null
    let body = writer.rewrite(item.rel, markdown)
    if (picture) {
      const ref = input.target === 'obsidian' ? `![[${path.posix.basename(writer.attachment(picture))}]]` : `![${picture.name}](${relLink(item.rel, writer.attachment(picture))})`
      body = body.replace(/^(# .*\n)/, `$1\n${ref}\n`)
    }
    writeUserFile(file, `${input.target === 'obsidian' ? frontmatter(item) : ''}${body.trim()}\n`)
    files += 1
  }
  return { folder: root, files, attachments: writer.count, skipped }
}
