import { ASSET_IDS_IN, FOLDER_TYPE } from '@shared/ids'
import { data } from '../data/hub'
import type { PagePack } from '../data/pages'

export interface EntryRef {
  kind: string
  id: string
}

export interface Unpack {
  replace: string | null
  parent: string | null
  targetWorld?: string | null
  entry(id: string, kind?: string): string
}

export interface Packing {
  pack(id: string): unknown
  uses?(id: string): EntryRef[]
  unpack(value: unknown, how: Unpack): string
  placesOwnFiles?: boolean
}

export type NextName = (name: string, n: number) => string

const spaced: NextName = (name, n) => `${name} ${n}`

export function freeName(name: string, taken: (name: string) => boolean, next: NextName = spaced): string {
  if (!taken(name)) return name
  for (let n = 2; ; n++) if (!taken(next(name, n))) return next(name, n)
}

function strings(value: unknown, visit: (s: string) => string): unknown {
  if (typeof value === 'string') return visit(value)
  if (Array.isArray(value)) return value.map((v) => strings(v, visit))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, strings(v, visit)]))
  return value
}

export function assetsIn(value: unknown): string[] {
  const found = new Set<string>()
  strings(value, (s) => {
    for (const id of s.match(ASSET_IDS_IN) ?? []) if (data.assets.exists(id)) found.add(id)
    return s
  })
  return [...found]
}

export function swapAssets<T>(value: T, ids: Map<string, string>): T {
  return strings(value, (s) => s.replace(ASSET_IDS_IN, (id) => ids.get(id) ?? id)) as T
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`The ${what} in this picture is damaged`)
  return value as Record<string, unknown>
}

function named(value: unknown, key: string, what: string): string {
  const name = record(value, what)[key]
  if (typeof name !== 'string' || !name.trim()) throw new Error(`The ${what} in this picture has no name`)
  return name
}

function packPage(id: string): PagePack {
  const p = data.pages.get(id)
  return { title: p.title, type: p.type, body: p.body, fields: p.fields, records: p.records, data: p.data, image: p.image, view: p.view, voice: p.voice ?? null }
}

function putPage(value: unknown, replace: string | null, parent: string | null): string {
  const page = record(value, 'page') as unknown as PagePack
  const title = replace ? named(page, 'title', 'page') : freeName(named(page, 'title', 'page'), (t) => Boolean(data.pages.taken(t, parent)))
  return data.pages.put({ ...page, title }, { replace, parent }).id
}

export function pagePacking(refs?: { uses(value: unknown): EntryRef[]; swap(value: unknown, entry: Unpack['entry']): unknown }): Packing {
  return {
    pack: packPage,
    ...(refs ? { uses: (id: string) => refs.uses(data.pages.get(id).data) } : {}),
    unpack(value, how) {
      const page = record(value, 'page')
      return putPage(refs ? { ...page, data: refs.swap(page.data, how.entry) } : page, how.replace, how.parent)
    }
  }
}

export const filePacking: Packing = {
  pack: (id) => ({ file: id }),
  unpack(value) {
    const id = record(value, 'file').file
    if (typeof id !== 'string' || !data.assets.exists(id)) throw new Error('The file did not come with this picture')
    return id
  }
}

interface FolderPack {
  pages: { at: number; page: PagePack }[]
  files: { at: number; id: string }[]
}

export const folderPacking: Packing = {
  placesOwnFiles: true,
  pack(id) {
    const ids = [id]
    const out: FolderPack = { pages: [{ at: -1, page: packPage(id) }], files: [] }
    for (let i = 0; i < ids.length; i++) {
      for (const child of data.pages.under(ids[i])) {
        ids.push(child.id)
        out.pages.push({ at: i, page: packPage(child.id) })
      }
      for (const a of data.assets.list()) if (a.parent === ids[i]) out.files.push({ at: i, id: a.id })
    }
    return out
  },
  unpack(value, how) {
    const folder = record(value, 'folder') as unknown as FolderPack
    if (!Array.isArray(folder.pages) || !folder.pages.length || !Array.isArray(folder.files)) throw new Error('The folder in this picture is damaged')
    const made: string[] = []
    for (const { at, page } of folder.pages) {
      const parent = at < 0 ? how.parent : made[at]
      if (parent === undefined) throw new Error('The folder in this picture is damaged')
      const same = at < 0 ? how.replace : how.replace ? (data.pages.taken(named(page, 'title', 'page'), parent)?.id ?? null) : null
      made.push(putPage(at < 0 ? { ...page, type: FOLDER_TYPE } : page, same, parent))
    }
    for (const { at, id } of folder.files) if (made[at] && data.assets.exists(id)) data.assets.move(id, made[at])
    return made[0]
  }
}

export function storePacking<T extends { id: string; name: string }>(spec: {
  find(id: string): T | null
  names(): string[]
  save(input: Record<string, unknown> & { id: string | null; name: string }): { id: string }
  drop?: string[]
  everywhere?(item: T): boolean
  refs?: { key: string; kind(id: string): string | null }[]
  next?: NextName
}): Packing {
  const drop = new Set(['id', 'createdAt', 'updatedAt', ...(spec.drop ?? [])])
  return {
    pack(id) {
      const item = spec.find(id)
      if (!item) throw new Error(`${id} is built in or no longer exists, so there is nothing to carry`)
      if (spec.everywhere?.(item)) return undefined
      return Object.fromEntries(Object.entries(item).filter(([k]) => !drop.has(k)))
    },
    uses(id) {
      const item = spec.find(id) as Record<string, unknown> | null
      if (!item) return []
      return (spec.refs ?? []).flatMap((r) => {
        const ref = item[r.key]
        const kind = typeof ref === 'string' && ref ? r.kind(ref) : null
        return kind && typeof ref === 'string' ? [{ kind, id: ref }] : []
      })
    },
    unpack(value, how) {
      const item = { ...record(value, 'entry') }
      for (const k of drop) delete item[k]
      for (const r of spec.refs ?? []) if (typeof item[r.key] === 'string' && item[r.key]) item[r.key] = how.entry(item[r.key] as string)
      const name = named(item, 'name', 'entry')
      const taken = new Set(spec.names().map((n) => n.toLowerCase()))
      return spec.save({ ...item, id: how.replace, name: how.replace ? name : freeName(name, (n) => taken.has(n.toLowerCase()), spec.next) }).id
    }
  }
}
