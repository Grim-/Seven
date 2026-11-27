import { findRepo, getRepo, saveRepo } from '../../engine/library/repos'
import { SHEET_FIELDS, findSheet, getSheet, saveSheet } from '../../engine/library/sheets'
import { factions } from '../../engine/factions/store'
import { styles } from '../../engine/mind/styles'
import { linkFor } from '@shared/text'
import { stripRef, toId } from '@shared/ids'
import { LIMITS } from '../../engine/limits'
import type { JsonSchema } from '../../engine/tools/schema'
import type { CollectionRecord, FieldChange, FieldType, Page, ViewRef } from '@shared/types'
import { FIELD_TYPES, hitDetail, pageKindOf } from '@shared/types'
import { data } from '../../engine/data/hub'
import { canSee, entryId, findPage, generatedTitle, insideText, itemsView, kinds, entryView, linkView, partView, resolveEntry, rollEntry, hydrateForAgent, setTags, textView, type KindContext } from '../../engine/library/kinds'
import { tags as tagStore } from '../../engine/library/tags'
import { ToolError, optStr, str, type ToolContext, type ToolDef, type ToolScope } from '../../engine/tools/types'
import { savedText } from './output'
import { canReadPaths, readDisk } from '../read/tools'
import { registerHtml } from '../../engine/tools/shown'
import { writer } from '../../engine/present/places'
import { DONE } from '../../engine/present/define'
import { cleanSvg } from '@shared/svg'
import { SLIDESHOW_TOOLS } from './slideshowTools'
import { CHARACTER_TOOLS } from './characterTools'
import { hitId, resolveEntries, thingsFrom } from './things'
import { INSPECT_SCHEMA } from './schemaTool'
import { registerPlaceTarget } from '../../engine/data/placeTargets'

registerPlaceTarget({ target: 'draw', label: 'Drawings', home: 'Pictures/Drawings', asks: false })

const VALUE: JsonSchema = { oneOf: [{ type: ['string', 'number', 'boolean', 'null'] }, { type: 'array', items: { type: 'string' } }] }
const OBJECT: JsonSchema = { type: 'object', properties: {}, additionalProperties: VALUE }


function fieldsText(p: Pick<Page, 'fields'>): string {
  return p.fields.map((f) => `${f.name} (${f.type === 'select' ? `one of ${f.options.join('/')}` : f.type}${f.required ? ', required' : ''})`).join(', ')
}

function recordLine(r: CollectionRecord): string {
  return `${r.id} ${JSON.stringify(r.values)}`
}

function pageGate(ref: string, kctx: KindContext): void {
  if (!canSee('page', kctx)) throw new ToolError("You don't have access to pages. If you need it, ask the user to allow it for you in Agents.")
  if (!data.pages.find(ref, (p) => !p.type) && generatedTitle(ref, kctx)) throw new ToolError(`page ${toId(ref)} is built each time it is read and can't be changed. Use another id.`)
}

function list<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

