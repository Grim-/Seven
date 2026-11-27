import { FOLDER_TYPE, ROOT_FOLDER, toId } from '@shared/ids'
import { SLIDESHOW_TYPE } from '@shared/slideshow'
import { pageKindOf, type AssetMeta, type CharacterSheet, type Dashboard, type WidgetSource } from '@shared/types'
import { attachedText, isTextAsset } from '../../../modules/core/files'
import { data } from '../../data/hub'
import type { PageTree } from '../../data/pages'
import { modules } from '../../modules/registry'
import { PAGE_HAND_TO } from '../../exporting/pages'
import { SHEET_HAND_TO } from '../../exporting/sheets'
import { cardRefsFor, sheetRefs } from '../../portability/kindPackers'
import { ToolError } from '../../tools/types'
import { noteFailure } from '../../util/report'
import { cleanExercise, cleanWorkout, EXERCISE, WORKOUT, workout } from '../../workout/store'
import { widgetLine } from '../../present/places'
import { pageExport } from '../exporters'
import { FILE_WIDGET } from '../fileWidget'
import { filePacking, folderPacking, freeName, pagePacking, type EntryRef } from '../packing'
import { PAGE_WIDGET } from '../pageWidget'
import { flattenText, scoreDoc, type SearchField } from '../query'
import { findRepo, getRepo, repoIds, repoMarkdown, REPO_TYPES, rollRepo, drawRepo } from '../repos'
import { findSheet, getSheet, setSheetRelationships, SHEET_TYPE, sheetIds, sheetLine, sheetMarkdown } from '../sheets'
import { takeOut } from '../../worlds/party'
import { worlds } from '../../worlds/store'
import { findSlideshow, getSlideshow, slideshowIds, slideshowText } from '../slideshows'
import { GENERATED, generatedPages, generatedTitle, guardGenerated, isWikiIndex, pageLine, readGenerated, specialPage, specialPages, WIKI_INDEX } from './generated'
import { filesIn, folderListing, readPage, readPageView, withTags, workoutPageKind } from './pageHelpers'
import { registerKind, registerKindSource, type OwnedKind } from '../kindRegistry'
import { registerModuleKind } from '../moduleKinds'
import { ENTRY_WIDGET, kindRt } from './runtime'
import { has, rollLinkActions, withJson, type Kind, type KindField } from './types'

export const pageKind: Kind = {
  group: 'Yours',
  kind: 'page',
  ...pagePacking(),
  pageTypes: [''],
  home: null,
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
  readView: (id, options, ctx) => (id.startsWith(GENERATED) ? { text: readGenerated(id, ctx) } : { text: readPage(id, options, ctx).text, view: kindRt().entryView(pageKind, id, null, ctx) }),
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
        .search(query, limit, (p) => !p.type)
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
    return specialPage(ref, ctx)?.id ?? generatedPages(ctx).find((g) => g.id === ref || toId(g.title) === toId(ref))?.id ?? null
  },
  line: pageLine,
  handTo: PAGE_HAND_TO,
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  full: (id, options, ctx) => (id.startsWith(GENERATED) ? readGenerated(id, ctx) : readPage(id, options, ctx).text)
}

const folderLine = (id: string | null, tree: PageTree) => `${tree.under(id).length + filesIn(id, tree).length} inside`

export const folderKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'folder',
  ...folderPacking,
  pageTypes: [FOLDER_TYPE],
  home: null,
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

