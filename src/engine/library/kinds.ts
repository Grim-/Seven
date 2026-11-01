import { linkFor, splitLink, withoutTitle } from '@shared/text'
import { FOLDER_TYPE, ROOT_FOLDER, stripRef, toId } from '@shared/ids'
import { REPO_TYPES, drawRepo, findRepo, getRepo, repoIds, repoMarkdown, rollRepo } from './repos'
import { attachedText, isTextAsset } from '../../modules/core/files'
import { whoIsHere } from '../worlds/presence'
import { SHEET_TYPE, findSheet, getSheet, sheetIds, sheetLine, sheetMarkdown } from './sheets'
import { findSlideshow, getSlideshow, slideshowIds, slideshowText } from './slideshows'
import { SLIDESHOW_TYPE } from '@shared/slideshow'
import { customCommands } from '../commands/custom'
import fs from 'node:fs'
import { DEFAULT_LIBRARY_ACCESS, pageKindOf, type KindFlags, type KindInfo, type Thought, type ChatMessage, type LibraryAccess, type LibraryHit, type LibrarySection, type Page, type PageMeta, type WebLogEntry } from '@shared/types'
import { readLines } from '../util/fs'
import { minds } from '../mind/store'
import { styles } from '../mind/styles'
import { scripts } from '../python/scripts'
import { WEB_LOG } from '../weblog'
import { storyRuns, type StoryRun } from '../stories'
import { chatExport, pageExport, type Exported } from './exporters'
import { themes } from '../themes/store'
import type { Theme } from '@shared/theme'
import { PLACE_TYPE, PLACE_TYPE_KEY, plainValue, type WorldChange, type WorldType } from '@shared/world'
import { fieldText, resolveIncludes } from './includes'
import { layerNames, mapObjects, placePath, placeRef, placeTree, type MapData, type PlaceNode } from '@shared/maps'
import { maps } from '../maps/store'
import { mapListing, removeMap } from '../maps/usage'
import { agentAccess } from '../agents/access'
import { sessionAccess } from '../sessions/access'
import { data } from '../data/hub'
import MiniSearch from 'minisearch'
import type { PageTree } from '../data/pages'
import { modules } from '../modules/registry'
import { skills } from '../skills'
import { reminders } from '../reminders/store'
import { worlds } from '../worlds/store'
import { recall } from '../worlds/ops'
import { EXERCISE, WORKOUT, cleanExercise, cleanWorkout, workout } from '../workout/store'
import { widgetLine } from '../present/places'
import type { AssetMeta, Dashboard, EntryPreview, EntryViewData, ViewRef, WidgetSource, WorkoutPageType } from '@shared/types'
import { ToolError } from '../tools/types'
import { commandsFor, findCommand } from '../commands/registry'
import { cleanTag, splitTags, tags as tagStore } from './tags'
import { timeline } from '../timeline/store'
import { routines } from '../routines/store'
import { ROUTINE_REPEATS, type Routine } from '@shared/routines'
import { board } from '../board/store'
import { filePacking, folderPacking, freeName, pagePacking, storePacking, type EntryRef, type Unpack } from './packing'
import type { AgentDraft } from '@shared/types'
import { moduleKinds } from './moduleKinds'
import type { ExportSection } from '../exporting/registry'
import type { EntryCtx } from '../exporting/entry'
import type { ExportPreset } from '@shared/exporting'
import { PAGE_HAND_TO } from '../exporting/pages'
import { SHEET_HAND_TO } from '../exporting/sheets'
import { setWidgetKinds, type KindWidget } from '../data/widgetSources'
import { PAGE_WIDGET } from './pageWidget'
import { FILE_WIDGET } from './fileWidget'
import { dayKey, type TimelineEvent, type TimelineRow } from '@shared/timeline'

export type Hit = LibraryHit
export type KindHit = Omit<Hit, 'summary'>

export interface KindField {
  name: string
  text: string
}

export interface ReadOptions {
  part?: string | null
}

export interface KindContext {
  agentId: string | null
  user?: boolean
}

export const USER: KindContext = { agentId: null, user: true }


export interface KindHandTo {
  sections?: () => ExportSection<EntryCtx>[]
  presets?: (ctx: EntryCtx) => ExportPreset[]
  answer?: (ctx: EntryCtx) => string
}

export interface Kind {
  kind: string
  label: string
  plural: string
  icon: string
  description: string
  parts: string[]
  exportable: boolean
  export?(id: string, ctx: KindContext): Exported
  textParts?: string[]
  readView?(id: string, options: ReadOptions, ctx: KindContext): { text: string; view?: ViewRef }
  place?(id: string, part: string | null, onBoard: boolean): WidgetSource | null
  presents?: { chat?: boolean; widget?: KindWidget }
  actions: string[]
  available(ctx: KindContext): boolean
  search(query: string, limit: number, ctx: KindContext): KindHit[]
  resolve(ref: string, ctx: KindContext): string | null
  line(id: string, ctx: KindContext): string
  card(id: string, ctx: KindContext): string
  full(id: string, options: ReadOptions, ctx: KindContext): string
  handTo?: KindHandTo
  fields?(id: string, ctx: KindContext): KindField[]
  title(id: string): string
  defaultPart?(id: string): string
  source?: string
  family?: string
  worldType?: string
  group: string
  remove?(id: string, ctx: KindContext): void
  rename?(id: string, name: string, ctx: KindContext): void
  roll?(id: string): string
  draw?(id: string, count: number): string[]
  linkParts?: { name: string; description: string }[]
  isGenerated?(id: string): boolean
  root?: string
  resolveOnly?: boolean
  missing?(ref: string): string
  readFull?(id: string): Promise<string | null>
  asset?(id: string): AssetMeta | null
  exportAtRoot?: boolean
  pageTypes?: string[]
  lasting?: boolean
  pack?(id: string): unknown
  uses?(id: string): EntryRef[]
  unpack?(value: unknown, how: Unpack): string
}

const MAX_TEXT = 12000

const entryOf = (source: WidgetSource) => kindOf(`${source.kind}/${String(source.id ?? '')}`)

export const ENTRY_WIDGET: KindWidget = {
  views: ['entry'],
  defaultView: 'entry',
  check: (source) => {
    const { kind, id } = entryOf(source)
    return { kind: kind.kind, id, part: typeof source.part === 'string' ? source.part : null }
  },
  title: (source) => {
    const { kind, id } = entryOf(source)
    return kind.title(id)
  },
  describe: (source) => {
    const { kind, id } = entryOf(source)
    return `${kind.label.toLowerCase()} ${kind.title(id)}`
  }
}

const has = (text: string, q: string) => text.toLowerCase().includes(q)

function withJson(kind: Kind, id: string, json: unknown): Exported {
  return { title: kind.title(id), markdown: kind.full(id, {}, USER), json }
}

function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n... ${text.length - MAX_TEXT} more characters ...` : text
}

function fieldsText(p: Pick<Page, 'fields'>): string {
  return p.fields.map((f) => `${f.name} (${f.type === 'select' ? `one of ${f.options.join('/')}` : f.type}${f.required ? ', required' : ''})`).join(', ')
}

export function entryLine(p: PageMeta, tree: PageTree): string {
  return `${pageKindOf(p.type)} ${tree.pathOf(p.id)}`
}

export function folderListing(ref: string, ctx: KindContext = USER): string {
  const at = toId(ref) ? data.pages.resolve(ref, (p) => p.type === FOLDER_TYPE, 'folder') : null
  const tree = data.pages.tree()
  const lines = tree
    .under(at)
    .filter((c) => canSee(pageKindOf(c.type), ctx))
    .map((c) => entryLine(c, tree))
  const files = canSee('file', ctx) ? filesIn(at, tree).map((a) => `file ${a.name}`) : []
  return [...lines, ...files].join('\n') || '(empty)'
}

function filesIn(folder: string | null, tree: PageTree): AssetMeta[] {
  const folders = new Set(tree.list.filter((p) => p.type === FOLDER_TYPE).map((p) => p.id))
  return data.assets.list().filter((a) => (a.parent && folders.has(a.parent) ? a.parent : null) === folder)
}

function tagsText(id: string): string | null {
  const meta = data.pages.metaFor(id)
  if (!meta) return null
  const tagged = tagStore.of(pageKindOf(meta.type), id)
  return tagged.length ? `Tags: #${tagged.join(' #')}` : null
}

function withTags(text: string, id: string): string {
  const tags = tagsText(id)
  return tags ? `${text}\n\n${tags}` : text
}

export function readPage(ref: string, _options: ReadOptions = {}, _ctx: KindContext = USER): { text: string; page: Page } {
  const p = data.pages.get(ref)
  const out: string[] = []
  if (p.type) {
    const text = modules.pageText(p.id)
    out.push(text === null ? 'Its tool is off.' : text)
  }
  if (p.body.trim()) out.push(p.body.trim())
  if (!p.type && p.fields.length) {
    out.push(`Items: ${p.records.length}. Fields: ${fieldsText(p)}${p.records.length ? `\n${p.records.map((r) => `${r.id} ${JSON.stringify(r.values)}`).join('\n')}` : ''}`)
  }
  const tags = tagsText(p.id)
  if (tags) out.push(tags)
  const back = data.pages.backlinks(p.id)
  if (back.length) out.push(`Linked from: ${back.map((b) => linkFor('page', data.pages.pathOf(b.id))).join(', ')}`)
  return { text: out.join('\n\n') || '(empty)', page: p }
}

export function itemsView(p: Page, recordIds: string[] | null): ViewRef {
  return { kind: 'collection', title: p.title, data: { collectionId: p.id, view: p.view ?? (p.fields.some((f) => f.type === 'boolean') ? 'checklist' : 'table'), recordIds } }
}

export function textView(p: Page): ViewRef {
  return { kind: 'note', title: p.title, data: { noteId: p.id } }
}

export function pageView(p: Page, recordIds: string[] | null = null): ViewRef {
  return p.fields.length && (p.records.length || !p.body.trim()) ? itemsView(p, recordIds) : textView(p)
}

function readPageView(id: string, options: ReadOptions, ctx: KindContext = USER): { text: string; view: ViewRef } {
  const { text, page } = readPage(id, options, ctx)
  return { text, view: pageView(page) }
}

const GENERATED = 'all:'

const GENERATED_SHOWN = 50

function generatedPages(ctx: KindContext): { id: string; title: string; kind: Kind }[] {
  return kinds(ctx).map((k) => ({ id: `${GENERATED}${k.kind}`, title: `All ${k.plural.toLowerCase()}`, kind: k }))
}

export function generatedPage(ref: string, ctx: KindContext = USER): { id: string; title: string; kind: Kind } | null {
  const raw = stripRef(ref)
  const key = toId(raw)
  return generatedPages(ctx).find((g) => g.id === raw || toId(g.title) === key) ?? null
}

export const WIKI_INDEX = { id: `${GENERATED}wiki-index`, title: 'Wiki index' }
const INDEX_SHOWN = 50

export function isWikiIndex(ref: string): boolean {
  const raw = stripRef(ref)
  return raw === WIKI_INDEX.id || toId(raw) === toId(WIKI_INDEX.title)
}

export interface GuideSource {
  guides(): { id: string; name: string }[]
  guide(moduleId: string, agentId: string | null): string | null
  agents(): { id: string; name: string }[]
  instructions(agentId: string): string | null
}

let guideSource: GuideSource | null = null

export function setGuideSource(source: GuideSource): void {
  guideSource = source
}

const GUIDE = `${GENERATED}guide-`
const INSTRUCTIONS = `${GENERATED}instructions-`

export function specialPages(ctx: KindContext = USER): { id: string; title: string; summary: string }[] {
  if (!guideSource) return []
  const guides = guideSource.guides().map((g) => ({ id: `${GUIDE}${g.id}`, title: `Seven: ${g.name}`, summary: `How the ${g.name} tools work (generated)` }))
  const agents = guideSource
    .agents()
    .filter((a) => ctx.user || ctx.agentId === a.id)
    .map((a) => ({ id: `${INSTRUCTIONS}${a.id}`, title: `Instructions: ${a.name}`, summary: `Exactly what ${a.name} is told (generated)` }))
  return [...guides, ...agents]
}

function specialPage(ref: string, ctx: KindContext): { id: string; title: string; summary: string } | null {
  const raw = stripRef(ref)
  const key = toId(raw)
  return specialPages(ctx).find((p) => p.id === raw || toId(p.title) === key) ?? null
}

function readSpecial(id: string, ctx: KindContext): string | null {
  if (!guideSource) return null
  if (id.startsWith(GUIDE)) return guideSource.guide(id.slice(GUIDE.length), ctx.agentId ?? null)
  if (id.startsWith(INSTRUCTIONS)) {
    const agentId = id.slice(INSTRUCTIONS.length)
    if (!ctx.user && ctx.agentId !== agentId) throw new ToolError("Another agent's instructions are private to it and the user. You can read only your own instructions page.")
    const text = guideSource.instructions(agentId)
    const name = guideSource.agents().find((a) => a.id === agentId)?.name ?? agentId
    return text === null ? null : `# Instructions: ${name}\nExactly what ${name} is given at the start of a new chat, built each time it is read; it can't be edited here. Change it in the agent's settings.\n\n${text}`
  }
  return null
}

export function generatedTitle(ref: string, ctx: KindContext = USER): string | null {
  return isWikiIndex(ref) ? WIKI_INDEX.title : (specialPage(ref, ctx)?.title ?? generatedPage(ref, ctx)?.title ?? null)
}