const find: ToolDef = {
  name: 'find',
  command: true,
  group: 'core',
  needsWorkspace: false,
  lookup: true,
  description: 'Search the library. Supports OR / |, -exclude, "exact phrase", #tag, kind lists, field filters (where), and offset pagination. No query lists the newest of each kind.',
  params: {
    type: 'object',
    properties: {
      query: { type: ['string', 'null'], description: 'Words to look for; supports OR / | (e.g. "demon OR fiend OR devil"), -exclude, "exact phrase", and #tag' },
      kind: { oneOf: [{ type: 'null' }, { type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Only this kind or list of kinds, e.g. "sheet" or ["sheet", "place"]' },
      tags: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Only entries with all these tags' },
      where: { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: 'string' } }], description: 'Field filters (case-insensitive), e.g. {"Gender": "female", "Race": "tiefling OR demon"}' },
      limit: { type: ['integer', 'null'], description: 'Max results per page (1-100; default 25 when filtering)' },
      offset: { type: ['integer', 'null'], description: 'Skip this many matches to read the next page' }
    }
  },
  forAgent: (scope) => {
    const names = kinds({ agentId: scope.agentId }).map((k) => k.kind)
    return {
      params: {
        type: 'object',
        properties: {
          query: { type: ['string', 'null'], description: 'Words to look for; supports OR / |, -exclude, "exact phrase", and #tag' },
          kind: {
            oneOf: [{ type: 'null' }, { enum: names }, { type: 'array', items: { enum: names } }],
            description: `Only this kind or list of kinds: ${names.join(', ')}`
          },
          tags: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Only entries with all these tags' },
          where: { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: 'string' } }], description: 'Field filters (case-insensitive), e.g. {"Gender": "female", "Race": "tiefling OR demon"}' },
          limit: { type: ['integer', 'null'], description: 'Max results per page (1-100; default 25 when filtering)' },
          offset: { type: ['integer', 'null'], description: 'Skip this many matches to read the next page' }
        }
      }
    }
  },
  async execute(params, ctx) {
    const wanted = Array.isArray(params.tags) ? params.tags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean) : []
    const words = optStr(params, 'query')?.trim() ?? null
    const kind = Array.isArray(params.kind) ? params.kind.map(String).filter(Boolean) : optStr(params, 'kind')
    const rawWhere = params.where && typeof params.where === 'object' && !Array.isArray(params.where) ? (params.where as Record<string, unknown>) : null
    const where = rawWhere
      ? Object.fromEntries(Object.entries(rawWhere).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, String(v)]))
      : null
    const limit = typeof params.limit === 'number' && Number.isFinite(params.limit) ? params.limit : null
    const offset = typeof params.offset === 'number' && Number.isFinite(params.offset) ? params.offset : null
    const kctx = { agentId: ctx.agentId }
    const { hits, total, offset: at, limit: _lim } = findPage({ query: words, kind, tags: wanted, where, limit, offset }, kctx)
    const listed = (found: typeof hits) => found.map((h) => `${h.kind} ${hitId(h, kctx)}${hitDetail(h) ? ` — ${hitDetail(h)}` : ''}${h.tags?.length ? ` #${h.tags.join(' #')}` : ''}`).join('\n')
    if (!hits.length) {
      if (at > 0 && total > 0) return { text: `No more matches at offset ${at} (total ${total}).`, empty: true }
      if (wanted.length) {
        const loose = findPage({ query: words, kind, where, limit: 15 }, kctx).hits
        if (loose.length) return `Nothing has all of the tags ${wanted.map((t) => `#${t}`).join(' ')}. Without tags, ${words ? `"${words}"` : 'the library'} matches:\n${listed(loose)}\nUse one of these, or call find again with tags null.`
      }
      if (where && Object.keys(where).length) {
        const loose = findPage({ query: words, kind, tags: wanted, limit: 15 }, kctx).hits
        if (loose.length) return `Nothing matches all field filters (${Object.entries(where).map(([k, v]) => `${k}=${v}`).join(', ')}). Without where, it matches:\n${listed(loose)}\nUse one of these, or adjust where.`
      }
      if (kind && (words || (where && Object.keys(where).length))) {
        const anyKind = findPage({ query: words, tags: wanted, where, limit: 15 }, kctx).hits
        if (anyKind.length) return `Nothing of that kind matches "${words ?? ''}". In other kinds it matches:\n${listed(anyKind)}\nUse one of these, or call find again with kind null.`
      }
      if (!words && !wanted.length && !where) return { text: kind ? `There are no entries of that kind yet. Call find with kind null to search everything.` : 'The library is empty. add_page makes a page.', empty: true }
      return { text: `Nothing matches "${words ?? ''}". Try OR alternatives (e.g. "demon OR fiend"), broaden where, or call find with query null to list the newest entries.`, empty: true }
    }
    const pageNote = total > at + hits.length || at > 0 ? `\nShowing ${at + 1}–${at + hits.length} of ${total}.${total > at + hits.length ? ` Call find with offset ${at + hits.length} for the rest.` : ''}` : ''
    return `${listed(hits)}${pageNote}`
  }
}

interface ReadResult {
  kind: string
  id: string
  text: string
  view?: ViewRef
  link: boolean
  images?: string[]
  hydrated?: boolean
}

function liveText(text: string, kctx: KindContext, asWritten: boolean): { text: string; hydrated?: boolean } {
  if (asWritten) return { text }
  const out = hydrateForAgent(text, kctx, false)
  return { text: out, hydrated: out !== text }
}