export const fileKind: Kind = {
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
    const trimmed = query.trim()
    const assets = data.assets.list().sort((a, b) => b.createdAt - a.createdAt)
    if (!trimmed) return assets.slice(0, limit).map((a) => ({ kind: 'file', id: a.id, title: a.name, at: a.createdAt }))
    return assets
      .flatMap((a) => {
        const folderPath = a.parent ? data.pages.pathOf(a.parent) : ''
        const m = scoreDoc(trimmed, {
          title: a.name,
          labels: ['file', 'files', a.kind],
          fields: [
            ...(folderPath ? [{ name: 'Folder', value: folderPath }] : []),
            { name: 'Id', value: a.id },
            { name: 'Kind', value: a.kind },
            ...(a.description ? [{ name: 'Description', value: a.description }] : [])
          ],
          body: (a.areas ?? []).map((x) => `${x.name} ${x.note ?? ''}`).join(' ')
        })
        return m ? [{ kind: 'file', id: a.id, title: a.name, at: a.createdAt, ...(m.snippet ? { excerpt: m.snippet } : {}), _score: m.score }] : []
      })
      .sort((a, b) => b._score - a._score || (b.at ?? 0) - (a.at ?? 0))
      .slice(0, limit)
      .map(({ _score: _s, ...h }) => h)
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

export const boardKind: Kind = {
  presents: { chat: true },
  group: 'Yours',
  kind: 'board',
  pack(id) {
    const b = data.dashboards.get(id)
    return { name: b.name, icon: b.icon, onToolbar: b.onToolbar, widgets: b.widgets }
  },
  uses(id) {
    const b = data.dashboards.get(id)
    const out: EntryRef[] = []
    const seen = new Set<string>()
    for (const w of b.widgets) {
      const s = w.source as { kind?: unknown; entry?: unknown; id?: unknown }
      if (s.kind === 'entry' && typeof s.entry === 'string' && typeof s.id === 'string') {
        const key = `${s.entry}/${s.id}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push({ kind: s.entry, id: s.id })
        }
      }
    }
    return out
  },
  unpack(value, how) {
    const raw = (value && typeof value === 'object' ? value : {}) as { name?: string; icon?: string; onToolbar?: boolean; widgets?: Dashboard['widgets'] }
    const baseName = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Imported Board'
    const taken = new Set(data.dashboards.list().map((d) => d.name.toLowerCase()))
    const target = how.replace && data.dashboards.byId(how.replace)
      ? data.dashboards.update(how.replace, { name: baseName, icon: raw.icon ?? null, onToolbar: raw.onToolbar ?? null })
      : data.dashboards.create({ name: freeName(baseName, (n) => taken.has(n.toLowerCase())), icon: raw.icon ?? null, onToolbar: raw.onToolbar ?? null })
    if (how.replace && target.widgets.length) {
      for (const existingWidget of [...target.widgets]) data.dashboards.removeWidget(target.id, existingWidget.id)
    }
    for (const w of raw.widgets ?? []) {
      const src = { ...w.source } as Record<string, unknown>
      if (src.kind === 'entry' && typeof src.entry === 'string' && typeof src.id === 'string') {
        src.id = how.entry(src.id, src.entry)
      }
      try {
        data.dashboards.addWidget(target.id, { title: w.title, source: src as WidgetSource, view: w.view, options: w.options, layout: w.layout })
      } catch (err) {
        noteFailure(err, 'library', `Skipped incompatible widget "${w.title}" during board import`)
      }
    }
    return target.id
  },
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

export const exerciseKind = workoutPageKind(EXERCISE, {
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
}, workout)

export const workoutEntryKind = workoutPageKind(WORKOUT, {
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
}, workout)

const repoLine = (r: { values: unknown[]; tags: string[] }) => `${r.values.length} values${r.tags.length ? ` · #${r.tags.join(' #')}` : ''}`

export const repoKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'repo',
  ...pagePacking(),
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
    const trimmed = query.trim()
    const all = repoIds().map((m) => getRepo(m.id))
    if (!trimmed) return all.slice(0, limit).map((r) => ({ kind: 'repo', id: r.id, title: r.title, at: r.updatedAt }))
    return all
      .flatMap((r) => {
        const m = scoreDoc(trimmed, {
          title: r.title,
          tags: r.tags,
          labels: ['repo', 'repos'],
          body: r.values.join(' ')
        })
        return m ? [{ kind: 'repo', id: r.id, title: r.title, at: r.updatedAt, ...(m.snippet ? { excerpt: m.snippet } : {}), _score: m.score }] : []
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score: _s, ...h }) => h)
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
  draw: (id, count) => drawRepo(id, count),
  linkActions: rollLinkActions((id) => rollRepo(id))
}

function sheetStructuredFields(s: CharacterSheet): KindField[] {
  const seen = new Set(s.fields.map((f) => f.toLowerCase()))
  const custom = s.fields.map((f) => ({ name: f, text: s.values[f] ?? '' }))
  for (const [k, v] of Object.entries(s.values)) if (!seen.has(k.toLowerCase()) && v.trim()) custom.push({ name: k, text: v })
  const extra: KindField[] = []
  if (s.dnd) {
    if (s.dnd.race.trim()) extra.push({ name: 'Race', text: s.dnd.race })
    if (s.dnd.cls.trim()) extra.push({ name: 'Class', text: s.dnd.cls })
    if (s.dnd.background.trim()) extra.push({ name: 'Background', text: s.dnd.background })
    if (s.dnd.alignment.trim()) extra.push({ name: 'Alignment', text: s.dnd.alignment })
    extra.push({ name: 'Level', text: String(s.dnd.level) })
  }
  if (s.faction?.trim()) extra.push({ name: 'Faction', text: s.faction })
  extra.push({ name: 'Where now', text: s.story.where })
  return [...custom, ...extra]
}

function sheetSearchDoc(s: CharacterSheet): { title: string; labels: string[]; fields: SearchField[]; body: string } {
  const fields: SearchField[] = sheetStructuredFields(s)
    .filter((f) => f.text.trim())
    .map((f) => ({ name: f.name, value: f.text }))
  const bodyParts: string[] = []
  if (s.dnd?.features.length) bodyParts.push(s.dnd.features.map((f) => `${f.name} ${f.text}`).join(' '))
  if (s.story.sessions.length) bodyParts.push(s.story.sessions.map((x) => `${x.title} ${x.summary ?? ''} ${x.notes}`).join(' '))
  const memories = s.mind?.memories ?? []
  if (memories.length) {
    bodyParts.push(
      memories
        .filter((m) => m.category !== 'secret')
        .map((m) => [m.summary, m.detail ?? '', (m.tags ?? []).join(' ')].filter(Boolean).join(' '))
        .join(' ')
    )
  }
  if (s.relationships?.length) {
    for (const r of s.relationships) {
      const rel = [r.target, r.role, r.stance, r.category, r.notes].filter(Boolean).join(' ')
      if (rel) fields.push({ name: 'Relationship', value: rel })
    }
  }
  return { title: s.title, labels: ['character', 'characters', 'sheet'], fields, body: bodyParts.join(' ') }
}

export const sheetKind: Kind = {
  presents: { chat: true, widget: ENTRY_WIDGET },
  group: 'Yours',
  kind: 'sheet',
  image: (id) => getSheet(id).image,
  relations: {
    list: (id) => getSheet(id).relationships ?? [],
    save: (id, list) => void setSheetRelationships(id, list)
  },
  ...pagePacking(sheetRefs()),
  pageTypes: [SHEET_TYPE],
  label: 'Character',
  plural: 'Characters',
  exportable: true,
  export: (id) => withJson(sheetKind, id, getSheet(id)),
  icon: 'id-card',
  description: 'characters, yours or for agents to play: named fields of text, and D&D stats with a story log; an agent can wear one as its character',
  parts: ['sheet'],
  defaultPart: () => 'sheet',
  actions: ['sheet_write', 'update_stats', 'update_proficiencies', 'character_learn_event', 'character_set_state'],
  available: () => true,
  title: (id) => getSheet(id).title,
  search(query, limit) {
    const trimmed = query.trim()
    const sheets = sheetIds().map((m) => getSheet(m.id))
    if (!trimmed) return sheets.slice(0, limit).map((s) => ({ kind: 'sheet', id: s.id, title: s.title, at: s.updatedAt }))
    return sheets
      .flatMap((s) => {
        const m = scoreDoc(trimmed, sheetSearchDoc(s))
        return m ? [{ kind: 'sheet', id: s.id, title: s.title, at: s.updatedAt, ...(m.snippet ? { excerpt: m.snippet } : {}), _score: m.score }] : []
      })
      .sort((a, b) => b._score - a._score || (b.at ?? 0) - (a.at ?? 0))
      .slice(0, limit)
      .map(({ _score: _s, ...h }) => h)
  },
  resolve: (ref) => findSheet(ref),
  line: (id) => sheetLine(getSheet(id)),
  fields: (id) => sheetStructuredFields(getSheet(id)),
  card(id, ctx) {
    return this.export!(id, ctx).markdown
  },
  handTo: SHEET_HAND_TO,
  full: (id) => withTags(sheetMarkdown(id), id),
  remove: (id) => {
    try {
      takeOut(id)
    } catch {
      // Not in a save
    }
    for (const w of worlds.list()) {
      if (w.player === id) worlds.setPlayer(w.id, null)
    }
    void data.pages.delete(id)
  },
  rename: (id, name) => void data.pages.write({ ref: id, title: name })
}

const slideshowLine = (id: string) => `${getSlideshow(id).pictures.length} pictures`

export const slideshowKind: Kind = {
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

const ADDON_ALIASES: Record<string, string[]> = {
  'cards:card': ['cards.card'],
  'cards:deck': ['cards.deck'],
  'cards:layout': ['cards.layout', 'layout'],
  'cards:set': ['cards.set', 'set'],
  'storyteller:template': ['template', 'story_template'],
  'storyteller:poi': ['poi'],
  'storyteller:tale': ['tale'],
  'weather:forecast': ['weather', 'forecast']
}

function addonKinds(): OwnedKind[] {
  return modules.pageTypes().map(({ module, spec }) => {
    const type = `${module}:${spec.type}`
    const sourceName = modules.nameOf(module)
    const kind = pageKindOf(type)
    const aliases = ADDON_ALIASES[type]
    const owned: Kind = {
      kind,
      ...(aliases ? { aliases } : {}),
      family: 'page:addon',
      presents: { chat: true, widget: ENTRY_WIDGET },
      ...pagePacking(cardRefsFor(type)),
      label: spec.label,
      plural: spec.plural,
      source: sourceName,
      group: spec.group || sourceName,
      exportable: true,
      handTo: PAGE_HAND_TO,
      pageTypes: [type],
      missing: (ref) => data.pages.missing(ref, kind),
      export: (id) => pageExport(data.pages.get(id)),
      textParts: ['summary'],
      readView: (id, options, ctx) => readPageView(id, options, ctx),
      icon: spec.icon || 'box',
      description: spec.description || modules.descriptionOf(module) || spec.label,
      parts: [...Object.keys(spec.parts), 'picture', 'summary'],
      actions: spec.actions,
      title: (id) => data.pages.get(id).title,
      available: () => true,
      search(query, limit) {
        const trimmed = query.trim()
        const metas = data.pages.ofType(type)
        if (!trimmed) return metas.slice(0, limit).map((p) => ({ kind, id: p.id, title: p.title, at: p.updatedAt }))
        return metas
          .flatMap((p) => {
            const fullPage = type === 'cards:deck' ? null : data.pages.get(p.id)
            const body = [p.summary, ...(fullPage ? [fullPage.body, flattenText(fullPage.data)] : [])].filter(Boolean).join(' ')
            const m = scoreDoc(trimmed, { title: p.title, labels: [spec.label, spec.plural, kind], body })
            return m ? [{ kind, id: p.id, title: p.title, at: p.updatedAt, ...(m.snippet ? { excerpt: m.snippet } : {}), _score: m.score }] : []
          })
          .sort((a, b) => b._score - a._score || (b.at ?? 0) - (a.at ?? 0))
          .slice(0, limit)
          .map(({ _score: _s, ...h }) => h)
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
        ? (() => {
            const addonRoll = (id: string) => {
              const value = modules.pageRoll(id)
              if (value === null) throw new ToolError(`"${data.pages.metaFor(id)?.title ?? id}" can't be rolled right now: its tool may be off, or it has nothing to pick from. read it to see what it holds.`)
              return value
            }
            return {
              roll: addonRoll,
              draw(id: string, count: number) {
                const values = modules.pageDraw(id, count)
                if (values === null) throw new ToolError(`"${data.pages.metaFor(id)?.title ?? id}" can't be drawn from right now: its tool may be off, or it has nothing to pick from.`)
                return values
              },
              linkActions: rollLinkActions(addonRoll)
            }
          })()
        : {})
    }
    return { kind: owned, module }
  })
}

registerKind(10, pageKind)
registerKind(20, folderKind)
registerKind(30, sheetKind)
registerKind(40, slideshowKind)
registerKind(50, repoKind)
registerKindSource('addons', 60, addonKinds)
registerKind(70, fileKind)
registerModuleKind('workout', workoutEntryKind, 80)
registerModuleKind('workout', exerciseKind, 90)
registerKind(290, boardKind)