function readWikiIndex(ctx: KindContext): string {
  const tree = data.pages.tree()
  const metas = tree.list.filter((p) => canSee(pageKindOf(p.type), ctx))
  const folders = metas.filter((p) => p.type === FOLDER_TYPE).sort((a, b) => tree.pathOf(a.id).localeCompare(tree.pathOf(b.id)))
  const entries = metas.filter((p) => p.type !== FOLDER_TYPE)
  const line = (p: PageMeta) => `- ${entryLine(p, tree)}${p.summary ? ` — ${p.summary.replace(/\s+/g, ' ').slice(0, 100)}` : ''}`
  const cap = (list: string[], folder: string) => (list.length > INDEX_SHOWN ? [...list.slice(0, INDEX_SHOWN), `- and ${list.length - INDEX_SHOWN} more: read_kind(folder, ${folder})`] : list)
  const visible = (parent: string | null) => tree.under(parent).filter((c) => canSee(pageKindOf(c.type), ctx))
  const out = [
    'Every folder and page, built each time it is read; it can\'t be changed. read_kind(folder, /) lists the top level.',
    `${entries.length} page${entries.length === 1 ? '' : 's'} in ${folders.length} folder${folders.length === 1 ? '' : 's'}.`
  ]
  const top = visible(null)
  if (top.length) out.push('## Top level', cap(top.map(line), '/').join('\n'))
  for (const f of folders) {
    const kids = visible(f.id)
    out.push(`## folder ${tree.pathOf(f.id)}`, kids.length ? cap(kids.map(line), tree.pathOf(f.id)).join('\n') : '(empty)')
  }
  const tagged = new Map<string, PageMeta[]>()
  for (const p of entries) {
    for (const t of tagStore.of(pageKindOf(p.type), p.id)) tagged.set(t, [...(tagged.get(t) ?? []), p])
  }
  if (tagged.size) {
    out.push('## Tags')
    for (const [tag, list] of [...tagged.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out.push(`### #${tag}\n${list.slice(0, INDEX_SHOWN).map((p) => `- ${entryLine(p, tree)}`).join('\n')}`)
  }
  const specials = specialPages(ctx)
  if (specials.length) out.push('## Seven', 'How Seven\'s tools work, and what each agent is told (generated).', specials.map((p) => `- page ${toId(p.title)}`).join('\n'))
  return out.join('\n\n')
}

function guardGenerated(id: string): void {
  if (id.startsWith(GENERATED)) throw new ToolError(`"${generatedTitle(id) ?? id}" is generated each time it is read and can't be changed. Change the entries themselves instead.`)
}

function readGenerated(id: string, ctx: KindContext): string {
  if (isWikiIndex(id)) return readWikiIndex(ctx)
  if (id.startsWith(GUIDE) || id.startsWith(INSTRUCTIONS)) {
    const text = readSpecial(id, ctx)
    if (text === null) throw new ToolError(`No page ${id}. read_kind(page, wiki_index) lists every page.`)
    return text
  }
  const g = generatedPage(id, ctx)
  if (!g) throw new ToolError(`No page ${id}. read_kind(page, wiki_index) lists every page.`)
  const all = searchKind(g.kind, '', 100_000, ctx)
  const sorted = all.some((h) => h.at !== undefined) ? [...all].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)) : all
  const shown = sorted.slice(0, GENERATED_SHOWN)
  const lines = shown.map((h) => {
    const line = g.kind.line(h.id, ctx)
    return `- ${g.kind.kind} ${entryId(g.kind, h.id, h.title, ctx)}${line ? ` — ${line.replace(/\s+/g, ' ').slice(0, 120)}` : ''}${h.tags?.length ? ` #${h.tags.join(' #')}` : ''}`
  })
  const more = all.length > shown.length ? `\n\n${all.length - shown.length} more not listed (newest first above); find with kind ${g.kind.kind} searches them.` : ''
  return `Every ${g.kind.label.toLowerCase()}, built each time it is read; it can't be changed. ${g.kind.description ? `${g.kind.plural}: ${g.kind.description}.` : ''}\n\n${all.length} in total.\n\n${lines.join('\n') || '(none yet)'}${more}`
}

const INDEX_LINE = 'The root of every page, by section and tag (generated)'
const generatedLine = (k: Kind) => `Every ${k.label.toLowerCase()}, with links (generated)`
const pageMetaLine = (p: PageMeta) => (p.count ? `${p.count} item${p.count === 1 ? '' : 's'}${p.summary ? ` · ${p.summary}` : ''}` : p.summary)

function pageLine(id: string, ctx: KindContext): string {
  const meta = data.pages.metaFor(id)
  if (meta) return pageMetaLine(meta)
  if (isWikiIndex(id)) return INDEX_LINE
  const special = specialPage(id, ctx)
  if (special) return special.summary
  const generated = generatedPage(id, ctx)
  return generated ? generatedLine(generated.kind) : ''
}

const pageKind: Kind = {
  group: 'Yours',
  kind: 'page',
  ...pagePacking(),
  pageTypes: [''],
  isGenerated: (id) => id.startsWith(GENERATED),
  resolveOnly: true,
  missing: (ref) => data.pages.missing(ref, 'page'),
  exportAtRoot: true,
  rename: (id, name) => {
    guardGenerated(id)
    data.pages.write({ ref: id, title: name, body: null })
  },
  remove: (id) => {
    guardGenerated(id)
    data.pages.delete(id)
  },
  label: 'Page',
  plural: 'Pages',
  exportable: true,
  export: (id, ctx) => {
    if (!id.startsWith(GENERATED)) return pageExport(data.pages.get(id))
    const title = generatedTitle(id, ctx) ?? id
    const text = readGenerated(id, ctx)
    return { title, markdown: `# ${title}\n\n${text}`, json: { title, generated: true, text } }
  },
  textParts: ['summary'],
  readView: (id, options, ctx) => (id.startsWith(GENERATED) ? { text: readGenerated(id, ctx) } : { text: readPage(id, options, ctx).text, view: entryView(pageKind, id, null, ctx) }),
  place: (id, part) => (!part || part === 'text' || part === 'items' ? { kind: 'page', pageId: id } : null),
  presents: { chat: true, widget: PAGE_WIDGET },
  icon: 'file-text',
  description: 'the wiki you share with the user: text, items (lists, checklists, tables) and a picture; anything every agent should know goes here. @page:wiki_index lists every page',
  parts: ['text', 'items', 'picture', 'summary'],
  actions: ['add_page', 'update_page', 'rename_page', 'remove_page', 'page_items', 'page_fields'],
  title: (id) => (id.startsWith(GENERATED) ? (generatedTitle(id) ?? id) : data.pages.get(id).title),
  defaultPart(id) {
    if (id.startsWith(GENERATED)) return 'text'
    const p = data.pages.get(id)
    return p.fields.length && (p.records.length || !p.body.trim()) ? 'items' : 'text'
  },
  available: () => true,
  search(query, limit, ctx) {
    const metas = new Map(data.pages.list().map((p) => [p.id, p]))
    const q = query.trim().toLowerCase()
    const index = !q || WIKI_INDEX.title.toLowerCase().includes(q) || 'root contents'.includes(q) ? [{ kind: 'page', id: WIKI_INDEX.id, title: WIKI_INDEX.title }] : []
    const specials = specialPages(ctx)
      .filter((p) => !q || p.title.toLowerCase().includes(q) || (q.length > 3 && ('seven guide instructions'.includes(q) || q.includes('guide'))))
      .map((p) => ({ kind: 'page', id: p.id, title: p.title }))
    const generated = [
      ...index,
      ...specials,
      ...generatedPages(ctx)
        .filter((g) => !q || g.title.toLowerCase().includes(q) || g.kind.kind.includes(q))
        .map((g) => ({ kind: 'page', id: g.id, title: g.title }))
    ]
    if (!q)
      return [
        ...index,
        ...[...metas.values()]
          .filter((p) => !p.type)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit)
          .map((p) => ({ kind: 'page', id: p.id, title: p.title, at: p.updatedAt })),
        ...generated.slice(index.length)
      ].slice(0, limit)
    return [
      ...generated,
      ...data.pages
        .search(query, limit * 2)
        .filter((h) => !metas.get(h.id)?.type)
        .map((h) => {
          const meta = metas.get(h.id)
          return { kind: 'page', id: h.id, title: h.title, excerpt: h.snippet || undefined, at: meta?.updatedAt }
        })
    ].slice(0, limit)
  },
  resolve(ref, ctx) {
    const p = data.pages.find(ref, (x) => !x.type)
    if (p) return p.id
    if (isWikiIndex(ref)) return WIKI_INDEX.id
    return specialPage(ref, ctx)?.id ?? generatedPage(ref, ctx)?.id ?? null
  },
  line: pageLine,
  handTo: PAGE_HAND_TO,
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full: (id, options, ctx) => (id.startsWith(GENERATED) ? readGenerated(id, ctx) : readPage(id, options, ctx).text)
}

const folderLine = (id: string | null, tree: PageTree) => `${tree.under(id).length + filesIn(id, tree).length} inside`

const folderKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'folder',
  ...folderPacking,
  pageTypes: [FOLDER_TYPE],
  root: ROOT_FOLDER,
  resolveOnly: true,
  missing: (ref) => data.pages.missing(ref, 'folder'),
  label: 'Folder',
  plural: 'Folders',
  exportable: false,
  icon: 'folder',
  description: 'holds pages and folders; reading one lists what it holds',
  parts: [],
  actions: [],
  available: () => true,
  title: (id) => (id === ROOT_FOLDER ? ROOT_FOLDER : data.pages.pathOf(id)),
  search(query, limit) {
    const q = toId(query)
    const tree = data.pages.tree()
    return tree.list
      .filter((p) => p.type === FOLDER_TYPE && (!q || tree.pathOf(p.id).includes(q)))
      .slice(0, limit)
      .map((p) => ({ kind: 'folder', id: p.id, title: tree.pathOf(p.id), at: p.updatedAt }))
  },
  resolve(ref) {
    if (!toId(ref)) return ROOT_FOLDER
    return data.pages.find(ref, (p) => p.type === FOLDER_TYPE)?.id ?? null
  },
  line: (id) => folderLine(id === ROOT_FOLDER ? null : id, data.pages.tree()),
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full: (id, _options, ctx) => folderListing(id === ROOT_FOLDER ? '' : id, ctx),
  remove: (id) => void data.pages.delete(id),
  rename: (id, name) => void data.pages.write({ ref: id, title: name })
}

const fileLine = (a: AssetMeta) => `${a.kind}, ${Math.max(1, Math.round(a.size / 1024))} KB`

const fileKind: Kind = {
  group: 'Yours',
  kind: 'file',
  ...filePacking,
  asset: (id) => data.assets.metaFor(id) ?? null,
  readFull: async (id) => {
    const meta = data.assets.metaFor(id)
    return meta && isTextAsset(meta) ? attachedText(meta) : null
  },
  rename: (id, name) => void data.assets.rename(id, name),
  remove: (id) => void data.assets.delete(id),
  label: 'File',
  place: (id, part) => (!part || part === 'media' ? { kind: 'file', assetIds: [id] } : null),
  presents: { chat: true, widget: FILE_WIDGET },
  plural: 'Files',
  exportable: false,
  icon: 'image',
  description: 'pictures, sounds, videos and documents kept in Seven',
  parts: ['media'],
  actions: [],
  title: (id) => data.assets.get(id).name,
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return data.assets
      .list()
      .filter((a) => !q || has(a.name, q) || has(a.description ?? '', q) || a.id === query)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((a) => ({ kind: 'file', id: a.id, title: a.name, at: a.createdAt }))
  },
  resolve(ref) {
    if (data.assets.exists(ref)) return ref
    return data.assets.findByName(ref)?.id ?? null
  },
  line: (id) => fileLine(data.assets.get(id)),
  fields: (id) => [{ name: 'Description', text: data.assets.metaFor(id)?.description ?? '' }],
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const a = data.assets.get(id)
    const areas = (a.areas ?? []).filter((x) => x.name)
    return `${a.name}: ${a.kind}, ${Math.max(1, Math.round(a.size / 1024))} KB, id ${a.id}${a.source.original ? `, from ${a.source.original}` : ''}${a.description ? `\nDescription: ${a.description}` : ''}${areas.length ? `\nAreas the user can click when you show it: ${areas.map((x) => (x.note ? `${x.name} (${x.note})` : x.name)).join('; ')}` : ''}`
  }
}

const boardLine = (b: Dashboard) => `${b.widgets.length} widgets`

const boardKind: Kind = {
  presents: { chat: true },
  group: 'Yours',
  kind: 'board',
  rename: (id, name) => void data.dashboards.update(id, { name }),
  remove: (id) => void data.dashboards.delete(id),
  label: 'Board',
  plural: 'Boards',
  exportable: true,
  export(id) {
    return withJson(this, id, data.dashboards.get(id))
  },
  icon: 'layout-dashboard',
  description: 'dashboards the user keeps open, made of widgets',
  parts: ['board'],
  actions: ['board'],
  title: (id) => data.dashboards.get(id).name,
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return data.dashboards
      .list()
      .filter((b) => !q || has(b.name, q))
      .slice(0, limit)
      .map((b) => ({ kind: 'board', id: b.id, title: b.name, at: b.updatedAt }))
  },
  resolve(ref) {
    const b = data.dashboards.list().find((x) => x.id === ref || x.name.toLowerCase() === ref.toLowerCase())
    return b?.id ?? null
  },
  line: (id) => boardLine(data.dashboards.get(id)),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id) {
    const b = data.dashboards.get(id)
    return `Board ${b.name}:${b.widgets.length ? `\n${b.widgets.map((w) => `  ${widgetLine(w)}`).join('\n')}` : ' empty'}`
  }
}