async function readThing(kindName: string, raw: string, ctx: ToolContext, kctx: KindContext, asWritten = false): Promise<ReadResult> {
  if (kindName === 'disk') {
    if (!canReadPaths(ctx)) throw new ToolError("You can't read files on disk. If you need to, ask the user to give you a workspace or a linked folder, and the Read files tools.")
    const got = await readDisk(ctx, raw)
    return { kind: 'disk', id: got.id, text: got.text, view: got.view, link: false, images: got.images }
  }
  if (kindName === 'result') {
    const id = stripRef(raw)
    return { kind: 'result', id, text: savedText(id, ctx), link: false }
  }
  const rooted = kindName ? kinds(kctx).find((k) => k.kind === kindName) : undefined
  if (rooted?.root !== undefined && !toId(raw)) return { kind: rooted.kind, id: rooted.root, ...liveText(rooted.full(rooted.root, {}, kctx), kctx, asWritten), link: false }
  const { kind, id, trail, path } = resolveEntry(raw, kindName, kctx)
  const name = entryId(kind, id, kind.title(id), kctx)
  const asset = kind.asset?.(id) ?? null
  const images = asset?.kind === 'image' ? [asset.id] : undefined
  const inside = insideText(kind, id, path ?? linkFor(kind.kind, id), trail ?? [], kctx)
  const full = kind.readFull ? await kind.readFull(id) : null
  if (full !== null) return { kind: kind.kind, id: name, text: full + inside, link: true, images }
  if (kind.readView) {
    const out = kind.readView(id, {}, kctx)
    const live = liveText(out.text, kctx, asWritten)
    return { kind: kind.kind, id: name, text: live.text + inside, hydrated: live.hydrated, view: out.view, link: true, images }
  }
  const live = liveText(kind.full(id, {}, kctx), kctx, asWritten)
  return { kind: kind.kind, id: name, text: live.text + inside, hydrated: live.hydrated, link: true, images }
}

function fitRead(got: ReadResult, truncate: boolean, ctx: ToolContext): string {
  const head = `${got.kind} ${got.id}${got.link ? ` · link ${linkFor(got.kind, got.id)}` : ''}${got.hydrated ? ' · links are filled in, each followed by its own link; as_written true gives the text as stored, to change it' : ''}`
  const body = got.text
  const count = ctx.budget?.count ?? ((t: string) => Math.ceil(t.length / 3.5))
  if (truncate) {
    let max = LIMITS.readChars
    if (ctx.budget) {
      const tokens = count(body)
      if (tokens > ctx.budget.maxTokens) max = Math.min(max, Math.floor((body.length * ctx.budget.maxTokens) / tokens))
    }
    if (body.length <= max) return `${head}\n\n${body}`
    const line = body.lastIndexOf('\n', max)
    const cut = line > max * 0.8 ? line : max
    return `${head}\n\n${body.slice(0, cut)}\n… cut at ${cut} of ${body.length} characters. read_kind(${got.kind}, ${got.id}, false) gives all of it.`
  }
  const tokens = count(body)
  const room = ctx.budget?.room?.() ?? null
  if (room !== null && tokens > room) throw new ToolError(`${got.kind} ${got.id} is ${body.length} characters (about ${tokens} tokens) and only about ${room} tokens of context are free. read_kind(${got.kind}, ${got.id}, true) gives the start of it.`)
  return `${head}\n\n${body}`
}

function readKinds(scope: ToolScope): string[] {
  const names = kinds({ agentId: scope.agentId }).map((k) => k.kind)
  return [...new Set([...names, ...(scope.files ? ['disk'] : []), 'result'])]
}

const READ_PARAMS = {
  kind: { type: 'string', description: 'The kind of entry; folder lists a folder (id / for the top); disk is a file in your workspace or a linked folder; result is a cut-short tool result' },
  id: { type: 'string', description: 'Its id, e.g. recipes/pancakes, workspace/src/index.ts or t_abc123' },
  truncate: { type: 'boolean', description: 'true cuts long content short; false gives all of it' },
  as_written: { type: 'boolean', description: 'true gives the text as stored, links unfilled' }
} as const

