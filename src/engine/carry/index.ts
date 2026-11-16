import fs from 'node:fs'
import type { CarryAbout, CarryMode, CarryOpened, CarrySource, CarrySummary } from '@shared/carry'
import { data } from '../data/hub'
import { writeUserFile } from '../util/fs'
import { USER, kindNamed, resolveEntry, type Kind } from '../library/kinds'
import { assetsIn, swapAssets } from '../library/packing'
import { isPng } from './png'
import { decodeCardPng, encodeCardPng, peekCardPng } from '../portability/codec'

interface CarriedEntry {
  kind: string
  id: string
  title: string
  value: unknown
}

type Carriable = Kind & Required<Pick<Kind, 'pack' | 'unpack'>>

function carriable(k: Kind | undefined): k is Carriable {
  return Boolean(k?.pack && k.unpack)
}

function kind(name: string): Carriable {
  const k = kindNamed(name)
  if (!carriable(k)) throw new Error(`This Seven can't take a ${name}. Turn on the tool that adds it, then drop the picture again.`)
  return k
}

function collect(entry: string): CarriedEntry[] {
  const out: CarriedEntry[] = []
  const seen = new Set<string>()
  const visit = (k: Carriable, id: string, main: boolean) => {
    const key = `${k.kind}/${id}`
    if (seen.has(key)) return
    seen.add(key)
    for (const u of k.uses?.(id) ?? []) {
      const dep = kindNamed(u.kind)
      if (carriable(dep) && dep.resolve(u.id, USER)) visit(dep, u.id, false)
    }
    const value = k.pack(id)
    if (value === undefined && main) throw new Error(`${k.title(id)} is built in, so every Seven already has it`)
    if (value !== undefined) out.push({ kind: k.kind, id, title: k.title(id), value })
  }
  const { kind: k, id } = resolveEntry(entry, null, USER)
  if (!carriable(k)) throw new Error(`A ${k.label.toLowerCase()} can't be carried in a picture`)
  visit(k, id, true)
  return out
}

function picture(id: string): Buffer {
  const meta = data.assets.get(id)
  const bytes = data.assets.readBytes(meta)
  if (!isPng(bytes)) throw new Error(`${meta.name} is not a PNG picture. Only PNG pictures can carry things.`)
  return bytes
}

function framedPicture(base64: string): Buffer {
  const bytes = Buffer.from(base64, 'base64')
  if (!isPng(bytes)) throw new Error('The framed picture is not a PNG picture')
  return bytes
}

function aboutOf(entries: CarriedEntry[], text: string | null): CarryAbout {
  const main = entries.at(-1)
  return {
    kind: main?.kind ?? null,
    label: main ? kind(main.kind).label : 'Data',
    title: main?.title ?? (text ?? '').trim().split('\n')[0].slice(0, 60),
    also: entries.slice(0, -1).map((e) => `${kind(e.kind).label}: ${e.title}`)
  }
}

export function carryDescribe(entry: string): CarryAbout {
  return aboutOf(collect(entry), null)
}

export function carrySave(input: { entry: string | null; text: string | null; picture: string; lock: boolean; path: string; framed?: string | null }): void {
  const png = input.framed ? framedPicture(input.framed) : picture(input.picture)
  const entries = input.entry ? collect(input.entry) : []
  if (!input.entry && !input.text?.trim()) throw new Error('Give an entry or some text to carry')
  const assetFiles = assetsIn(entries.map((e) => e.value)).map((id) => {
    const meta = data.assets.get(id)
    return {
      meta: { id: meta.id, name: meta.name, size: meta.size },
      data: data.assets.readBytes(meta)
    }
  })
  const out = encodeCardPng({
    png,
    about: aboutOf(entries, input.text),
    entries,
    text: input.entry ? null : (input.text ?? ''),
    files: assetFiles,
    protection: input.lock ? 'vault' : 'none'
  })
  writeUserFile(input.path, out)
}

function bytesOf(source: CarrySource): Buffer | null {
  if ('path' in source) return fs.readFileSync(source.path)
  const meta = data.assets.metaFor(source.asset)
  return meta && meta.mime === 'image/png' ? data.assets.readBytes(meta) : null
}

function existing(about: CarryAbout): string | null {
  if (!about.kind) return null
  return kindNamed(about.kind)?.resolve(about.title, USER) ?? null
}

export function carryPeek(sources: CarrySource[]): CarrySummary[] {
  return sources.flatMap((source) => {
    const bytes = bytesOf(source)
    if (!bytes) return []
    const peeked = peekCardPng(bytes)
    if (!peeked) return []
    return [
      {
        source,
        savedAt: peeked.savedAt,
        locked: peeked.locked,
        about: peeked.about,
        exists: peeked.about !== null && existing(peeked.about) !== null
      }
    ]
  })
}

export function carryOpen(source: CarrySource, mode: CarryMode): CarryOpened {
  const bytes = bytesOf(source)
  if (!bytes) throw new Error('This picture carries nothing')
  const decoded = decodeCardPng(bytes)
  const { body, fileData } = decoded
  if (body.text !== null) return { entry: null, text: body.text }
  const ids = new Map<string, string>()
  for (const f of body.files) {
    const added = data.assets.registerBytes(f.name, fileData.get(f.id) ?? Buffer.alloc(0), { tool: 'carry', sessionId: null, original: f.name })
    ids.set(f.id, added.id)
  }
  const made: { kind: string; old: string; id: string }[] = []
  const entry = (old: string, kindName?: string) => made.find((m) => m.old === old && (!kindName || m.kind === kindName))?.id ?? old
  for (const e of body.entries) {
    const k = kind(e.kind)
    const replace = mode === 'replace' ? k.resolve(e.title, USER) : null
    made.push({ kind: e.kind, old: e.id, id: k.unpack(swapAssets(e.value, ids), { replace, parent: null, entry }) })
  }
  const main = made.at(-1)
  return { entry: main ? { kind: main.kind, id: main.id } : null, text: null }
}