function workoutPageKind(type: WorkoutPageType, spec: { label: string; plural: string; icon: string; description: string; parts: string[]; textParts?: string[]; actions: string[]; summary: (meta: PageMeta) => string; refs?: Parameters<typeof pagePacking>[0] }): Kind {
  return {
    presents: { chat: true, widget: ENTRY_WIDGET },
    group: 'Yours',
    kind: type,
    ...pagePacking(spec.refs),
    label: spec.label,
    plural: spec.plural,
    exportable: true,
    handTo: PAGE_HAND_TO,
    pageTypes: [type],
    missing: (ref) => data.pages.missing(ref, type),
    export: (id) => pageExport(data.pages.get(id)),
    icon: spec.icon,
    description: spec.description,
    parts: spec.parts,
    ...(spec.textParts ? { textParts: spec.textParts } : {}),
    defaultPart: () => spec.parts[0],
    actions: spec.actions,
    available: () => data.toolIsOn('workout'),
    title: (id) => data.pages.get(id).title,
    search(query, limit) {
      workout.ensure()
      const q = query.toLowerCase()
      return data.pages
        .ofType(type)
        .filter((p) => !q || has(p.title, q))
        .slice(0, limit)
        .map((p) => ({ kind: type, id: p.id, title: p.title, at: p.updatedAt }))
    },
    resolve(ref) {
      workout.ensure()
      return data.pages.find(ref, (p) => p.type === type)?.id ?? null
    },
    line: (id) => spec.summary(data.pages.metaFor(id)!),
    card(id, ctx) {
      return this.export!(id, ctx).markdown
    },
    full: (id) => withTags(workout.read(type, id), id),
    remove: (id) => void data.pages.delete(id),
    rename: (id, name) => void data.pages.write({ ref: id, title: name })
  }
}

const exerciseKind = workoutPageKind(EXERCISE, {
  label: 'Exercise',
  plural: 'Exercises',
  icon: 'activity',
  description: "one exercise: how to do it, do's, don'ts, an easier version, a picture, drawings or a video link, and whether it is counted in reps or seconds",
  parts: ['exercise'],
  actions: ['add_exercise', 'update_exercise', 'remove_exercise', 'log_exercise', 'remove_log'],
  summary: (p) => {
    const e = cleanExercise(data.pages.get(p.id).data)
    return e.how[0] ?? (e.figures.length || e.video ? 'has a visual' : 'exercise')
  }
})

const workoutEntryKind = workoutPageKind(WORKOUT, {
  label: 'Workout',
  plural: 'Workouts',
  icon: 'dumbbell',
  description: 'one workout: notes before it (e.g. a warm-up), its exercises in order, each with sets and a target, and notes after it',
  parts: ['workout', 'history', 'glance'],
  actions: ['add_workout', 'update_workout', 'remove_workout', 'workout_history', 'workout_show'],
  summary: (p) => {
    const n = cleanWorkout(data.pages.get(p.id).data).items.length
    return `${n} exercise${n === 1 ? '' : 's'}`
  },
  refs: {
    uses: (value) => cleanWorkout(value).items.map((i) => ({ kind: EXERCISE, id: i.exercise })),
    swap: (value, entry) => {
      const w = cleanWorkout(value)
      return { ...w, items: w.items.map((i) => ({ ...i, exercise: entry(i.exercise, EXERCISE) })) }
    }
  }
})

function worldHits(query: string, limit: number): KindHit[] {
  const q = query.toLowerCase()
  const out: KindHit[] = []
  for (const w of worlds.list()) {
    const schema = worlds.schema(w.id)
    for (const tk of Object.keys(schema.types)) {
      for (const [key, e] of Object.entries(worlds.entities(w.id, tk, false))) {
        const text = JSON.stringify(e).toLowerCase()
        if (q && !key.includes(q) && !text.includes(q)) continue
        out.push({ kind: 'world', id: `${w.id}/${tk}/${key}`, title: key })
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

const worldLine = (w: { types: { count: number; plural: string }[] }) => w.types.map((t) => `${t.count} ${t.plural}`).join(', ')
const recordLine = (id: string) => {
  const [w, t] = id.split('/')
  return `${worlds.schema(w).types[t]?.noun ?? t} in ${worlds.meta(w).name}`
}

function recordFields(id: string): KindField[] {
  const [w, t, k] = id.split('/')
  const e = w && t && k ? worlds.get(w, t, k, false) : null
  return e ? Object.entries(e).map(([name, v]) => ({ name, text: plainValue(v) })) : []
}

function readRecord(id: string): string {
  const [worldId, type, key] = id.split('/')
  return `${worlds.meta(worldId).name}: ${recall({ worldId, type, id: key }, { type, id: key, field: null, query: null, sort: null })}`
}

function exportRecord(kind: Kind, id: string): Exported {
  const [w, t, k] = id.split('/')
  return withJson(kind, id, { world: worlds.meta(w).name, type: t, key: k, record: worlds.get(w, t, k) })
}

function removeRecord(id: string): void {
  const [w, t, k] = id.split('/')
  worlds.remove(w, t, k)
}

const worldKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'world',
  family: 'world',
  label: 'World',
  textParts: ['record'],
  plural: 'Worlds',
  exportable: true,
  export(id) {
    if (id.includes('/')) return exportRecord(this, id)
    const meta = worlds.meta(id)
    return withJson(this, id, { world: meta.name, schema: worlds.schema(id), types: meta.types })
  },
  icon: 'orbit',
  description: 'story worlds: each has its own kinds of records (characters, places, factions…) and a message board',
  parts: ['record'],
  title: (id) => (id.includes('/') ? (id.split('/')[2] ?? id) : (worlds.list().find((w) => w.id === id)?.name ?? id)),
  actions: ['world_recall', 'world_remember', 'world_search', 'world_post', 'world_board', 'world_create', 'world_set', 'world_entries', 'world_delete'],
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return worlds
      .list()
      .filter((w) => !q || has(w.name, q))
      .slice(0, limit)
      .map((w) => ({ kind: 'world', id: w.id, title: w.name, at: w.updatedAt }))
  },
  line: (id) => (id.includes('/') ? recordLine(id) : worldLine(worlds.meta(id))),
  fields: (id) => (id.includes('/') ? recordFields(id) : []),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve(ref) {
    const parts = ref.split('/')
    if (parts.length === 3 && worlds.exists(parts[0])) return ref
    const w = worlds.list().find((x) => x.id === ref || x.name.toLowerCase() === ref.toLowerCase())
    if (w) return w.id
    return worldHits(ref, 50).find((h) => h.title.toLowerCase() === ref.toLowerCase())?.id ?? null
  },
  full(id) {
    if (id.includes('/')) return readRecord(id)
    const meta = worlds.meta(id)
    return `World ${meta.name}: ${meta.types.map((t) => `${t.count} ${t.plural}`).join(', ')}. ${meta.posts} board posts.`
  },
  remove(id) {
    if (id.includes('/')) removeRecord(id)
    else worlds.delete(id)
  },
  rename(id, name) {
    if (id.includes('/')) throw new ToolError('Rename records inside their world')
    worlds.rename(id, name)
  }
}

function mapOf(id: string): MapData {
  const found = maps.get(id)
  if (!found) throw new ToolError(`No map ${id}. find with kind map lists them.`)
  return found
}

const usedBy = (id: string) => worlds.usingMap(id).map((w) => w.name)

function worldPlaces(world: string): Record<string, Record<string, unknown>> {
  return worlds.schema(world).types[PLACE_TYPE_KEY] ? worlds.entities(world, PLACE_TYPE_KEY, false) : {}
}

const mapLine = (id: string) => {
  const m = mapOf(id)
  const used = usedBy(id)
  return `map ${m.size.w}×${m.size.h}${used.length ? `, used by ${used.join(', ')}` : ', not used by any world yet'}`
}

const clipLine = (text: string, max = 90) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

function placeSummary(places: Record<string, Record<string, unknown>>, key: string): string {
  const now = typeof places[key]?.Now === 'string' ? String(places[key].Now) : ''
  if (now.trim()) return clipLine(now)
  const inside = Object.keys(places).filter((k) => places[k]?.Inside === key).length
  return inside ? `${inside} inside` : 'nothing happening'
}

function placeLines(nodes: PlaceNode[], places: Record<string, Record<string, unknown>>, depth = 0): string[] {
  return nodes.flatMap((n) => [`${'  '.repeat(depth)}- ${n.name} (@place:${n.key}) — ${n.shaped ? placeSummary(places, n.key) : `${placeSummary(places, n.key)} (no shape on this map)`}`, ...placeLines(n.children, places, depth + 1)])
}

function changedText(c: WorldChange | undefined): string {
  if (!c) return ''
  return ` (changed by ${c.by ? (agentAccess.get(c.by)?.name ?? 'an agent') : 'the user'}, ${new Date(c.at).toLocaleString()})`
}

function placeCard(id: string): string {
  const { world, key } = placeRef(id)
  const places = worldPlaces(world)
  const p = places[key]
  if (!p) throw new ToolError(`No place ${key} in world ${world}. find with kind place lists them.`)
  const path = placePath(places, key).map((k) => String(places[k]?.Name || k))
  const changes = worlds.changes(world, PLACE_TYPE_KEY)[key] ?? {}
  const inside = Object.keys(places).filter((k) => places[k]?.Inside === key)
  const extra = Object.entries(p).filter(([k, v]) => !(k in PLACE_TYPE.fields) && v !== '' && v !== null && !(Array.isArray(v) && !v.length))
  const drawn = worlds.mapUses(world).filter((u) => u.shapes[key])
  const here = (whoIsHere(world)[key] ?? []).map((v) => {
    const agent = v.agent ? agentAccess.get(v.agent) : null
    return `- ${linkFor('sheet', v.sheet)} (${v.name}) — ${v.line}${agent ? ` (played by ${linkFor('agent', agent.name)})` : ''}`
  })
  return [
    `path: ${path.join(' › ')}`,
    `world: ${worlds.meta(world).name}`,
    `files: ${String(p.Files || '').trim() || 'none'}`,
    `now: ${String(p.Now || '').trim() || 'nothing happening'}${changedText(changes.Now)}`,
    ...extra.map(([k, v]) => `${k.replace(/_/g, ' ').toLowerCase()}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}`),
    here.length ? `here:\n${here.join('\n')}` : 'here: nobody',
    String(p.Actions || '').trim() ? `actions (attempts; roll one with action_check):\n${String(p.Actions).trim()}` : '',
    String(p.Decisions || '').trim() ? `decisions (choices, never rolled; when the user decides, ask them with ask_user):\n${String(p.Decisions).trim()}` : '',
    inside.length ? `inside it: ${inside.map((k) => `@place:${k}`).join(' ')}` : '',
    drawn.length ? `on maps: ${drawn.map((u) => `@map:${u.map}`).join(' ')}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

const placeKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'place',
  family: 'world',
  worldType: PLACE_TYPE_KEY,
  label: 'Place',
  plural: 'Places',
  icon: 'map-pin',
  description: "places in your story worlds: where each is, what belongs there and what is happening there now",
  parts: ['record'],
  textParts: ['record'],
  actions: [],
  exportable: true,
  export: (id) => exportRecord(placeKind, id),
  available: () => worlds.list().some((w) => Boolean(worlds.schema(w.id).types[PLACE_TYPE_KEY])),
  title(id) {
    const { world, key } = placeRef(id)
    try {
      return String(worldPlaces(world)[key]?.Name || key)
    } catch {
      return key
    }
  },
  search(query, limit) {
    return worldHits(query, 100_000)
      .filter((h) => h.id.split('/')[1] === PLACE_TYPE_KEY)
      .slice(0, limit)
      .map((h) => ({ ...h, kind: 'place', title: this.title(h.id) }))
  },
  resolve(ref) {
    const parts = ref.split('/')
    if (parts.length === 3 && parts[1] === PLACE_TYPE_KEY && worlds.exists(parts[0])) return ref
    const key = ref.trim().toLowerCase()
    return this.search('', 100_000, USER).find((h) => h.id.split('/')[2] === key || h.title.toLowerCase() === key)?.id ?? null
  },
  line(id) {
    const { world, key } = placeRef(id)
    const places = worldPlaces(world)
    return `${placePath(places, key).map((k) => String(places[k]?.Name || k)).join(' › ')}: ${placeSummary(places, key)}`
  },
  card: placeCard,
  full: placeCard,
  fields: recordFields,
  remove(id) {
    const { world, key } = placeRef(id)
    worlds.removePlace(world, key)
  }
}

const mapKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'map',
  label: 'Map',
  plural: 'Maps',
  icon: 'map',
  description: 'maps: layers of tiles, pictures and objects that pan and zoom as one; worlds use them and draw their places on them',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    return withJson(this, id, mapOf(id))
  },
  available: () => true,
  title(id) {
    try {
      return mapOf(id).name
    } catch {
      return id
    }
  },
  search(query, limit) {
    const q = query.toLowerCase()
    return mapListing()
      .map((m) => ({ kind: 'map', id: m.id, title: m.name, at: m.updatedAt }))
      .filter((h) => !q || has(h.title, q))
      .slice(0, limit)
  },
  resolve(ref) {
    const key = ref.trim().toLowerCase()
    return this.search('', 100_000, USER).find((h) => h.id === key || h.title.toLowerCase() === key)?.id ?? null
  },
  line: mapLine,
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const m = mapOf(id)
    const places = worlds.usingMap(id).map((w) => {
      const all = worldPlaces(w.id)
      const shapes = worlds.mapUses(w.id).find((u) => u.map === id)?.shapes ?? {}
      return `Places of ${w.name} on it:\n${placeLines(placeTree(all, shapes), all).join('\n') || '(none yet)'}`
    })
    const objects = mapObjects(m.layers).map((o) =>
      [`- ${o.name}${o.entry ? ` (opens ${o.entry})` : ''}`, o.actions.trim() ? `  actions (attempts; roll with action_check):\n${o.actions.trim().replace(/^/gm, '    ')}` : '', o.decisions.trim() ? `  decisions (choices, never rolled):\n${o.decisions.trim().replace(/^/gm, '    ')}` : ''].filter(Boolean).join('\n')
    )
    return [`# ${m.name}`, `Layers: ${layerNames(m.layers).join(', ') || 'none'}.`, ...(objects.length ? [`Objects on it (generic: a door, a rock, a scroll; using one starts from there):\n${objects.join('\n')}`] : []), ...places].join('\n\n')
  },
  remove(id) {
    removeMap(id)
  },
  rename(id, name) {
    maps.save({ ...mapOf(id), name })
  }
}

function nexusKinds(taken: Set<string>, claimed: Set<string>): Kind[] {
  const types = new Map<string, WorldType>()
  for (const w of worlds.list()) {
    try {
      for (const [tk, t] of Object.entries(worlds.schema(w.id).types)) if (!types.has(tk) && !claimed.has(tk)) types.set(tk, t)
    } catch {
      continue
    }
  }
  return [...types.entries()].map(([tk, t]) => {
    const kind = taken.has(tk) ? `world-${tk}` : tk
    const records = (query: string, limit: number) => worldHits(query, 100_000).filter((h) => h.id.split('/')[1] === tk).slice(0, limit).map((h) => ({ ...h, kind }))
    const k: Kind = {
      kind,
      family: 'world',
      group: 'Worlds',
      label: t.label || t.noun,
      plural: t.plural,
      icon: t.display?.icon || 'orbit',
      description: t.describe || `${t.plural.toLowerCase()} in your story worlds`,
      parts: ['record'],
      textParts: ['record'],
      exportable: true,
      export: (id) => exportRecord(k, id),
      actions: [],
      available: () => true,
      title: (id) => id.split('/')[2] ?? id,
      search: records,
      resolve(ref) {
        const parts = ref.split('/')
        if (parts.length === 3 && parts[1] === tk && worlds.exists(parts[0])) return ref
        const key = ref.trim().toLowerCase()
        return records('', 100_000).find((h) => h.title.toLowerCase() === key)?.id ?? null
      },
      line: recordLine,
      card: (id) => exportRecord(k, id).markdown,
      fields: recordFields,
      full: readRecord,
      remove: removeRecord
    }
    return k
  })
}

const skillKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  pack: (id) => ({ name: id, text: skills.read(id) }),
  unpack(value, how) {
    const v = (value ?? {}) as { name?: unknown; text?: unknown }
    if (typeof v.name !== 'string' || typeof v.text !== 'string') throw new Error('The skill in this picture is damaged')
    const taken = new Set(skills.list().map((s) => s.name.toLowerCase()))
    const name = how.replace ?? freeName(v.name, (n) => taken.has(n.toLowerCase()), (n, i) => `${n}-${i}`)
    skills.write(name, v.text)
    return name
  },
  group: 'Yours',
  kind: 'skill',
  remove: (id) => void skills.delete(id),
  label: 'Skill',
  textParts: ['text'],
  plural: 'Skills',
  exportable: true,
  export(id) {
    const text = skills.read(id)
    return { title: this.title(id), markdown: text, json: { name: id, text } }
  },
  icon: 'graduation-cap',
  description: 'saved instructions for doing a kind of task well',
  parts: ['text'],
  actions: [],
  title: (id) => skills.list().find((x) => x.name === id)?.title ?? id,
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return skills
      .list()
      .filter((s) => !q || has(s.name, q) || has(s.title, q) || has(s.description, q))
      .slice(0, limit)
      .map((s) => ({ kind: 'skill', id: s.name, title: s.title, at: s.updatedAt }))
  },
  line: (id) => skills.info(id)?.description ?? '',
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve(ref) {
    const s = skills.list().find((x) => x.name.toLowerCase() === ref.toLowerCase() || x.title.toLowerCase() === ref.toLowerCase())
    return s?.name ?? null
  },
  full: (id) => skills.read(id) || '(empty)'
}