const read: ToolDef = {
  name: 'read_kind',
  command: true,
  group: 'core',
  always: true,
  needsWorkspace: false,
  fitsItself: true,
  lookup: true,
  description: 'Read one thing by its kind and id.',
  params: { type: 'object', properties: READ_PARAMS },
  forAgent: (scope) => ({ params: { type: 'object', properties: { ...READ_PARAMS, kind: { enum: readKinds(scope) } } } }),
  async execute(params, ctx) {
    const kctx = { agentId: ctx.agentId }
    const kindName = str(params, 'kind').trim().toLowerCase()
    const raw = typeof params.id === 'string' ? params.id : ''
    const got = await readThing(kindName, raw, ctx, kctx, params.as_written === true)
    return { text: fitRead(got, params.truncate !== false, ctx), view: got.view, images: got.images }
  }
}

function pagePath(p: Page): string {
  return data.pages.pathOf(p.id)
}

function saved(p: Page, verb: string): { text: string; view: ViewRef } {
  const at = pagePath(p)
  return { text: `${verb} page ${at} · link ${linkFor('page', at)} (${p.body.length} characters).`, view: textView(p) }
}

function existingPage(raw: string, kctx: KindContext, next: string): Page {
  pageGate(raw, kctx)
  const found = data.pages.find(raw, (p) => !p.type)
  if (!found) throw new ToolError(`${data.pages.missing(raw, 'page')} ${next}`)
  return data.pages.get(found.id)
}

function pageAt(raw: string, ctx: ToolContext): Page {
  const id = toId(raw)
  if (!id) throw new ToolError('Give id, e.g. recipes/pancakes.')
  pageGate(id, { agentId: ctx.agentId })
  const found = data.pages.find(id, (p) => !p.type)
  if (found) return data.pages.get(found.id)
  const at = data.pages.findPath(id)
  if (at) throw new ToolError(`${pageKindOf(at.type)} ${id} already exists. Pick another id.`)
  return data.pages.create({ title: id }, writer(ctx))
}

const addPage: ToolDef = {
  name: 'add_page',
  group: 'core',
  needsWorkspace: false,
  description: 'Add a page. Folders in its path are made.',
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Its path: folders, then the page, e.g. recipes/pancakes' },
      text: { type: 'string', description: 'Markdown' }
    }
  },
  async execute(params, ctx) {
    const id = toId(str(params, 'id'))
    if (!id) throw new ToolError('Give id, e.g. recipes/pancakes.')
    pageGate(id, { agentId: ctx.agentId })
    const at = data.pages.findPath(id)
    if (at) throw new ToolError(at.type ? `${pageKindOf(at.type)} ${id} already exists. Pick another id.` : `page ${id} already exists. update_page(${id}, text) changes its text.`)
    const p = data.pages.create({ title: id, body: typeof params.text === 'string' ? params.text : '' }, writer(ctx))
    return saved(p, 'Added')
  }
}

const updatePage: ToolDef = {
  name: 'update_page',
  group: 'core',
  needsWorkspace: false,
  description: "Replace a page's text.",
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The page path, e.g. recipes/pancakes' },
      text: { type: 'string', description: 'Markdown; replaces all of its text' }
    }
  },
  async execute(params, ctx) {
    const raw = str(params, 'id')
    const page = existingPage(raw, { agentId: ctx.agentId }, `add_page(${toId(raw)}, text) adds it.`)
    const p = data.pages.write({ ref: page.id, body: typeof params.text === 'string' ? params.text : '' }, writer(ctx))
    return saved(p, 'Updated')
  }
}

const renamePage: ToolDef = {
  name: 'rename_page',
  group: 'core',
  needsWorkspace: false,
  description: 'Rename or move a page.',
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The page path now' },
      new_id: { type: 'string', description: 'Its new path, e.g. recipes/breakfast/pancakes' }
    }
  },
  async execute(params, ctx) {
    const page = existingPage(str(params, 'id'), { agentId: ctx.agentId }, 'read_kind(folder, /) lists the top level.')
    const before = pagePath(page)
    const target = toId(str(params, 'new_id'))
    if (!target) throw new ToolError('Give new_id, e.g. recipes/pancakes.')
    pageGate(target, { agentId: ctx.agentId })
    const p = data.pages.relocate(page.id, target, writer(ctx))
    const at = pagePath(p)
    return { text: `Renamed page ${before} to page ${at} · link ${linkFor('page', at)}.`, view: textView(p) }
  }
}

