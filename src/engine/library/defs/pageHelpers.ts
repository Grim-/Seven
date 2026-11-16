import { FOLDER_TYPE, toId } from '@shared/ids'
import { linkFor } from '@shared/text'
import { pageKindOf, type AssetMeta, type Page, type PageMeta, type ViewRef, type WorkoutPageType } from '@shared/types'
import { data } from '../../data/hub'
import type { PageTree } from '../../data/pages'
import { ENTRY_WIDGET } from './runtime'
import { pageExport } from '../exporters'
import { pagePacking } from '../packing'
import { modules } from '../../modules/registry'
import { tags as tagStore } from '../tags'
import { PAGE_HAND_TO } from '../../exporting/pages'
import { canSee, fieldsText, has, USER, type Kind, type KindContext, type ReadOptions } from './types'

export function entryLine(p: PageMeta, tree: PageTree): string {
  return `${pageKindOf(p.type)} ${tree.pathOf(p.id)}`
}

export function filesIn(folder: string | null, tree: PageTree): AssetMeta[] {
  const folders = new Set(tree.list.filter((p) => p.type === FOLDER_TYPE).map((p) => p.id))
  return data.assets.list().filter((a) => (a.parent && folders.has(a.parent) ? a.parent : null) === folder)
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

export function tagsText(id: string): string | null {
  const meta = data.pages.metaFor(id)
  if (!meta) return null
  const tagged = tagStore.of(pageKindOf(meta.type), id)
  return tagged.length ? `Tags: #${tagged.join(' #')}` : null
}

export function withTags(text: string, id: string): string {
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

export function readPageView(id: string, options: ReadOptions, ctx: KindContext = USER): { text: string; view: ViewRef } {
  const { text, page } = readPage(id, options, ctx)
  return { text, view: pageView(page) }
}

export function workoutPageKind(
  type: WorkoutPageType,
  spec: {
    label: string
    plural: string
    icon: string
    description: string
    parts: string[]
    textParts?: string[]
    actions: string[]
    summary: (meta: PageMeta) => string
    refs?: Parameters<typeof pagePacking>[0]
  },
  workoutAccess: { ensure(): void; read(t: WorkoutPageType, id: string): string }
): Kind {
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
      workoutAccess.ensure()
      const q = query.toLowerCase()
      return data.pages
        .ofType(type)
        .filter((p) => !q || has(p.title, q))
        .slice(0, limit)
        .map((p) => ({ kind: type, id: p.id, title: p.title, at: p.updatedAt }))
    },
    resolve(ref) {
      workoutAccess.ensure()
      return data.pages.find(ref, (p) => p.type === type)?.id ?? null
    },
    line: (id) => spec.summary(data.pages.metaFor(id)!),
    card(id, ctx) {
      return this.export!(id, ctx).markdown
    },
    full: (id) => withTags(workoutAccess.read(type, id), id),
    remove: (id) => void data.pages.delete(id),
    rename: (id, name) => void data.pages.write({ ref: id, title: name })
  }
}