const reminderLine = (r: { enabled: boolean; next: number }) => `${r.enabled ? 'next' : 'paused, was'} ${new Date(r.next).toLocaleString()}`

const reminderKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'reminder',
  remove: (id) => void reminders.cancel(id),
  label: 'Reminder',
  textParts: ['summary'],
  plural: 'Reminders',
  exportable: true,
  export(id) {
    return withJson(this, id, reminders.list().find((r) => r.id === id))
  },
  icon: 'alarm-clock',
  description: 'timed reminders and scheduled runs',
  parts: ['summary'],
  actions: ['set_reminder', 'cancel_reminder', 'list_reminders'],
  title: (id) => reminders.list().find((r) => r.id === id)?.text.slice(0, 60) ?? id,
  available: () => true,
  search(query, limit) {
    const q = query.toLowerCase()
    return reminders
      .list()
      .filter((r) => !q || has(r.text, q))
      .slice(0, limit)
      .map((r) => ({ kind: 'reminder', id: r.id, title: r.text.slice(0, 60), at: r.next }))
  },
  line: (id) => {
    const r = reminders.list().find((x) => x.id === id)
    return r ? reminderLine(r) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => reminders.list().find((r) => r.id === ref)?.id ?? null,
  full(id) {
    const r = reminders.list().find((x) => x.id === id)
    if (!r) throw new ToolError(`No reminder ${id}`)
    return `Reminder: ${r.text}. ${r.enabled ? 'Next' : 'Paused; was due'} ${new Date(r.next).toLocaleString()}, repeats ${JSON.stringify(r.repeat)}.`
  }
}


const mindLine = (count: number) => (count ? `${count} memor${count === 1 ? 'y' : 'ies'}` : 'nothing yet')
const memoryLine = (m: { pinned: boolean }) => (m.pinned ? 'pinned' : 'recalled when needed')

const memoryKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  lasting: true,
  group: 'Agents',
  kind: 'memory',
  remove(id, ctx) {
    if (!ctx.user) throw new ToolError('Only you can clear a mind')
    for (const m of minds.memories(id)) minds.forget(id, m.id, null)
  },
  label: 'Mind',
  plural: 'Minds',
  exportable: true,
  export(id, ctx) {
    if (!ctx.user) return withJson(this, id, minds.memory(ctx.agentId ?? '', id))
    const name = agentAccess.get(id)?.name ?? id
    const memories = minds.memories(id)
    const thoughts = minds.thoughts(id, null).thoughts
    const markdown = [
      `# ${name}: mind`,
      '## Memories',
      memories.map((m) => `- ${m.pinned ? '(pinned) ' : ''}${m.text}`).join('\n') || '(none)',
      '## Thoughts (latest month)',
      thoughts.map((t) => `### ${new Date(t.at).toLocaleString()}${t.style ? ` · ${t.style}` : ''}\n${t.question ? `${t.question}\n\n` : ''}${t.reasoning}\n\n**Conclusion:** ${t.conclusion}`).join('\n\n') || '(none)'
    ].join('\n\n')
    return { title: `${name} mind`, markdown, json: { agent: name, memories, thoughts } }
  },
  icon: 'brain',
  description: 'your own memories (pinned ones are in every chat); only you can read them',
  parts: [],
  actions: ['remember', 'recall', 'forget'],
  available: (ctx) => Boolean(ctx.agentId || ctx.user),
  title: (id) => agentAccess.get(id)?.name ?? id,
  search(query, limit, ctx) {
    const q = query.toLowerCase()
    if (ctx.user) {
      return agentAccess
        .list()
        .filter((a) => !q || has(a.name, q))
        .slice(0, limit)
        .map((a) => {
          return { kind: 'memory', id: a.id, title: a.name, at: a.updatedAt }
        })
    }
    if (!ctx.agentId) return []
    return minds
      .memories(ctx.agentId)
      .filter((m) => !q || has(m.text, q))
      .slice(0, limit)
      .map((m) => ({ kind: 'memory', id: m.id, title: m.text.slice(0, 80), at: m.updatedAt }))
  },
  line(id, ctx) {
    if (ctx.user) return mindLine(minds.memories(id).length)
    const m = ctx.agentId ? minds.memory(ctx.agentId, id) : null
    return m ? memoryLine(m) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve(ref, ctx) {
    if (ctx.user) return agentAccess.list().find((x) => x.id === ref || x.name.toLowerCase() === ref.trim().toLowerCase())?.id ?? null
    return ctx.agentId ? (minds.memory(ctx.agentId, ref)?.id ?? null) : null
  },
  full(id, _options, ctx) {
    if (ctx.user) return clip(minds.memories(id).map((m) => `- ${m.pinned ? '(pinned) ' : ''}${m.text}`).join('\n') || '(no memories)')
    if (!ctx.agentId) throw new ToolError('Only an agent can read its own memories')
    const m = minds.memory(ctx.agentId, id)
    if (!m) throw new ToolError(`No memory ${id}`)
    return m.text
  }
}

function thoughtRef(id: string): { agentId: string; thoughtId: string } | null {
  const at = id.lastIndexOf(':')
  return at > 0 ? { agentId: id.slice(0, at), thoughtId: id.slice(at + 1) } : null
}

const thoughtLine = (t: Thought, agentName: string) => `${agentName} · ${t.kind === 'reason' ? (t.style ?? 'reason') : 'thought'}`

function thoughtText(t: Thought, agentName: string): string {
  return [`${agentName}'s ${t.kind === 'reason' ? `reasoning${t.style ? ` (${t.style})` : ''}` : 'thought'}, ${new Date(t.at).toLocaleString()}`, t.question, t.reasoning, `Conclusion: ${t.conclusion}`].filter(Boolean).join('\n\n')
}

const thoughtKind: Kind = {
  lasting: true,
  group: 'Agents',
  kind: 'thought',
  remove(id) {
    const ref = thoughtRef(id)
    if (ref) minds.forgetThought(ref.agentId, ref.thoughtId)
  },
  label: 'Thought',
  plural: 'Thoughts',
  exportable: true,
  icon: 'lightbulb',
  description: "agents' thoughts and reasoning; only you can read them, and you can hand one to an agent",
  parts: [],
  actions: ['think', 'reason'],
  available: (ctx) => Boolean(ctx.user),
  title(id) {
    const ref = thoughtRef(id)
    const t = ref ? minds.thought(ref.agentId, ref.thoughtId) : null
    return t ? t.conclusion.slice(0, 80) : id
  },
  search(query, limit) {
    const q = query.toLowerCase()
    const out: KindHit[] = []
    for (const a of agentAccess.list()) {
      const agentHit = !!q && has(a.name, q)
      for (const t of minds.allThoughts(a.id)) {
        if (q && !agentHit && !has(t.conclusion, q) && !has(t.question, q) && !has(t.reasoning, q)) continue
        out.push({ kind: 'thought', id: `${a.id}:${t.id}`, title: t.conclusion.slice(0, 80), at: t.at })
      }
    }
    return out.sort((x, y) => (y.at ?? 0) - (x.at ?? 0)).slice(0, limit)
  },
  resolve(ref) {
    const r = thoughtRef(ref.trim())
    if (r && minds.thought(r.agentId, r.thoughtId)) return ref.trim()
    for (const a of agentAccess.list()) if (minds.thought(a.id, ref.trim())) return `${a.id}:${ref.trim()}`
    return null
  },
  line(id) {
    const ref = thoughtRef(id)
    const t = ref ? minds.thought(ref.agentId, ref.thoughtId) : null
    return ref && t ? thoughtLine(t, agentAccess.get(ref.agentId)?.name ?? 'An agent') : ''
  },
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const ref = thoughtRef(id)
    const t = ref ? minds.thought(ref.agentId, ref.thoughtId) : null
    if (!ref || !t) throw new ToolError(`No thought ${id}`)
    return thoughtText(t, agentAccess.get(ref.agentId)?.name ?? 'An agent')
  }
}