const removePage: ToolDef = {
  name: 'remove_page',
  group: 'core',
  needsWorkspace: false,
  description: 'Remove a page.',
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The page path' }
    }
  },
  async execute(params, ctx) {
    const page = existingPage(str(params, 'id'), { agentId: ctx.agentId }, 'read_kind(folder, /) lists the top level.')
    const at = pagePath(page)
    data.pages.delete(page.id, writer(ctx))
    tagStore.set('page', page.id, [])
    return `Removed page ${at}.`
  }
}

const pageItems: ToolDef = {
  name: 'page_items',
  group: 'core',
  needsWorkspace: false,
  description: 'Add, change or remove items (rows) on a page. A page with no fields gets title and done. read the page for item ids and fields.',
  params: {
    type: 'object',
    properties: {
      page: { type: 'string', description: 'The page path' },
      add: { oneOf: [{ type: 'null' }, { type: 'array', maxItems: 50, items: OBJECT }], description: 'e.g. [{"title": "Buy milk"}]' },
      update: { oneOf: [{ type: 'null' }, { type: 'array', maxItems: 50, items: { type: 'object', properties: { id: { type: 'string', description: 'An item id, e.g. r3' }, values: OBJECT } } }], description: 'e.g. [{"id": "r3", "values": {"done": true}}]' },
      remove: { oneOf: [{ type: 'null' }, { type: 'array', maxItems: 100, items: { type: 'string' } }], description: 'Item ids to remove' }
    }
  },
  async execute(params, ctx) {
    const add = list(params.add)
    const update = list<Record<string, unknown>>(params.update).map((u) => ({ id: String(u.id ?? ''), values: u.values }))
    const remove = list(params.remove).map(String)
    if (!add.length && !update.length && !remove.length) throw new ToolError('Give at least one of add, update or remove, e.g. add [{"title": "Buy milk"}]. read the page to see its item ids and fields.')
    const ref = pageAt(str(params, 'page'), ctx).id
    const out: string[] = []
    const touched: string[] = []
    if (remove.length) out.push(`Removed ${data.pages.deleteRecords(ref, remove, writer(ctx)).join(', ')}`)
    if (update.length) {
      const updated = data.pages.updateRecords(ref, update, writer(ctx))
      touched.push(...updated.map((r) => r.id))
      out.push(`Updated:\n${updated.map(recordLine).join('\n')}`)
    }
    if (add.length) {
      const added = data.pages.addRecords(ref, add, writer(ctx))
      touched.push(...added.map((r) => r.id))
      out.push(`Added:\n${added.map(recordLine).join('\n')}`)
    }
    const p = data.pages.get(ref)
    return { text: `page ${pagePath(p)}: ${out.join('\n')}`, view: touched.length ? itemsView(p, touched) : undefined }
  }
}

const pageFields: ToolDef = {
  name: 'page_fields',
  group: 'core',
  needsWorkspace: false,
  description: 'Set the fields of a page\'s items.',
  params: {
    type: 'object',
    properties: {
      page: { type: 'string', description: 'The page path' },
      fields: {
        type: 'array',
        maxItems: 20,
        description: 'e.g. [{"name": "due", "type": "date"}]',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The field' },
            type: { oneOf: [{ type: 'null' }, { enum: FIELD_TYPES }], description: 'date is YYYY-MM-DD; select needs options; asset holds a file id' },
            options: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'The choices of a select' },
            required: { type: ['boolean', 'null'], description: 'true makes every item need it' },
            rename: { type: ['string', 'null'], description: 'A new name for it' },
            remove: { type: ['boolean', 'null'], description: 'true removes the field' }
          }
        }
      }
    }
  },
  async execute(params, ctx) {
    const fields = list<Record<string, unknown>>(params.fields)
    const typeOf = (f: Record<string, unknown>) => (typeof f.type === 'string' ? (f.type as FieldType) : null)
    const optionsOf = (f: Record<string, unknown>) => (Array.isArray(f.options) ? f.options.map(String) : null)
    const requiredOf = (f: Record<string, unknown>) => (typeof f.required === 'boolean' ? f.required : null)
    const existing = pageAt(str(params, 'page'), ctx)
    const changes: FieldChange[] = []
    for (const f of fields) {
      const fieldName = String(f.name ?? '')
      const current = existing.fields.find((x) => x.name.toLowerCase() === fieldName.toLowerCase())
      const base = { newName: null, type: null, options: null, required: null } as const
      if (f.remove === true) {
        changes.push({ ...base, action: 'remove', field: fieldName })
        continue
      }
      if (!current) {
        changes.push({ action: 'add', field: typeof f.rename === 'string' && f.rename ? f.rename : fieldName, newName: null, type: typeOf(f) ?? 'text', options: optionsOf(f), required: requiredOf(f) })
        continue
      }
      let target = current.name
      if (typeof f.rename === 'string' && f.rename.trim() && f.rename !== current.name) {
        changes.push({ ...base, action: 'rename', field: current.name, newName: f.rename })
        target = f.rename
      }
      if (typeOf(f) || optionsOf(f) || requiredOf(f) !== null) changes.push({ action: 'update', field: target, newName: null, type: typeOf(f), options: optionsOf(f), required: requiredOf(f) })
    }
    const updated = data.pages.editFields(existing.id, changes, writer(ctx))
    return { text: `page ${pagePath(updated)} fields: ${fieldsText(updated) || 'none'}`, view: itemsView(updated, null) }
  }
}

