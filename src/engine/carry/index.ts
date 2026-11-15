import fs from 'node:fs'
import zlib from 'node:zlib'
import { isSealed, seal, unseal } from '@shared/sealed'
import type { CarryAbout, CarryMode, CarryOpened, CarrySource, CarrySummary } from '@shared/carry'
import { data } from '../data/hub'
import { secure } from '../util/secure'
import { writeUserFile } from '../util/fs'
import { USER, kindNamed, resolveEntry, type Kind } from '../library/kinds'
import { assetsIn, swapAssets } from '../library/packing'
import { isPng, readChunk, writeChunk } from './png'

const CHUNK = 'seVn'

interface Front {
  v: 1 | 2
  locked: boolean
  savedAt: number
  about?: CarryAbout
}

interface Body {
  entries: { kind: string; id: string; title: string; value: unknown }[]
  text: string | null
  files: { id: string; name: string; size: number }[]
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

function collect(entry: string): Body['entries'] {
  const out: Body['entries'] = []
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

function aboutOf(entries: Body['entries'], text: string | null): CarryAbout {
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
  if (input.lock && !secure.keys) throw new Error('Set up the vault in Settings first, or untick Lock it')
  const entries = input.entry ? collect(input.entry) : []
  if (!input.entry && !input.text?.trim()) throw new Error('Give an entry or some text to carry')
  const files = assetsIn(entries.map((e) => e.value)).map((id) => data.assets.get(id))
  const body: Body = { entries, text: input.entry ? null : (input.text ?? ''), files: files.map((f) => ({ id: f.id, name: f.name, size: f.size })) }
  const about = aboutOf(entries, input.text)
  const plain = zlib.deflateSync(Buffer.concat([sized(about), sized(body), ...files.map((f) => data.assets.readBytes(f))]))
  const front: Front = { v: 2, locked: input.lock, savedAt: Date.now(), ...(input.lock ? {} : { about }) }
  const payload = input.lock && secure.keys ? seal(secure.keys, plain) : plain
  writeUserFile(input.path, writeChunk(png, CHUNK, Buffer.concat([sized(front), payload])))
}

function sized(value: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(value), 'utf8')
  const size = Buffer.alloc(4)
  size.writeUInt32BE(json.length, 0)
  return Buffer.concat([size, json])
}

function take<T>(buf: Buffer, at: number): { value: T; at: number } {
  const length = buf.readUInt32BE(at)
  return { value: JSON.parse(buf.toString('utf8', at + 4, at + 4 + length)) as T, at: at + 4 + length }
}

function split(chunk: Buffer): { front: Front; payload: Buffer } {
  const { value, at } = take<Front & Partial<CarryAbout>>(chunk, 0)
  if (value.v !== 1 && value.v !== 2) throw new Error('This picture was made by a newer Seven. Update Seven to open it.')
  const front: Front = value.v === 1 ? { v: 1, locked: value.locked, savedAt: value.savedAt, about: { kind: value.kind ?? null, label: value.label ?? '', title: value.title ?? '', also: value.also ?? [] } } : value
  return { front, payload: chunk.subarray(at) }
}

function opened(front: Front, payload: Buffer): { about: CarryAbout; body: Body; files: Buffer } {
  if (front.locked && !secure.keys?.privateKey) throw new Error('This picture is locked with a vault key. Unlock your vault, then open it again.')
  const raw = zlib.inflateSync(front.locked && secure.keys && isSealed(payload) ? unseal(secure.keys, payload) : payload)
  const about = front.v === 1 ? { value: front.about as CarryAbout, at: 0 } : take<CarryAbout>(raw, 0)
  const body = take<Body>(raw, about.at)
  return { about: about.value, body: body.value, files: raw.subarray(body.at) }
}

function bytesOf(source: CarrySource): Buffer | null {
  if ('path' in source) return fs.readFileSync(source.path)
  const meta = data.assets.metaFor(source.asset)
  return meta && meta.mime === 'image/png' ? data.assets.readBytes(meta) : null
}

function chunkOf(source: CarrySource): Buffer | null {
  const bytes = bytesOf(source)
  return bytes && isPng(bytes) ? readChunk(bytes, CHUNK) : null
}

function existing(about: CarryAbout): string | null {
  if (!about.kind) return null
  return kindNamed(about.kind)?.resolve(about.title, USER) ?? null
}

export function carryPeek(sources: CarrySource[]): CarrySummary[] {
  return sources.flatMap((source) => {
    const chunk = chunkOf(source)
    if (!chunk) return []
    const { front, payload } = split(chunk)
    const about = front.about ?? (secure.keys?.privateKey ? opened(front, payload).about : null)
    return [{ source, savedAt: front.savedAt, locked: front.locked, about, exists: about !== null && existing(about) !== null }]
  })
}

export function carryOpen(source: CarrySource, mode: CarryMode): CarryOpened {
  const chunk = chunkOf(source)
  if (!chunk) throw new Error('This picture carries nothing')
  const { front, payload } = split(chunk)
  const { body, files } = opened(front, payload)
  if (body.text !== null) return { entry: null, text: body.text }
  const ids = new Map<string, string>()
  let at = 0
  for (const f of body.files) {
    const added = data.assets.registerBytes(f.name, files.subarray(at, at + f.size), { tool: 'carry', sessionId: null, original: f.name })
    ids.set(f.id, added.id)
    at += f.size
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