export function checkPart(k: Kind, part: string | null): string | null {
  if (!part || !k.linkParts) return null
  if (!k.linkParts.some((p) => p.name === part)) throw new ToolError(`A ${k.label.toLowerCase()} has no #${part}. Link it with one of: ${k.linkParts.map((p) => `#${p.name}`).join(', ')}, or with no # part for the whole entry.`)
  return part
}

export function referenceText(kindName: string, ref: string, part: string | null = null): { label: string; title: string; text: string } | null {
  const k = kindFor(kindName, USER)
  if (!k) return null
  const id = k.resolve(ref, USER)
  const field = id && part ? fieldText(k, id, part) : null
  if (id && field !== null) return { label: k.label, title: `${k.title(id)} · ${part}`, text: clip(resolveIncludes(field)) }
  const checked = checkPart(k, part)
  try {
    if (!id) return null
    return { label: k.label, title: k.title(id), text: clip(resolveIncludes(k.full(id, { part: checked }, USER))) }
  } catch {
    return null
  }
}

const styleLine = (st: { voices: { label: string }[]; instruction: string }) => (st.voices.length ? st.voices.map((v) => v.label).join(', ') : st.instruction.slice(0, 100))

const styleKind: Kind = {
  presents: { chat: true },
  ...storePacking({ find: (id) => styles.find(id), names: () => styles.list().map((s) => s.name), save: (x) => styles.save(x as unknown as Parameters<typeof styles.save>[0]) }),
  group: 'Agents',
  kind: 'style',
  rename(id, name) {
    const st = styles.find(id)
    if (!st) throw new ToolError(`No reasoning style ${id}`)
    styles.save({ id: st.id, name, instruction: st.instruction, voices: st.voices })
  },
  remove: (id) => void styles.delete(id),
  label: 'Reasoning style',
  plural: 'Reasoning styles',
  exportable: true,
  export(id) {
    const { id: _id, updatedAt: _u, ...rest } = styles.find(id) ?? { id, updatedAt: 0 }
    return withJson(this, id, rest)
  },
  icon: 'messages-square',
  description: 'how an agent reasons when it calls reason: an instruction and optional voices that argue it out',
  parts: [],
  actions: [],
  available: () => true,
  title: (id) => styles.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return styles
      .list()
      .filter((st) => !q || has(st.name, q) || has(st.instruction, q))
      .slice(0, limit)
      .map((st) => ({ kind: 'style', id: st.id, title: st.name, at: st.updatedAt || undefined }))
  },
  line: (id) => {
    const st = styles.find(id)
    return st ? styleLine(st) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => styles.find(ref)?.id ?? null,
  full(id) {
    const st = styles.find(id)
    if (!st) throw new ToolError(`No reasoning style ${id}`)
    return [`# ${st.name}`, st.instruction, st.voices.length ? st.voices.map((v) => `- ${v.label}: ${v.line}`).join('\n') : ''].filter(Boolean).join('\n\n')
  }
}

function visibleAgents(ctx: KindContext) {
  const all = agentAccess.list()
  if (ctx.user || !ctx.agentId) return all
  const me = agentAccess.get(ctx.agentId)
  return all.filter((a) => !a.private || me?.private)
}

const agentLine = (a: { description: string; modules: string[] }) => a.description || `${a.modules.length} tool groups`

const agentKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Agents',
  kind: 'agent',
  ...storePacking({
    find: (id) => agentAccess.get(id),
    names: () => agentAccess.list().map((a) => a.name),
    save: ({ id, ...rest }) => agentAccess.save({ ...(rest as unknown as AgentDraft), ...(id ? { id } : {}) }),
    drop: ['createdBy', 'private', 'world', 'folder'],
    refs: [
      { key: 'theme', kind: () => 'theme' },
      { key: 'reasoningStyle', kind: () => 'style' },
      { key: 'sheet', kind: (id) => kindOfPageType(data.pages.metaFor(id)?.type) }
    ]
  }),
  label: 'Agent',
  plural: 'Agents',
  exportable: true,
  export(id) {
    const a = agentAccess.get(id)
    if (!a) throw new ToolError(`No agent ${id}`)
    const { look: _l, ...rest } = a
    return { title: a.name, markdown: `# ${a.name}\n\n${a.description}\n\n## Instructions\n\n${a.systemPrompt}`, json: rest }
  },
  icon: 'bot',
  description: 'the agents the user can talk to: what each one is for, its tools and model',
  parts: [],
  actions: ['agent_create', 'agent_edit'],
  available: () => true,
  title: (id) => agentAccess.get(id)?.name ?? id,
  search(query, limit, ctx) {
    const q = query.toLowerCase()
    return visibleAgents(ctx)
      .filter((a) => !q || has(a.name, q) || has(a.description, q) || has(a.systemPrompt, q))
      .slice(0, limit)
      .map((a) => ({ kind: 'agent', id: a.id, title: a.name, at: a.updatedAt }))
  },
  line: (id, ctx) => {
    const a = visibleAgents(ctx).find((x) => x.id === id)
    return a ? agentLine(a) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref, ctx) => visibleAgents(ctx).find((a) => a.id === ref || a.name.toLowerCase() === ref.trim().toLowerCase())?.id ?? null,
  full(id, _options, ctx) {
    const a = visibleAgents(ctx).find((x) => x.id === id)
    if (!a) throw new ToolError(`No agent ${id}`)
    const maker = a.createdBy ? agentAccess.get(a.createdBy)?.name ?? 'another agent' : null
    const lines = [
      `# ${a.name}`,
      a.description || '(no description)',
      `Tools: ${a.modules.length ? a.modules.join(', ') : 'none yet'}${a.toolsets?.length ? `; toolsets ${a.toolsets.join(', ')}` : ''}. Model: ${a.modelId ?? 'whichever is loaded'}.${a.roleplay ? ' Replies in roleplay style.' : ''}${a.world ? ` Lives in world ${a.world.worldId} as ${a.world.type} ${a.world.id}.` : ''}${maker ? ` Made by ${maker}.` : ''}`,
      `Link: ${linkFor('agent', a.name)}`,
      a.systemPrompt.trim() ? `Instructions:\n${a.systemPrompt.trim().slice(0, 2000)}${a.systemPrompt.length > 2000 ? '\n...' : ''}` : 'No instructions.'
    ]
    return lines.join('\n\n')
  }
}

const themeSummary = (t: Theme) => t.description || themeLine(t)

function themeLine(t: Theme): string {
  const bits = [`colours ${t.accent} / ${t.secondary} on ${t.base}`, t.sky !== 'off' ? `sky ${t.sky}` : '', t.light ? `mood light ${t.light.color}` : '', t.backdrop ? 'background' : '', t.effect !== 'none' ? `${t.effect} effect` : '', t.music.length ? `${t.music.length} music tracks` : '']
  return bits.filter(Boolean).join(', ')
}

const themeKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => themes.find(id), names: () => themes.list().map((t) => t.name), save: (x) => themes.save(x), everywhere: (t) => Boolean(t.builtin), drop: ['builtin'] }),
  group: 'Tools',
  kind: 'theme',
  rename: (id, name) => void themes.save({ id, name }),
  remove: (id) => themes.delete(id),
  label: 'Theme',
  plural: 'Themes',
  exportable: true,
  export(id) {
    const { id: _id, builtin: _b, createdBy: _c, ...rest } = themes.get(id)
    return withJson(this, id, rest)
  },
  icon: 'palette',
  description: "the app's looks and moods: colours, sky, mood light, background, music and sounds",
  parts: [],
  actions: ['theme_save', 'ambience', 'cue'],
  available: () => true,
  title: (id) => themes.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return themes
      .list()
      .filter((t) => !q || has(t.name, q) || has(t.description, q))
      .slice(0, limit)
      .map((t) => ({ kind: 'theme', id: t.id, title: t.name, at: t.updatedAt || undefined }))
  },
  line: (id) => {
    const t = themes.find(id)
    return t ? themeSummary(t) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => themes.find(ref)?.id ?? null,
  full(id) {
    const t = themes.get(id)
    const file = (a: string | null) => (a && data.assets.exists(a) ? data.assets.get(a).name : null)
    const sounds = Object.entries(t.sounds).filter(([, v]) => v).map(([k, v]) => `${k}: ${file(v)}`)
    return [
      `# ${t.name}${t.builtin ? ' (built in, read only)' : ''}`,
      t.description,
      `Colours: accent ${t.accent}, soft ${t.accentSoft}, secondary ${t.secondary}, base ${t.base}. Sky: ${t.sky}. Mood light: ${t.light ? `${t.light.color} at ${t.light.strength}` : 'none'}. Effect: ${t.effect}.`,
      t.backdrop ? `Background: ${[t.backdrop.colors.join(' → '), file(t.backdrop.image)].filter(Boolean).join(' with ')}, dim ${t.backdrop.dim}.` : 'No background picture.',
      `Music: ${t.music.length ? t.music.map((m) => file(m) ?? m).join(', ') : 'none'} (volume ${t.volume}). Sounds: ${sounds.length ? sounds.join(', ') : 'none'}.`
    ].filter(Boolean).join('\n')
  }
}

function accessOf(ctx: KindContext): LibraryAccess {
  if (ctx.user || !ctx.agentId) return { hidden: [], chats: 'all' }
  const a = agentAccess.get(ctx.agentId)
  return { ...DEFAULT_LIBRARY_ACCESS, ...(a?.library ?? {}) }
}

function visibleChats(ctx: KindContext) {
  const access = accessOf(ctx)
  if (access.chats === 'none') return []
  const agents = new Set(agentAccess.list().map((a) => a.id))
  return sessionAccess.list().filter((s) => agents.has(s.agentId) && (access.chats === 'all' || s.agentId === ctx.agentId))
}

function messageText(m: ChatMessage): string {
  return m.parts
    .map((p) => (p.type === 'text' ? p.text : p.type === 'tool' ? `[${p.name}]` : ''))
    .filter(Boolean)
    .join('\n')
    .trim()
}

const chatKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Agents',
  kind: 'chat',
  rename: (id, name) => sessionAccess.rename(id, name),
  remove: (id) => sessionAccess.remove(id),
  label: 'Chat',
  plural: 'Chats',
  exportable: true,
  export: (id) => chatExport(id),
  icon: 'message-square',
  description: 'past conversations; link one as #user or #agent for just that side',
  parts: [],
  linkParts: [
    { name: 'user', description: "only the user's messages" },
    { name: 'agent', description: "only the agent's replies" }
  ],
  actions: [],
  available: (ctx) => accessOf(ctx).chats !== 'none',
  title: (id) => sessionAccess.list().find((s) => s.id === id)?.title ?? id,
  search(query, limit, ctx) {
    const q = query.toLowerCase()
    const out: KindHit[] = []
    for (const s of visibleChats(ctx)) {
      if (q && !has(s.title, q) && !sessionAccess.messages(s.id).some((m) => has(messageText(m), q))) continue
      out.push({ kind: 'chat', id: s.id, title: s.title, at: s.updatedAt })
      if (out.length >= limit) break
    }
    return out
  },
  resolve: (ref, ctx) => visibleChats(ctx).find((s) => s.id === ref || s.title.toLowerCase() === ref.trim().toLowerCase())?.id ?? null,
  line: (id, ctx) => {
    const s = visibleChats(ctx).find((x) => x.id === id)
    return s ? (agentAccess.get(s.agentId)?.name ?? s.agentId) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id, options, ctx) {
    const s = visibleChats(ctx).find((x) => x.id === id)
    if (!s) throw new ToolError(`No chat ${id}`)
    const name = agentAccess.get(s.agentId)?.name ?? 'Agent'
    const side = options.part === 'user' ? 'user' : options.part === 'agent' ? 'assistant' : null
    const lines = sessionAccess
      .messages(id)
      .filter((m) => !side || m.role === side)
      .map((m) => ({ m, text: messageText(m) }))
      .filter(({ text }) => text)
      .map(({ m, text }) => `**${m.role === 'user' ? 'User' : name}** (${new Date(m.createdAt).toLocaleString()}):\n${text}`)
    const tail = lines.join('\n\n')
    const only = side === 'user' ? " Only the user's messages." : side ? ` Only ${name}'s replies.` : ''
    return `# ${s.title}\nWith ${name}, ${new Date(s.createdAt).toLocaleDateString()} to ${new Date(s.updatedAt).toLocaleDateString()}.${only}\n\n${tail || '(no messages)'}`
  }
}

function stories(): StoryRun[] {
  return storyRuns.list()
}

const storyLine = (r: StoryRun) => `${r.template_id}, ${r.status ?? 'active'}, act ${r.current_act_index + 1}, turn ${r.turn}`

const storyKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Worlds',
  kind: 'story',
  remove: (id) => storyRuns.delete(id),
  label: 'Story',
  textParts: ['summary'],
  plural: 'Stories',
  exportable: true,
  export(id) {
    return withJson(this, id, storyRuns.get(id))
  },
  icon: 'book-open',
  description: 'Storyteller runs: branching stories with acts, what is true in them, and where they stand',
  parts: ['summary'],
  actions: ['list_stories', 'start_story', 'load_story_context', 'checkpoint_story', 'record_facts', 'close_story', 'resume_story'],
  available: () => modules.list().some((m) => m.id === 'storyteller' && m.state === 'on'),
  title: (id) => id,
  search(query, limit) {
    const q = query.toLowerCase()
    return stories()
      .filter((r) => !q || has(r.id, q) || has(r.template_id, q) || has(r.narrative_context ?? '', q))
      .slice(0, limit)
      .map((r) => ({ kind: 'story', id: r.id, title: r.id, at: r.at }))
  },
  line: (id) => {
    const r = stories().find((x) => x.id === id)
    return r ? storyLine(r) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  resolve: (ref) => stories().find((r) => r.id === ref || r.id.toLowerCase() === ref.toLowerCase())?.id ?? null,
  full(id) {
    const r = stories().find((x) => x.id === id)
    if (!r) throw new ToolError(`No story ${id}`)
    const facts = Object.entries(r.facts ?? {})
      .slice(0, 20)
      .map(([k, f]) => `- ${k} (${f.kind}, ${f.status}): ${f.summary}`)
    return `Story ${r.id} from ${r.template_id}: ${r.status ?? 'active'}, act ${r.current_act_index + 1}, turn ${r.turn}.\nNow: ${r.narrative_context || r.current_cta || 'not set'}${r.closing_note ? `\nClosing note: ${r.closing_note}` : ''}${facts.length ? `\nWhat's true:\n${facts.join('\n')}` : ''}`
  }
}

const scriptLine = (x: { description: string; code: string }) => x.description || `${x.code.split('\n').length} lines`

const scriptKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => scripts.find(id), names: () => scripts.list().map((s) => s.name), save: (x) => scripts.save(x as unknown as Parameters<typeof scripts.save>[0]), drop: ['runs'] }),
  group: 'Yours',
  kind: 'script',
  rename(id, name) {
    const s = scripts.find(id)
    if (!s) throw new ToolError(`No script ${id}`)
    scripts.save({ id: s.id, name, code: s.code, description: s.description })
  },
  remove: (id) => scripts.delete(id),
  label: 'Python script',
  plural: 'Python',
  exportable: true,
  export(id) {
    const x = scripts.get(id)
    return { title: x.name, markdown: `# ${x.name}\n\n${x.description ? `${x.description}\n\n` : ''}\`\`\`python\n${x.code}\n\`\`\``, json: { name: x.name, description: x.description, code: x.code } }
  },
  icon: 'code',
  description: 'saved Python scripts and their last runs',
  parts: ['code', 'output'],
  actions: ['run_python', 'python_save'],
  available: () => modules.list().some((m) => m.id === 'python' && m.state === 'on'),
  title: (id) => scripts.find(id)?.name ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return scripts
      .list()
      .filter((x) => !q || has(x.name, q) || has(x.description, q) || has(x.code, q))
      .slice(0, limit)
      .map((x) => ({ kind: 'script', id: x.id, title: x.name, at: Math.max(x.updatedAt, x.runs[0]?.at ?? 0) }))
  },
  resolve: (ref) => scripts.find(ref)?.id ?? null,
  line: (id) => {
    const x = scripts.find(id)
    return x ? scriptLine(x) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id) {
    const x = scripts.get(id)
    const last = x.runs[0]
    return `Script ${x.name}${x.description ? `: ${x.description}` : ''}\n\`\`\`python\n${x.code}\n\`\`\`${last ? `\nLast run ${new Date(last.at).toLocaleString()}, exit ${last.exit ?? 'none'}:\n${last.output.slice(0, 1500) || '(no output)'}` : '\nNot run yet.'}`
  }
}

const messageKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Tools',
  kind: 'message',
  label: 'Message',
  plural: 'Message board',
  textParts: ['summary'],
  exportable: true,
  icon: 'messages-square',
  description: 'the board every agent shares across chats: messages agents left for each other',
  parts: ['summary'],
  actions: ['add_message', 'read_messages'],
  available: () => true,
  title: (id) => board.list().find((m) => m.id === id)?.text.slice(0, 80) ?? id,
  search(query, limit) {
    const q = query.toLowerCase()
    return board
      .list()
      .reverse()
      .filter((m) => !q || has(m.text, q) || has(m.author, q))
      .slice(0, limit)
      .map((m) => ({ kind: 'message', id: m.id, title: m.text.slice(0, 80), at: m.at }))
  },
  resolve: (ref) => (board.list().some((m) => m.id === ref) ? ref : null),
  line: (id) => board.list().find((m) => m.id === id)?.author ?? '',
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const m = board.list().find((x) => x.id === id)
    if (!m) throw new ToolError(`No message ${id} on the board. find with kind message lists them.`)
    return board.text([m])
  },
  remove: (id) => board.remove(id)
}

const weblogLine = (e: WebLogEntry) => `${e.kind}, ${e.outcome}`

const weblogKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Tools',
  kind: 'weblog',
  label: 'Web log',
  textParts: ['summary'],
  plural: 'Web log',
  exportable: true,
  icon: 'globe',
  description: 'every web search and page read agents made, with what was allowed (read only)',
  parts: ['summary'],
  actions: [],
  available: () => fs.existsSync(WEB_LOG),
  title: (id) => id,
  search(query, limit) {
    const q = query.toLowerCase()
    return readLines<WebLogEntry>(WEB_LOG)
      .map((e, i) => ({ e, i }))
      .reverse()
      .filter(({ e }) => !q || has(e.target, q))
      .slice(0, limit)
      .map(({ e, i }) => ({ kind: 'weblog', id: String(i), title: e.target.slice(0, 80), at: e.at }))
  },
  resolve: (ref) => (/^\d+$/.test(ref) ? ref : null),
  line: (id) => {
    const e = readLines<WebLogEntry>(WEB_LOG)[Number(id)]
    return e ? weblogLine(e) : ''
  },
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id) {
    const e = readLines<WebLogEntry>(WEB_LOG)[Number(id)]
    if (!e) throw new ToolError(`There is no web log entry ${id}. find with kind weblog lists them.`)
    return `${e.kind === 'search' ? 'Search' : 'Read'} ${e.target}: ${e.outcome} at ${new Date(e.at).toLocaleString()}${e.note ? ` (${e.note})` : ''}.`
  }
}

const repoLine = (r: { values: unknown[]; tags: string[] }) => `${r.values.length} values${r.tags.length ? ` · #${r.tags.join(' #')}` : ''}`

const repoKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'repo',
  pageTypes: REPO_TYPES,
  label: 'Repo',
  plural: 'Repos',
  exportable: true,
  export: (id) => withJson(repoKind, id, getRepo(id)),
  icon: 'dices',
  description: 'lists of anything to pick from at random (names, races, car models, twists); {Other repo} or {tag:x} inside a value rolls from that too',
  parts: [],
  actions: ['repo_write', 'pick_random'],
  available: () => true,
  title: (id) => getRepo(id).title,
  search(query, limit) {
    const q = query.toLowerCase()
    return repoIds()
      .map((m) => getRepo(m.id))
      .filter((r) => !q || has(r.title, q) || r.tags.some((t) => has(t, q)))
      .slice(0, limit)
      .map((r) => ({ kind: 'repo', id: r.id, title: r.title, at: r.updatedAt }))
  },
  resolve: (ref) => findRepo(ref),
  line: (id) => repoLine(getRepo(id)),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full: (id) => withTags(repoMarkdown(id), id),
  remove: (id) => void data.pages.delete(id),
  rename: (id, name) => void data.pages.write({ ref: id, title: name }),
  roll: (id) => rollRepo(id),
  draw: (id, count) => drawRepo(id, count)
}


const sheetKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'sheet',
  ...pagePacking(),
  pageTypes: [SHEET_TYPE],
  label: 'Character',
  plural: 'Characters',
  exportable: true,
  export: (id) => withJson(sheetKind, id, getSheet(id)),
  icon: 'id-card',
  description: 'characters, yours or for agents to play: named fields of text, and D&D stats with a story log; an agent can wear one as its character',
  parts: ['sheet'],
  defaultPart: () => 'sheet',
  actions: ['sheet_write', 'update_stats', 'update_proficiencies', 'add_story_log', 'set_story_where'],
  available: () => true,
  title: (id) => getSheet(id).title,
  search(query, limit) {
    const q = query.toLowerCase()
    return sheetIds()
      .map((m) => getSheet(m.id))
      .filter((s) => !q || has(s.title, q) || Object.values(s.values).some((v) => has(v, q)))
      .slice(0, limit)
      .map((s) => ({ kind: 'sheet', id: s.id, title: s.title, at: s.updatedAt }))
  },
  resolve: (ref) => findSheet(ref),
  line: (id) => sheetLine(getSheet(id)),
  fields: (id) => {
    const s = getSheet(id)
    return [...s.fields.map((f) => ({ name: f, text: s.values[f] ?? '' })), { name: 'Where now', text: s.story.where }]
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  handTo: SHEET_HAND_TO,
  full: (id) => withTags(sheetMarkdown(id), id),
  remove: (id) => void data.pages.delete(id),
  rename: (id, name) => void data.pages.write({ ref: id, title: name })
}

const slideshowLine = (id: string) => `${getSlideshow(id).pictures.length} pictures`

const slideshowKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'slideshow',
  ...pagePacking(),
  pageTypes: [SLIDESHOW_TYPE],
  label: 'Slideshow',
  plural: 'Slideshows',
  exportable: true,
  export: (id) => withJson(slideshowKind, id, getSlideshow(id)),
  icon: 'gallery-horizontal',
  description: 'pictures from your files that play one after another, in the side panel, on a board or as the chat background',
  parts: ['show'],
  defaultPart: () => 'show',
  actions: ['add_slideshow', 'update_slideshow'],
  available: () => true,
  title: (id) => getSlideshow(id).title,
  search(query, limit) {
    const q = query.toLowerCase()
    return slideshowIds()
      .filter((s) => !q || has(s.title, q))
      .slice(0, limit)
      .map((s) => ({ kind: 'slideshow', id: s.id, title: s.title, at: s.updatedAt }))
  },
  resolve: (ref) => findSlideshow(ref),
  line: slideshowLine,
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full: (id) => withTags(slideshowText(id), id),
  remove: (id) => void data.pages.delete(id),
  rename: (id, name) => void data.pages.write({ ref: id, title: name })
}