const show: ToolDef = {
  name: 'show',
  command: true,
  group: 'core',
  always: true,
  maxRepeats: 1,
  needsWorkspace: false,
  description: 'Show things to the user: pages, cards, repos, files, slideshows, anything you can link.',
  params: {
    type: 'object',
    properties: {
      things: { type: 'array', items: { type: 'string' }, description: 'Links like @page:recipes/pancakes or @sheet:valerius#stats, or file paths' }
    }
  },
  async execute(params, ctx) {
    const things = thingsFrom(params.things, ctx)
    if (!things.length) throw new ToolError('Give things: links like @page:recipes/pancakes, or file paths.')
    const kctx = { agentId: ctx.agentId }
    const { found, notes } = resolveEntries(things, kctx)
    const noted = notes.length ? `\n${notes.join('\n')}` : ''
    const views = found.map((f) => (f.kind.presents?.chat ? entryView(f.kind, f.id, f.part, kctx) : partView(`${f.kind.kind}/${f.id}`, f.part, null, kctx)))
    const presentView: ViewRef = { kind: 'present', title: views.map((v) => v.title).filter(Boolean).join(', '), data: { type: 'view', fields: { views }, where: 'inline', key: null } }
    return { text: `Shown to the user.${noted} ${DONE}`, view: presentView }
  }
}

const addHtml: ToolDef = {
  name: 'add_html',
  group: 'core',
  maxRepeats: 2,
  needsWorkspace: false,
  activity: () => 'making a page',
  description: 'Save an HTML page you wrote as a file and show it.',
  params: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The file name, e.g. weather_card' },
      html: { type: 'string', description: 'A full HTML page; outside scripts only from cdnjs, jsdelivr, unpkg, Google Fonts' },
      uses_network: { type: 'boolean', description: 'true if the page fetches live data' }
    }
  },
  async execute(params, ctx) {
    const html = str(params, 'html')
    if (!html.trim()) throw new ToolError('Give html: the full page.')
    const id = registerHtml(str(params, 'name').trim() || 'page', html, params.uses_network === true, ctx)
    const meta = data.assets.get(id)
    return { text: `Saved ${linkFor('file', meta.name)} and showed it. add_to_board can put it on a board.`, view: linkView(`file/${id}`, { agentId: ctx.agentId }) }
  }
}

const draw: ToolDef = {
  name: 'draw',
  group: 'core',
  needsWorkspace: false,
  maxRepeats: 3,
  activity: () => 'drawing',
  description: 'Save an SVG drawing as a file and show it.',
  params: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The file name, e.g. city_map' },
      svg: { type: 'string', description: 'One <svg> element, no scripts' }
    }
  },
  async execute(params, ctx) {
    if (!canSee('file', { agentId: ctx.agentId })) throw new ToolError("You don't have access to files, so draw can't save one. Write the drawing in a ```svg block in your reply instead, or ask the user to allow files for you in Agents.")
    let clean: string
    try {
      clean = cleanSvg(str(params, 'svg'))
    } catch (err) {
      throw new ToolError(err instanceof Error ? err.message : String(err))
    }
    const base = str(params, 'name').trim().replace(/\.svg$/i, '') || 'drawing'
    const asset = data.assets.registerBytes(`${base}.svg`, Buffer.from(clean, 'utf8'), { tool: 'draw', sessionId: ctx.sessionId, original: null }, writer(ctx))
    return {
      text: `Saved ${linkFor('file', asset.name)}. show puts it on a board, the stage or the panel; ![${base}](seven:file/${asset.id}) puts it in a page.`,
      view: linkView(`file/${asset.id}`, { agentId: ctx.agentId })
    }
  }
}

function tagCounts(kind?: string) {
  return tagStore.counts(kind)
}

const tag: ToolDef = {
  name: 'tag',
  command: true,
  group: 'core',
  needsWorkspace: false,
  description: 'Add or remove tags on an entry.',
  params: {
    type: 'object',
    properties: {
      entry: { type: 'string', description: 'A link, e.g. @page:recipes/pancakes' },
      add: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Tags to add' },
      remove: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Tags to take off' }
    }
  },
  async execute(params, ctx) {
    const add = Array.isArray(params.add) ? params.add.map(String) : []
    const remove = Array.isArray(params.remove) ? params.remove.map(String) : []
    if (!add.length && !remove.length) throw new ToolError(`Give tags to add or remove. Tags in use: ${tagCounts().slice(0, 30).map((t) => t.tag).join(', ') || 'none yet'}`)
    const { kind, id, tags } = setTags(str(params, 'entry'), add, remove, { agentId: ctx.agentId })
    return `${kind.kind} ${entryId(kind, id, kind.title(id), { agentId: ctx.agentId })} is tagged ${tags.length ? tags.map((t) => `#${t}`).join(' ') : '(nothing)'}.`
  }
}

const pickRandom: ToolDef = {
  name: 'pick_random',
  group: 'core',
  needsWorkspace: false,
  activity: () => 'rolling',
  description: 'Pick at random from a repo or deck.',
  params: {
    type: 'object',
    properties: {
      entry: { type: 'string', description: 'A link, e.g. @repo:races_fantasy' },
      count: { type: ['integer', 'null'], description: 'How many, 1 to 10; null for 1' }
    }
  },
  async execute(params, ctx) {
    const entry = str(params, 'entry').trim()
    const count = Math.max(1, Math.min(10, typeof params.count === 'number' ? Math.round(params.count) : 1))
    const values = Array.from({ length: count }, () => rollEntry(entry, { agentId: ctx.agentId }))
    return count === 1 ? values[0] : values.map((v) => `- ${v}`).join('\n')
  }
}