const commandKind: Kind = {
  presents: { chat: true },
  ...storePacking({ find: (id) => customCommands.find(id), names: () => customCommands.list().map((c) => c.name), save: ({ id, ...rest }) => customCommands.save({ ...(rest as unknown as Parameters<typeof customCommands.save>[0]), id: id ? (customCommands.find(id)?.id ?? null) : null }), next: (name, n) => `${name}-${n}` }),
  group: 'Tools',
  kind: 'command',
  label: 'Command',
  plural: 'Commands',
  exportable: true,
  icon: 'terminal',
  description: 'slash commands the user can type in a chat, like /help',
  parts: [],
  actions: [],
  available: () => true,
  remove(id) {
    const c = customCommands.find(id)
    if (!c) throw new ToolError(`/${id} is built in and can't be deleted`)
    customCommands.delete(c.id)
  },
  rename(id, name) {
    if (!customCommands.find(id)) throw new ToolError(`/${id} is built in and can't be renamed`)
    customCommands.rename(id, name)
  },
  title: (id) => `/${id}`,
  search(query, limit, ctx) {
    const q = query.toLowerCase().replace(/^\//, '')
    return commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' })
      .filter((c) => !q || has(c.name, q) || has(c.summary, q))
      .slice(0, limit)
      .map((c) => ({ kind: 'command', id: c.name, title: `/${c.name}` }))
  },
  resolve: (ref, ctx) => findCommand(commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' }), ref)?.name ?? null,
  line: (id, ctx) => findCommand(commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' }), id)?.summary ?? '',
  card(id, ctx) {
    return this.full(id, {}, ctx)
  },
  full(id, _options, ctx) {
    const c = findCommand(commandsFor({ sessionId: null, agentId: ctx.agentId ?? '' }), id)
    if (!c) throw new ToolError(`No command /${id}`)
    return c.usage
  }
}

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function dayFrom(ref: string): string | null {
  const r = ref.trim().replace(/^"|"$/g, '').toLowerCase()
  if (r === 'today') return dayKey(Date.now())
  if (r === 'yesterday') return dayKey(Date.now() - DAY_MS)
  if (DAY_ID.test(r)) return r
  return timeline.days(400).find((d) => dayTitle(d.day).toLowerCase() === r)?.day ?? null
}

interface ShownEvent {
  event: TimelineEvent
  kind: Kind
  id: string
  title: string
}

export function entryId(kind: Kind, id: string, title: string, ctx: KindContext): string {
  if (kind.root !== undefined && id === kind.root) return kind.root
  const tree = data.pages.tree()
  if (tree.list.some((p) => p.id === id && pageKindOf(p.type) === kind.kind)) return tree.pathOf(id)
  const named = toId(title)
  try {
    return named && resolveEntry(named, kind.kind, ctx).id === id ? named : id
  } catch {
    return id
  }
}

function shownEvents(events: TimelineEvent[], ctx: KindContext): ShownEvent[] {
  const byKind = new Map(kinds(ctx).map((k) => [k.kind, k]))
  const seen = new Map<string, { id: string; title: string } | null>()
  const look = (kindName: string, entry: string) => {
    const key = `${kindName}/${entry}`
    if (seen.has(key)) return seen.get(key)!
    const k = byKind.get(kindName)
    let found: { id: string; title: string } | null = null
    try {
      const id = k?.resolve(entry, ctx)
      if (k && id) found = { id, title: k.title(id) }
    } catch {
      found = null
    }
    seen.set(key, found)
    return found
  }
  const out: ShownEvent[] = []
  for (const event of events) {
    const k = byKind.get(event.kind)
    const hit = look(event.kind, event.entry)
    if (k && hit) out.push({ event, kind: k, id: hit.id, title: hit.title })
  }
  return out
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function eventLine(s: ShownEvent, ctx: KindContext, withLinks = true): string {
  const e = s.event
  const agent = e.by ? (agentAccess.get(e.by)?.name ?? 'An agent') : null
  const you = ctx.user ? 'You' : 'The user'
  const who = agent ?? you
  const ref = withLinks ? linkFor(s.kind.kind, entryId(s.kind, s.id, s.title, ctx)) : s.title
  let chat = ''
  if (e.chat && e.action !== 'talked' && withLinks) {
    const c = shownEvents([{ ...e, kind: 'chat', entry: e.chat }], ctx)[0]
    if (c) chat = ` in ${linkFor('chat', entryId(c.kind, c.id, c.title, ctx))}`
  }
  if (e.action === 'talked') return `${you} and ${agent ?? 'an agent'} talked in ${ref}`
  if (e.action === 'remembered') return `${who} remembered something${ctx.user && withLinks ? ` (${ref})` : ''}${chat}`
  if (e.action === 'fired') return `A reminder went off: ${ref}`
  if (e.action === 'ran') return `Routine ${ref} ran${chat}`
  return `${who} ${e.action} ${s.kind.label.toLowerCase()} ${ref}${chat}`
}

const dayLine = (count: number) => `${count} thing${count === 1 ? '' : 's'} happened`

const dayKind: Kind = {
  group: 'Time',
  kind: 'day',
  label: 'Day',
  plural: 'Days',
  icon: 'calendar-days',
  description: 'what happened on a day (who made, changed or talked about what), generated from the timeline each time it is read; today and yesterday work as names',
  parts: ['summary'],
  textParts: ['summary'],
  actions: [],
  exportable: true,
  export(id, ctx) {
    return { title: dayTitle(id), markdown: this.full(id, {}, ctx), json: shownEvents(timeline.day(id), ctx).map((s) => ({ ...s.event, title: s.title })) }
  },
  remove(id, ctx) {
    if (!ctx.user) throw new ToolError('Only the user can forget a day')
    timeline.forgetDay(id)
  },
  available: () => true,
  title: (id) => dayTitle(id),
  search(query, limit, ctx) {
    const q = query.trim().toLowerCase()
    return timeline
      .days(400)
      .filter((d) => !q || d.day.includes(q) || dayTitle(d.day).toLowerCase().includes(q))
      .map((d) => ({ d, count: shownEvents(timeline.day(d.day), ctx).length }))
      .filter((x) => x.count > 0)
      .slice(0, limit)
      .map(({ d }) => ({ kind: 'day', id: d.day, title: dayTitle(d.day), at: d.last }))
  },
  resolve: (ref) => dayFrom(ref),
  line: (id, ctx) => dayLine(shownEvents(timeline.day(id), ctx).length),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id, _options, ctx) {
    const shown = shownEvents(timeline.day(id), ctx)
    const today = dayKey(Date.now())
    const when = id === today ? ' (today)' : id === dayKey(Date.now() - DAY_MS) ? ' (yesterday)' : ''
    const lines = shown.map((s) => {
      const span = s.event.last - s.event.at > 5 * 60_000 ? `${clock(s.event.at)}–${clock(s.event.last)}` : clock(s.event.at)
      return `- ${span} ${eventLine(s, ctx, true)}`
    })
    return `# ${dayTitle(id)}${when}\nGenerated from the timeline each time it is read, so it is always current.\n\n${lines.join('\n') || 'Nothing recorded.'}`
  }
}

function eventWhat(e: TimelineEvent, ctx: KindContext): string {
  const agent = e.by ? (agentAccess.get(e.by)?.name ?? 'An agent') : null
  const who = agent ?? (ctx.user ? 'You' : 'The user')
  if (e.action === 'talked') return `Talked with ${agent ?? 'an agent'}`
  if (e.action === 'remembered') return `${who} remembered something`
  if (e.action === 'fired') return 'Reminder went off'
  if (e.action === 'ran') return 'Routine ran'
  return `${who} ${e.action} it`
}

export function describeEvent(e: TimelineEvent): string {
  const shown = shownEvents([e], USER)[0]
  return shown ? eventLine(shown, USER) : `${e.kind} ${e.action}`
}

export function resolveRoutineEntry(kindName: string, link: string): string {
  const k = kindFor(kindName, USER)
  if (!k) throw new Error(`No kind "${kindName}"`)
  const raw = link.trim()
  const ref = raw.startsWith('@') ? splitLink(raw).ref : raw
  const id = k.resolve(ref, USER)
  if (!id) throw new Error(`There is no ${k.label.toLowerCase()} called "${ref}". Use the exact name or @${k.kind} link of one that exists.`)
  return id
}

function routineWhen(r: Routine): string {
  if (r.when.type === 'schedule') {
    const repeat = ROUTINE_REPEATS.find((x) => x.id === (r.when as { repeat: string }).repeat)?.label.toLowerCase() ?? ''
    return `${repeat}, from ${new Date(r.when.at).toLocaleString()}`
  }
  const w = r.when
  const k = kindFor(w.kind, USER)
  let what = k ? `a ${k.label.toLowerCase()}` : w.kind
  if (w.entry && k) {
    try {
      what = linkFor(k.kind, k.title(w.entry))
    } catch {
      what = w.entry
    }
  }
  return `when ${what} is ${w.action === 'any' ? 'made or changed' : w.action}${w.byUser ? ' by the user' : ''}`
}

const routineLine = (r: Parameters<typeof routineWhen>[0] & { enabled: boolean }) => `${r.enabled ? '' : 'off · '}${routineWhen(r)}`

const routineKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({ find: (id) => routines.get(id), names: () => routines.list().map((r) => r.name), save: (x) => routines.save(x as unknown as Parameters<typeof routines.save>[0]), drop: ['next', 'lastRun', 'lastChat', 'lastError', 'running', 'enabled'], refs: [{ key: 'agentId', kind: () => 'agent' }] }),
  group: 'Time',
  kind: 'routine',
  label: 'Routine',
  plural: 'Routines',
  icon: 'workflow',
  description: 'unattended work the user set up: which agent, what it does, when, and where the result goes; only the user can make or change them',
  parts: [],
  actions: [],
  exportable: true,
  export(id) {
    return withJson(this, id, routines.get(id))
  },
  remove(id, ctx) {
    if (!ctx.user) throw new ToolError('Only the user can delete a routine')
    routines.delete(id)
  },
  rename(id, name, ctx) {
    if (!ctx.user) throw new ToolError('Only the user can rename a routine')
    routines.rename(id, name)
  },
  available: () => true,
  title: (id) => routines.get(id)?.name ?? id,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return routines
      .list()
      .filter((r) => !q || has(r.name, q) || has(r.instruction, q))
      .slice(0, limit)
      .map((r) => ({ kind: 'routine', id: r.id, title: r.name, at: r.lastRun ?? r.updatedAt }))
  },
  resolve: (ref) => routines.get(ref)?.id ?? null,
  line: (id) => {
    const r = routines.get(id)
    return r ? routineLine(r) : ''
  },
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full(id) {
    const r = routines.get(id)
    if (!r) throw new ToolError(`No routine ${id}`)
    const agent = agentAccess.get(r.agentId)?.name ?? 'a missing agent'
    const out = [r.output.chat === 'same' ? 'one ongoing chat' : 'a new chat each run', r.output.page ? `added to ${linkFor('page', r.output.page)}` : '', r.output.notify ? 'a notification' : ''].filter(Boolean).join(', ')
    return [
      `# ${r.name}`,
      `${r.enabled ? 'On' : 'Off'}. ${agent} runs it ${routineWhen(r)}.`,
      `Result goes to: ${out}.`,
      r.next ? `Next run: ${new Date(r.next).toLocaleString()}.` : '',
      r.lastRun ? `Last run: ${new Date(r.lastRun).toLocaleString()}${r.lastError ? ` (failed: ${r.lastError})` : ''}.` : 'Not run yet.',
      `\nInstruction:\n${r.instruction}`
    ]
      .filter(Boolean)
      .join('\n')
  }
}

export function timelineRows(limit: number, ctx: KindContext = USER): TimelineRow[] {
  return shownEvents(timeline.recent(limit), ctx)
    .slice(0, limit)
    .map((s) => ({ kind: s.kind.kind, id: s.id, title: s.title, icon: s.kind.icon, label: s.kind.label, what: eventWhat(s.event, ctx), at: s.event.last }))
}

function addonKinds(): Kind[] {
  return modules.pageTypes().map(({ module, spec }) => {
    const type = `${module}:${spec.type}`
    const info = modules.list().find((m) => m.id === module)
    const kind = pageKindOf(type)
    return {
      kind,
      presents: { chat: true },
      ...pagePacking(),
      label: spec.label,
      plural: spec.plural,
      source: info?.name ?? module,
      group: spec.group || info?.name || module,
      exportable: true,
      handTo: PAGE_HAND_TO,
      pageTypes: [type],
      missing: (ref) => data.pages.missing(ref, kind),
      export: (id) => pageExport(data.pages.get(id)),
      textParts: ['summary'],
      readView: (id, options, ctx) => readPageView(id, options, ctx),
      place: (id, part, onBoard) => (!part && onBoard ? { kind: 'page', pageId: id } : null),
      icon: spec.icon || 'box',
      description: spec.description || info?.description || spec.label,
      parts: [...Object.keys(spec.parts), 'picture', 'summary'],
      actions: spec.actions,
      title: (id) => data.pages.get(id).title,
      available: () => true,
      search(query, limit) {
        const q = query.toLowerCase()
        return data.pages
          .ofType(type)
          .filter((p) => !q || has(p.title, q) || has(p.summary, q))
          .slice(0, limit)
          .map((p) => ({ kind, id: p.id, title: p.title, at: p.updatedAt }))
      },
      resolve(ref) {
        return data.pages.find(ref, (p) => p.type === type)?.id ?? null
      },
      line: (id) => data.pages.metaFor(id)?.summary || spec.label,
      card: (id) => pageExport(data.pages.get(id)).markdown,
      full: (id, options, ctx) => readPage(id, options, ctx).text,
      remove: (id) => void data.pages.delete(id),
      rename: (id, name) => void data.pages.write({ ref: id, title: name, body: null }),
      ...(spec.rollable
        ? {
            roll(id: string) {
              const value = modules.pageRoll(id)
              if (value === null) throw new ToolError(`"${data.pages.metaFor(id)?.title ?? id}" can't be rolled right now: its tool may be off, or it has nothing to pick from. read it to see what it holds.`)
              return value
            },
            draw(id: string, count: number) {
              const values = modules.pageDraw(id, count)
              if (values === null) throw new ToolError(`"${data.pages.metaFor(id)?.title ?? id}" can't be drawn from right now: its tool may be off, or it has nothing to pick from.`)
              return values
            }
          }
        : {})
    }
  })
}

export function rollEntry(entry: string, ctx: KindContext = USER): string {
  const { kind, id } = resolveEntry(entry.trim().replace(/^@/, '').replace(/:/, '/').replace(/^"|"$/g, ''), null, ctx)
  if (!kind.roll) throw new ToolError(`${kind.plural} can't be rolled. Roll an entry that can be, such as a repo; find with kind repo lists them.`)
  return kind.roll(id)
}

export function drawEntry(entry: string, count: number, ctx: KindContext = USER): string[] {
  const { kind, id } = resolveEntry(entry, null, ctx)
  if (kind.draw) return kind.draw(id, count)
  const roll = kind.roll
  if (!roll) throw new ToolError(`${kind.plural} can't be drawn from. Draw from an entry that can be rolled, such as a repo.`)
  return Array.from({ length: count }, () => roll(id))
}

export function drawableEntries(ctx: KindContext = USER): Hit[] {
  return kinds(ctx)
    .filter((k) => k.roll)
    .flatMap((k) => lined(k, k.search('', 2000, ctx), ctx))
}

export function previewEntry(entry: string, ctx: KindContext = USER): EntryPreview {
  const { kind, id } = resolveEntry(entry, null, ctx)
  const page = data.pages.metaFor(id)
  const asset = kind.asset?.(id) ?? null
  const title = kind.title(id)
  return {
    kind: kind.kind,
    label: kind.label,
    icon: kind.icon,
    id,
    title,
    card: withoutTitle(kind.card(id, ctx), title),
    image: page?.image ?? (asset && (asset.kind === 'image' || asset.kind === 'video') ? asset.id : null)
  }
}

const ROLL = /@([a-z][\w.:-]*?):("[^"]+"|[^\s,;!?)#]+)#random(?=[\s,.;!?)]|$)/gi

export function rollText(text: string): { text: string; rolled: { token: string; value: string; error?: string }[] } {
  const rolled: { token: string; value: string; error?: string }[] = []
  const out = text.replace(ROLL, (token, kind: string, ref: string) => {
    try {
      const value = rollEntry(`${kind}/${ref.replace(/^"|"$/g, '')}`)
      rolled.push({ token, value })
      return value
    } catch (err) {
      rolled.push({ token, value: token, error: err instanceof Error ? err.message : String(err) })
      return token
    }
  })
  return { text: out, rolled }
}

function withNexus(list: Kind[]): Kind[] {
  const taken = new Set(list.map((k) => k.kind))
  const claimed = new Set(list.flatMap((k) => (k.worldType ? [k.worldType] : [])))
  const at = list.indexOf(worldKind)
  return [...list.slice(0, at + 1), ...nexusKinds(taken, claimed), ...list.slice(at + 1)]
}

function everyKind(): Kind[] {
  return withNexus([pageKind, folderKind, sheetKind, slideshowKind, repoKind, ...addonKinds(), fileKind, workoutEntryKind, exerciseKind, ...moduleKinds(), worldKind, mapKind, placeKind, storyKind, scriptKind, skillKind, reminderKind, chatKind, agentKind, themeKind, memoryKind, thoughtKind, styleKind, boardKind, messageKind, weblogKind, commandKind, dayKind, routineKind])
}

setWidgetKinds(everyKind)

export function kinds(ctx: KindContext = USER): Kind[] {
  const hidden = new Set(accessOf(ctx).hidden)
  return everyKind().filter((k) => {
    if (hidden.has(k.kind)) return false
    try {
      return k.available(ctx)
    } catch {
      return false
    }
  })
}

export function allKinds(): { kind: string; label: string; description: string; short: string; rollable: boolean; parts: { name: string; description: string }[] }[] {
  const list = withNexus([pageKind, folderKind, sheetKind, slideshowKind, repoKind, ...addonKinds(), fileKind, workoutEntryKind, exerciseKind, ...moduleKinds(), worldKind, mapKind, placeKind, storyKind, scriptKind, skillKind, reminderKind, agentKind, themeKind, thoughtKind, styleKind, boardKind, messageKind, weblogKind, commandKind, dayKind, routineKind])
  const shortOf = (k: Kind) => {
    const label = k.label.toLowerCase()
    return /^[a-z][\w-]*$/.test(label) && !list.some((o) => o !== k && (o.kind === label || o.label.toLowerCase() === label)) ? label : k.kind
  }
  return list.map((k) => ({ kind: k.kind, label: k.label, description: k.description, short: shortOf(k), rollable: Boolean(k.roll), parts: k.linkParts ?? [] }))
}

export function hiddenActions(agentId: string): Set<string> {
  const hidden = new Set(accessOf({ agentId }).hidden)
  const incognito = agentAccess.get(agentId)?.incognito === true
  const out = new Set<string>()
  if (!hidden.size && !incognito) return out
  for (const k of withNexus([pageKind, folderKind, sheetKind, slideshowKind, repoKind, ...addonKinds(), fileKind, workoutEntryKind, exerciseKind, ...moduleKinds(), worldKind, mapKind, placeKind, storyKind, scriptKind, skillKind, reminderKind, agentKind, themeKind, thoughtKind, styleKind, boardKind, messageKind, weblogKind, commandKind])) if (hidden.has(k.kind) || (incognito && k.lasting)) for (const a of k.actions) out.add(a)
  return out
}

export function canSee(kindName: string, ctx: KindContext): boolean {
  return !accessOf(ctx).hidden.includes(kindName)
}

function kindFlags(k: Kind): KindFlags {
  return { exportable: k.exportable, removable: Boolean(k.remove), renamable: Boolean(k.rename), carriable: Boolean(k.pack && k.unpack), boardable: Boolean(k.presents?.widget || k.place), family: k.family ?? null }
}

export function kindInfo(): KindInfo[] {
  return kinds(USER).map((k) => {
    let count = 0
    try {
      count = k.search('', 10_000, USER).length
    } catch {
      count = 0
    }
    let agents = true
    try {
      agents = k.available({ agentId: '_any' })
    } catch {
      agents = false
    }
    return { kind: k.kind, label: k.label, plural: k.plural, icon: k.icon, description: k.description, count, parts: k.parts, actions: k.actions, source: k.source ?? null, agents, ...kindFlags(k) }
  })
}

function tagged(hits: KindHit[]): KindHit[] {
  return hits.map((h) => {
    const t = tagStore.of(h.kind, h.id)
    return t.length ? { ...h, tags: t } : h
  })
}

function fuzzyHits(k: Kind, all: KindHit[], text: string, limit: number, ctx: KindContext): KindHit[] {
  if (!all.length || !text.trim()) return []
  const index = new MiniSearch<{ i: number; title: string; summary: string; tags: string }>({
    idField: 'i',
    fields: ['title', 'summary', 'tags'],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: (term) => term.length > 2, fuzzy: (term) => (term.length > 3 ? 0.2 : false), combineWith: 'OR' }
  })
  index.addAll(all.map((h, i) => ({ i, title: h.title, summary: k.line(h.id, ctx), tags: (h.tags ?? []).join(' ') })))
  return index
    .search(text)
    .slice(0, limit)
    .map((r) => all[r.id as number])
}