const sheetWrite: ToolDef = {
  name: 'sheet_write',
  group: 'core',
  needsWorkspace: false,
  activity: () => 'writing a character',
  description: 'Create or update a character sheet: bio fields, faction allegiance, and mind/voice settings.',
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character, e.g. Mira' },
      values: { oneOf: [{ type: 'null' }, OBJECT], description: `Each field name to its markdown, e.g. {"Appearance": "Tall, silver hair"}. Usual fields: ${SHEET_FIELDS.join(', ')}` },
      remove: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Field names to remove' },
      faction: { type: ['string', 'null'], description: 'Faction id or name to align this character with, or empty string to clear' },
      mind: {
        oneOf: [
          { type: 'null' },
          {
            type: 'object',
            properties: {
              reasoningStyle: { type: ['string', 'null'], description: 'Reasoning style id or name (or empty string to clear)' },
              howItThinks: { type: ['string', 'null'], description: 'Notes on how this character thinks' },
              voiceConstraints: { type: ['string', 'null'], description: 'Voice constraints and rules' },
              forceReason: { type: ['boolean', 'null'], description: 'Always force reasoning before speaking' }
            }
          }
        ],
        description: 'Optional character mind/reasoning settings patch'
      }
    }
  },
  async execute(params) {
    const name = str(params, 'sheet').trim()
    if (!name) throw new ToolError('Give sheet, the character sheet\'s name, e.g. "Mira".')
    const id = findSheet(name)
    const current = id ? getSheet(id) : { id: null, title: name, fields: [...SHEET_FIELDS], values: {} as Record<string, string>, faction: null, mind: null }
    const values = { ...current.values }
    const fields = [...current.fields]
    const given = params.values && typeof params.values === 'object' ? (params.values as Record<string, unknown>) : {}
    for (const [field, text] of Object.entries(given)) {
      const key = field.trim()
      if (!key) continue
      values[key] = typeof text === 'string' ? text : JSON.stringify(text)
      if (!fields.includes(key)) fields.push(key)
    }
    const drop = new Set(Array.isArray(params.remove) ? params.remove.map((f) => String(f).trim()) : [])
    let factionPatch: string | null | undefined = undefined
    if (typeof params.faction === 'string') {
      const rawFaction = params.faction.trim()
      if (!rawFaction) factionPatch = null
      else {
        const found = factions.find(rawFaction, null)
        if (!found) throw new ToolError(`No faction "${rawFaction}". Available: ${factions.list(null).map((f) => f.id).join(', ') || 'none'}.`)
        factionPatch = found.id
      }
    }
    let mindPatch = current.mind ?? null
    if (params.mind && typeof params.mind === 'object' && !Array.isArray(params.mind)) {
      const m = params.mind as Record<string, unknown>
      const curMind = current.mind ?? {}
      let nextStyle = curMind.reasoningStyle
      if (typeof m.reasoningStyle === 'string') {
        const ref = m.reasoningStyle.trim()
        if (!ref) nextStyle = undefined
        else {
          const st = styles.find(ref)
          if (!st) throw new ToolError(`No reasoning style "${ref}".`)
          nextStyle = st.id
        }
      }
      mindPatch = {
        ...curMind,
        ...(nextStyle !== undefined ? { reasoningStyle: nextStyle } : {}),
        ...(typeof m.howItThinks === 'string' ? { howItThinks: m.howItThinks.trim() } : {}),
        ...(typeof m.voiceConstraints === 'string' ? { voiceConstraints: m.voiceConstraints.trim() } : {}),
        ...(typeof m.forceReason === 'boolean' ? { forceReason: m.forceReason } : {})
      }
      if (typeof m.reasoningStyle === 'string' && !m.reasoningStyle.trim()) delete mindPatch.reasoningStyle
    }
    const saved = saveSheet({
      id: current.id,
      title: current.title,
      fields: fields.filter((f) => !drop.has(f)),
      values,
      ...(factionPatch !== undefined ? { faction: factionPatch } : {}),
      ...(params.mind !== undefined ? { mind: mindPatch } : {})
    })
    return `${id ? 'Updated' : 'Created'} the sheet ${linkFor('sheet', saved.id)}. Fields: ${saved.fields.join(', ')}.`
  }
}

const repoWrite: ToolDef = {
  name: 'repo_write',
  group: 'core',
  needsWorkspace: false,
  activity: () => 'writing a repo',
  description: 'Write a repo: a list of values to pick from at random; a new name makes a new repo.',
  params: {
    type: 'object',
    properties: {
      repo: { type: 'string', description: 'Its name, e.g. races_fantasy' },
      add: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Values to add. {other_repo} or {tag:x} inside a value picks from there' },
      values: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Replaces all values' },
      remove: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Values to take out' },
      tags: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Replaces its tags' }
    }
  },
  async execute(params) {
    const name = str(params, 'repo').trim()
    if (!name) throw new ToolError('Give repo, the repo\'s name, e.g. "races_fantasy".')
    const id = findRepo(name)
    const current = id ? getRepo(id) : { id: null, title: name, tags: [] as string[], scope: 'use' as const, values: [] as string[] }
    const list = (k: string) => (Array.isArray(params[k]) ? (params[k] as unknown[]).map((v) => String(v)).filter((v) => v.trim()) : null)
    let values = list('values') ?? current.values
    values = [...values, ...(list('add') ?? [])]
    const drop = new Set((list('remove') ?? []).map((v) => v.trim().toLowerCase()))
    values = values.filter((v) => !drop.has(v.trim().toLowerCase()))
    const saved = saveRepo({ id: current.id, title: current.title, tags: list('tags') ?? current.tags, scope: current.scope, values })
    return `${id ? 'Updated' : 'Created'} ${linkFor('repo', saved.id)}: ${saved.values.length} values.`
  }
}

export const DATA_TOOLS: ToolDef[] = [find, read, INSPECT_SCHEMA, addPage, updatePage, renamePage, removePage, pageItems, pageFields, show, addHtml, draw, tag, pickRandom, sheetWrite, ...CHARACTER_TOOLS, repoWrite, ...SLIDESHOW_TOOLS]