function lined(k: Kind, hits: KindHit[], ctx: KindContext): Hit[] {
  return hits.map((h) => ({ ...h, summary: k.line(h.id, ctx) }))
}

function searchKind(k: Kind, query: string, limit: number, ctx: KindContext): KindHit[] {
  const { text, tags } = splitTags(query)
  if (!tags.length) {
    const direct = tagged(k.search(text, limit, ctx))
    const word = cleanTag(text)
    let out = direct
    if (word && tagStore.counts(k.kind).some((c) => c.tag === word)) {
      const seen = new Set(direct.map((h) => h.id))
      const byTag = tagged(k.search('', 10_000, ctx)).filter((h) => !seen.has(h.id) && h.tags?.includes(word))
      out = [...byTag, ...direct].slice(0, limit)
    }
    if (!text.trim() || out.length >= limit) return out
    const seen = new Set(out.map((h) => h.id))
    const near = fuzzyHits(k, tagged(k.search('', 10_000, ctx)), text, limit, ctx).filter((h) => !seen.has(h.id))
    return [...out, ...near].slice(0, limit)
  }
  return tagged(k.search(text, 10_000, ctx))
    .filter((h) => tags.every((t) => h.tags?.includes(t)))
    .slice(0, limit)
}

export function entriesTagged(tag: string, ctx: KindContext = USER): { kind: Kind; id: string }[] {
  const word = cleanTag(tag)
  if (!word) return []
  const out: { kind: Kind; id: string }[] = []
  for (const k of kinds(ctx)) {
    try {
      for (const h of searchKind(k, `#${word}`, 100_000, ctx)) out.push({ kind: k, id: h.id })
    } catch {
      continue
    }
  }
  return out
}

export function clearKind(kindName: string): { removed: number; failed: number } {
  const k = kindFor(kindName, USER)
  if (!k?.remove) throw new Error(`${kindName} can't be cleared here`)
  let removed = 0
  let failed = 0
  for (const h of k.search('', 1_000_000, USER)) {
    try {
      k.remove(h.id, USER)
      tagStore.set(k.kind, h.id, [])
      timeline.forget(k.kind, h.id)
      removed += 1
    } catch {
      failed += 1
    }
  }
  return { removed, failed }
}

export function removeEntry(entry: string): void {
  const { kind, id } = resolveEntry(entry, null, USER)
  if (!kind.remove) throw new ToolError(`${kind.plural} can't be deleted here`)
  kind.remove(id, USER)
  timeline.forget(kind.kind, id)
}

export function renameEntry(entry: string, name: string): string {
  const { kind, id } = resolveEntry(entry, null, USER)
  if (!kind.rename) throw new Error(`${kind.plural} can't be renamed`)
  if (!name.trim()) throw new Error('Give a name')
  kind.rename(id, name.trim(), USER)
  return kind.title(id)
}

export function setTags(entry: string, add: string[], remove: string[], ctx: KindContext = USER): { kind: Kind; id: string; tags: string[] } {
  const { kind, id } = resolveEntry(entry, null, ctx)
  return { kind, id, tags: tagStore.change(kind.kind, id, add, remove) }
}

export function overview(query: string, perKind: number, ctx: KindContext = USER): LibrarySection[] {
  const out: LibrarySection[] = []
  for (const k of kinds(ctx)) {
    let all: KindHit[]
    try {
      all = searchKind(k, query, 10_000, ctx)
    } catch {
      continue
    }
    if (query && !all.length) continue
    const sorted = all.some((h) => h.at !== undefined) ? [...all].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)) : all
    out.push({ kind: k.kind, label: k.label, plural: k.plural, icon: k.icon, description: k.description, count: all.filter((h) => !k.isGenerated?.(h.id)).length, entries: lined(k, sorted.slice(0, perKind), ctx), group: k.group, ...kindFlags(k) })
  }
  return out
}

export function kindNamed(name: string, ctx: KindContext = USER): Kind | undefined {
  return kinds(ctx).find((k) => k.kind === name)
}

function kindFor(name: string, ctx: KindContext): Kind | undefined {
  const n = name.trim().toLowerCase()
  return kinds(ctx).find((k) => k.kind === n || k.label.toLowerCase() === n || k.plural.toLowerCase() === n)
}

export function find(query: string, kindName: string | null, limit = 15, ctx: KindContext = USER): Hit[] {
  const list = kindName ? [kindFor(kindName, ctx)].filter((k): k is Kind => Boolean(k)) : kinds(ctx)
  if (kindName && !list.length) throw new ToolError(`There is no kind "${kindName}". Set kind to one of: ${kinds(ctx).map((k) => k.kind).join(', ')}, or leave it empty to search every kind.`)
  const hits: Hit[] = []
  for (const k of list) {
    try {
      hits.push(...lined(k, searchKind(k, query, limit, ctx), ctx))
    } catch {
      continue
    }
  }
  return hits.slice(0, limit * 2)
}

function byName(k: Kind, ref: string, ctx: KindContext): string | null {
  const raw = stripRef(ref)
  const id = toId(raw)
  if (!id || k.resolveOnly) return null
  try {
    return k.search('', 100_000, ctx).find((h) => h.id === raw || toId(h.title) === id || toId(h.id) === id)?.id ?? null
  } catch {
    return null
  }
}

function resolveIn(k: Kind, ref: string, ctx: KindContext): string | null {
  try {
    return k.resolve(ref, ctx) ?? byName(k, ref, ctx)
  } catch {
    return byName(k, ref, ctx)
  }
}

export function resolveEntry(entry: string, kindName: string | null = null, ctx: KindContext = USER): { kind: Kind; id: string } {
  const link = splitLink(entry)
  if (link.kind && entry.trim().startsWith('@')) {
    const k = kindFor(link.kind, ctx)
    const id = k ? resolveIn(k, link.ref, ctx) : null
    if (k && id) return { kind: k, id }
  }
  const raw = entry.trim().replace(/^seven:/, '')
  const slash = raw.indexOf('/')
  if (!kindName && slash > 0) {
    const k = kindFor(raw.slice(0, slash), ctx)
    if (k) {
      const id = resolveIn(k, decodeURIComponent(raw.slice(slash + 1)), ctx)
      if (id) return { kind: k, id }
    }
  }
  const named = kindName ? kindFor(kindName, ctx) : undefined
  if (kindName && !named) throw new ToolError(`There is no kind ${kindName}. Kinds: ${kinds(ctx).map((k) => k.kind).join(', ')}.`)
  const list = named ? [named] : kinds(ctx)
  for (const k of list) {
    try {
      const id = k.resolve(raw, ctx)
      if (id) return { kind: k, id }
    } catch {
      continue
    }
  }
  for (const k of list) {
    const id = byName(k, raw, ctx)
    if (id) return { kind: k, id }
  }
  const asked = toId(link.kind && entry.trim().startsWith('@') ? link.ref : raw) || stripRef(raw)
  const what = named?.kind ?? (link.kind && kindFor(link.kind, ctx) ? link.kind : 'entry')
  if (named?.missing) throw new ToolError(named.missing(asked))
  let near: Hit[] = []
  try {
    near = find(asked.split(/[_/]+/).filter(Boolean).pop() ?? asked, named?.kind ?? null, 3, ctx).slice(0, 5)
  } catch {
    near = []
  }
  const tree = data.pages.tree()
  const nearId = (h: Hit) => (tree.list.some((p) => p.id === h.id && pageKindOf(p.type) === h.kind) ? tree.pathOf(h.id) : toId(h.title) || h.id)
  throw new ToolError(`No ${what} ${asked}.${near.length ? ` Close: ${near.map((h) => `${h.kind} ${nearId(h)}`).join(', ')}.` : ''} find searches everything.`)
}

export function libraryGuide(toolNames: string[], agentId: string | null = null): string {
  if (!toolNames.includes('read_kind')) return ''
  const mine = new Set(toolNames)
  const lines = [
    '## Library and links',
    `Everything Seven keeps is in the library, as entries of the kinds below. Each entry has an id; read_kind(kind, id) gives it.${mine.has('find') ? ' find searches the library.' : ''}${mine.has('show') ? ' show presents an entry.' : ''}`,
    'Link to an entry with @kind:id, e.g. @page:recipes/pancakes. find and read_kind give each entry\'s link: copy it. Links work the same in replies, pages, sheets and tool arguments; never write a markdown link or a [[wiki link]] for an entry.',
    'Pages sit in folders, and a page\'s id is its path, e.g. recipes/pancakes. read_kind(folder, recipes) lists what recipes holds; read_kind(folder, /) lists the top level.'
  ]
  if (mine.has('draw')) lines.push('Draw in replies and pages with a ```svg block (one <svg> element, no scripts or outside links); draw saves one as a file. A ```mermaid block draws a flowchart, sequence diagram or timeline. ![name](seven:file/<id>) puts a library picture in a page.')
  for (const k of kinds({ agentId, user: false })) lines.push(`- @${k.kind}: ${k.label}, ${k.description}${mine.has('show') && k.parts.length > 1 ? `. Parts: ${k.parts.map((p) => `#${p}`).join(', ')}` : ''}`)
  return lines.join('\n')
}

function pickPart(kind: Kind, id: string, asked: string | null): string {
  const want = (asked ?? '').trim().toLowerCase()
  return want && kind.parts.includes(want) ? want : kind.defaultPart ? kind.defaultPart(id) : kind.parts[0]
}

export function linkPart(thing: string): string | null {
  return thing.trim().startsWith('@') ? splitLink(thing).part : null
}

export function partMiss(entry: string, part: string | null, ctx: KindContext = USER): string | null {
  const want = (part ?? '').trim().toLowerCase()
  if (!want) return null
  const { kind, id } = resolveEntry(entry, null, ctx)
  if (kind.parts.includes(want)) return null
  return `${kind.title(id)} has no part "${want}", so it is shown the usual way${kind.parts.length > 1 ? ` (its parts: ${kind.parts.join(', ')})` : ''}.`
}

export function partView(entry: string, part: string | null, title: string | null = null, ctx: KindContext = USER): ViewRef {
  const { kind, id } = resolveEntry(entry, null, ctx)
  if (!kind.parts.length) throw new ToolError(`A ${kind.label.toLowerCase()} has no view to show. read it instead and put what matters in your reply.`)
  const chosen = pickPart(kind, id, part)
  const text = kind.textParts?.includes(chosen) ? kind.full(id, {}, ctx) : null
  return { kind: 'part', title: title ?? kind.title(id), data: { kind: kind.kind, id, part: chosen, text } }
}

export function entryView(kind: Kind, id: string, part: string | null, ctx: KindContext = USER): ViewRef {
  const data: EntryViewData = { kind: kind.kind, id, part: pickPart(kind, id, part) }
  return { kind: 'entry', title: entryId(kind, id, kind.title(id), ctx), data }
}

export function linkView(entry: string, ctx: KindContext = USER): ViewRef {
  const { kind, id } = resolveEntry(entry, null, ctx)
  return entryView(kind, id, null, ctx)
}

export function kindOf(entry: string, ctx: KindContext = USER): { kind: Kind; id: string } {
  return resolveEntry(entry, null, ctx)
}

const pageBackedLists = (): Kind[] => withNexus([pageKind, folderKind, sheetKind, slideshowKind, repoKind, ...addonKinds(), fileKind, workoutEntryKind, exerciseKind, ...moduleKinds()])

export function kindOfPageType(type: string | null | undefined): string {
  return pageBackedLists().find((k) => k.pageTypes?.includes(type ?? ''))?.kind ?? pageKindOf(type)
}

export function isPageBacked(kind: string): boolean {
  return pageBackedLists().some((k) => k.kind === kind && Boolean(k.pageTypes))
}
