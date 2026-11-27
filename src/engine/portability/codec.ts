import zlib from 'node:zlib'
import { isSealed, seal, unseal } from '@shared/sealed'
import { WrongVaultKeyError, isPasswordSealed, sealWithPassword, unsealWithPassword } from '@shared/exportCrypto'
import type { CarryAbout } from '@shared/carry'
import type {
  PortableEntryRecord,
  PortableFileMeta,
  PortableJsonEnvelope,
  PortableJsonFileRecord,
  ProtectionMode
} from '@shared/portability'
import { secure } from '../util/secure'
import { isPng, readChunk, writeChunk } from '../carry/png'
import { bundleAssetPath, readZipArchive, writeZipArchive } from './archive'

export const CARRY_CHUNK = 'seVn'

export interface EncodedPayloadBody {
  entries: PortableEntryRecord[]
  text: string | null
  files: PortableFileMeta[]
}

export interface DecodedPayload {
  version: 1 | 2 | 3
  protection: ProtectionMode
  savedAt: number
  about: CarryAbout
  body: EncodedPayloadBody
  fileData: Map<string, Buffer>
  missing?: string[]
}

export type LooseFile = (meta: PortableFileMeta) => Buffer | null

export interface PeekHeader {
  version: 1 | 2 | 3
  protection: ProtectionMode
  savedAt: number
  about: CarryAbout | null
  locked: boolean
  wrongVaultKey: boolean
  body: EncodedPayloadBody | null
  fileData: Map<string, Buffer> | null
  missing?: string[]
}

interface ChunkFrontV1 {
  v: 1
  locked: boolean
  savedAt: number
  kind?: string | null
  label?: string
  title?: string
  also?: string[]
}

interface ChunkFrontV2 {
  v: 2
  locked: boolean
  savedAt: number
  about?: CarryAbout
}

interface ChunkFrontV3 {
  v: 3
  protection: ProtectionMode
  savedAt: number
  about?: CarryAbout
}

type ChunkFront = ChunkFrontV1 | ChunkFrontV2 | ChunkFrontV3

export function sized(value: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(value), 'utf8')
  const size = Buffer.alloc(4)
  size.writeUInt32BE(json.length, 0)
  return Buffer.concat([size, json])
}

function take<T>(buf: Buffer, at: number): { value: T; at: number } {
  const length = buf.readUInt32BE(at)
  return { value: JSON.parse(buf.toString('utf8', at + 4, at + 4 + length)) as T, at: at + 4 + length }
}

function sealPayload(plainCompressed: Buffer, protection: ProtectionMode, password?: string): Buffer {
  if (protection === 'none') return plainCompressed
  if (protection === 'password') return sealWithPassword(plainCompressed, password ?? '')
  if (!secure.keys) throw new Error('Set up a vault in Settings first, or choose None / Password protection.')
  return seal(secure.keys, plainCompressed)
}

function unsealPayload(payload: Buffer, protection: ProtectionMode, password?: string): Buffer {
  if (protection === 'password' || isPasswordSealed(payload)) {
    return unsealWithPassword(payload, password ?? '')
  }
  if (protection === 'vault' || isSealed(payload)) {
    if (!secure.keys?.privateKey) {
      throw new Error('This export is locked with a vault key. Unlock your vault, then open it again.')
    }
    try {
      return unseal(secure.keys, payload)
    } catch {
      throw new WrongVaultKeyError()
    }
  }
  return payload
}

function packBinaryStream(about: CarryAbout, entries: PortableEntryRecord[], text: string | null, files: { meta: PortableFileMeta; data: Buffer }[]): Buffer {
  const body: EncodedPayloadBody = {
    entries,
    text,
    files: files.map((f) => ({ id: f.meta.id, name: f.meta.name, size: f.meta.size }))
  }
  return zlib.deflateSync(Buffer.concat([sized(about), sized(body), ...files.map((f) => f.data)]))
}

function unpackBinaryStream(
  version: 1 | 2 | 3,
  protection: ProtectionMode,
  savedAt: number,
  frontAbout: CarryAbout | undefined,
  compressed: Buffer
): DecodedPayload {
  const raw = zlib.inflateSync(compressed)
  const about = version === 1 ? { value: frontAbout as CarryAbout, at: 0 } : take<CarryAbout>(raw, 0)
  const body = take<EncodedPayloadBody>(raw, about.at)
  const blob = raw.subarray(body.at)
  const fileData = new Map<string, Buffer>()
  let cursor = 0
  for (const f of body.value.files) {
    fileData.set(f.id, blob.subarray(cursor, cursor + f.size))
    cursor += f.size
  }
  return {
    version,
    protection,
    savedAt,
    about: about.value,
    body: body.value,
    fileData
  }
}

export function encodeCardPng(args: {
  png: Buffer
  about: CarryAbout
  entries: PortableEntryRecord[]
  text: string | null
  files: { meta: PortableFileMeta; data: Buffer }[]
  protection: ProtectionMode
  password?: string
}): Buffer {
  if (!isPng(args.png)) throw new Error('Only PNG pictures can carry exported Seven data.')
  const deflated = packBinaryStream(args.about, args.entries, args.text, args.files)
  const payload = sealPayload(deflated, args.protection, args.password)
  const front: ChunkFrontV3 = {
    v: 3,
    protection: args.protection,
    savedAt: Date.now(),
    ...(args.protection === 'none' ? { about: args.about } : {})
  }
  return writeChunk(args.png, CARRY_CHUNK, Buffer.concat([sized(front), payload]))
}

export function encodeJsonExport(args: {
  about: CarryAbout
  entries: PortableEntryRecord[]
  text: string | null
  files: { meta: PortableFileMeta; data: Buffer }[]
  protection: ProtectionMode
  password?: string
}): Buffer {
  const savedAt = Date.now()
  if (args.protection === 'none') {
    const jsonFiles: PortableJsonFileRecord[] = args.files.map((f) => ({
      id: f.meta.id,
      name: f.meta.name,
      size: f.meta.size,
      data: f.data.toString('base64')
    }))
    const envelope: PortableJsonEnvelope = {
      seven: 'export',
      version: 3,
      protection: 'none',
      savedAt,
      about: args.about,
      entries: args.entries,
      ...(args.text !== null ? { text: args.text } : {}),
      ...(jsonFiles.length ? { files: jsonFiles } : {})
    }
    return Buffer.from(JSON.stringify(envelope, null, 2), 'utf8')
  }
  const deflated = packBinaryStream(args.about, args.entries, args.text, args.files)
  const payload = sealPayload(deflated, args.protection, args.password)
  const envelope: PortableJsonEnvelope = {
    seven: 'export',
    version: 3,
    protection: args.protection,
    savedAt,
    about: args.protection === 'password' || args.protection === 'vault'
      ? { kind: null, label: 'Locked export', title: 'Locked export', also: [] }
      : args.about,
    payload: payload.toString('base64')
  }
  return Buffer.from(JSON.stringify(envelope, null, 2), 'utf8')
}

export function encodeBundleArchive(args: {
  about: CarryAbout
  entries: PortableEntryRecord[]
  text: string | null
  files: { meta: PortableFileMeta; data: Buffer }[]
  protection: ProtectionMode
  password?: string
}): Buffer {
  const savedAt = Date.now()
  if (args.protection === 'none') {
    const manifestFiles: PortableFileMeta[] = args.files.map((f) => ({
      id: f.meta.id,
      name: f.meta.name,
      size: f.meta.size,
      path: bundleAssetPath(f.meta.id, f.meta.name)
    }))
    const manifest: PortableJsonEnvelope = {
      seven: 'export',
      version: 3,
      protection: 'none',
      savedAt,
      about: args.about,
      entries: args.entries,
      ...(args.text !== null ? { text: args.text } : {}),
      ...(manifestFiles.length ? { files: manifestFiles } : {})
    }
    return writeZipArchive([
      { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), compress: true },
      ...args.files.map((f, i) => ({
        name: manifestFiles[i].path!,
        data: f.data,
        compress: true
      }))
    ])
  }
  const deflated = packBinaryStream(args.about, args.entries, args.text, args.files)
  const sealed = sealPayload(deflated, args.protection, args.password)
  const manifest = {
    seven: 'export' as const,
    version: 3 as const,
    protection: args.protection,
    savedAt
  }
  return writeZipArchive([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), compress: true },
    { name: 'payload.s7', data: sealed, compress: false }
  ])
}

function normalizeFront(chunk: Buffer): { version: 1 | 2 | 3; protection: ProtectionMode; savedAt: number; about?: CarryAbout; payload: Buffer } {
  const { value, at } = take<ChunkFront>(chunk, 0)
  if (value.v === 1) {
    const protection: ProtectionMode = value.locked ? 'vault' : 'none'
    const about: CarryAbout = { kind: value.kind ?? null, label: value.label ?? '', title: value.title ?? '', also: value.also ?? [] }
    return { version: 1, protection, savedAt: value.savedAt, about, payload: chunk.subarray(at) }
  }
  if (value.v === 2) {
    return { version: 2, protection: value.locked ? 'vault' : 'none', savedAt: value.savedAt, about: value.about, payload: chunk.subarray(at) }
  }
  if (value.v === 3) {
    return { version: 3, protection: value.protection, savedAt: value.savedAt, about: value.about, payload: chunk.subarray(at) }
  }
  throw new Error('This picture was made by a newer Seven. Update Seven to open it.')
}

function tryAutoDecrypt(
  version: 1 | 2 | 3,
  protection: ProtectionMode,
  savedAt: number,
  frontAbout: CarryAbout | undefined,
  payload: Buffer
): PeekHeader {
  if (protection === 'none') {
    const decoded = unpackBinaryStream(version, protection, savedAt, frontAbout, payload)
    return { version, protection, savedAt, about: decoded.about, locked: false, wrongVaultKey: false, body: decoded.body, fileData: decoded.fileData }
  }
  if (protection === 'password') {
    return { version, protection, savedAt, about: frontAbout ?? null, locked: true, wrongVaultKey: false, body: null, fileData: null }
  }
  if (!secure.keys?.privateKey) {
    return { version, protection, savedAt, about: frontAbout ?? null, locked: true, wrongVaultKey: false, body: null, fileData: null }
  }
  try {
    const compressed = unsealPayload(payload, 'vault')
    const decoded = unpackBinaryStream(version, protection, savedAt, frontAbout, compressed)
    return { version, protection, savedAt, about: decoded.about, locked: false, wrongVaultKey: false, body: decoded.body, fileData: decoded.fileData }
  } catch (err) {
    const wrongVaultKey = err instanceof WrongVaultKeyError
    return { version, protection, savedAt, about: null, locked: true, wrongVaultKey, body: null, fileData: null }
  }
}

export function peekCardPng(pngBytes: Buffer): PeekHeader | null {
  if (!isPng(pngBytes)) return null
  const chunk = readChunk(pngBytes, CARRY_CHUNK)
  if (!chunk) return null
  const { version, protection, savedAt, about, payload } = normalizeFront(chunk)
  return tryAutoDecrypt(version, protection, savedAt, about, payload)
}

export function decodeCardPng(pngBytes: Buffer, password?: string): DecodedPayload {
  const chunk = isPng(pngBytes) ? readChunk(pngBytes, CARRY_CHUNK) : null
  if (!chunk) throw new Error('This picture carries nothing')
  const { version, protection, savedAt, about, payload } = normalizeFront(chunk)
  const compressed = unsealPayload(payload, protection, password)
  return unpackBinaryStream(version, protection, savedAt, about, compressed)
}

export function isPortableJsonEnvelope(raw: unknown): raw is PortableJsonEnvelope {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      !Array.isArray(raw) &&
      (raw as { seven?: unknown }).seven === 'export' &&
      (raw as { version?: unknown }).version === 3
  )
}

function jsonFiles(env: PortableJsonEnvelope, loose: LooseFile | null): { fileData: Map<string, Buffer>; files: PortableFileMeta[]; missing: string[] } {
  const fileData = new Map<string, Buffer>()
  const files: PortableFileMeta[] = []
  const missing: string[] = []
  for (const f of env.files ?? []) {
    const inline = 'data' in f && typeof f.data === 'string' && f.data ? Buffer.from(f.data, 'base64') : null
    const buf = inline?.length ? inline : loose?.(f) ?? null
    if (!buf) {
      missing.push(f.path ?? f.name)
      continue
    }
    fileData.set(f.id, buf)
    files.push({ id: f.id, name: f.name, size: buf.length })
  }
  return { fileData, files, missing }
}

export function peekJsonEnvelope(env: PortableJsonEnvelope, loose: LooseFile | null = null): PeekHeader {
  const protection: ProtectionMode = env.protection ?? 'none'
  const savedAt = typeof env.savedAt === 'number' ? env.savedAt : Date.now()
  if (protection === 'none' && Array.isArray(env.entries)) {
    const { fileData, files, missing } = jsonFiles(env, loose)
    return {
      version: 3,
      protection: 'none',
      savedAt,
      about: env.about ?? null,
      locked: false,
      wrongVaultKey: false,
      body: { entries: env.entries, text: env.text ?? null, files },
      fileData,
      missing
    }
  }
  const payload = Buffer.from(String(env.payload ?? ''), 'base64')
  return tryAutoDecrypt(3, protection, savedAt, undefined, payload)
}

export function decodeJsonEnvelope(env: PortableJsonEnvelope, password?: string, loose: LooseFile | null = null): DecodedPayload {
  const protection: ProtectionMode = env.protection ?? 'none'
  const savedAt = typeof env.savedAt === 'number' ? env.savedAt : Date.now()
  if (protection === 'none' && Array.isArray(env.entries)) {
    const { fileData, files, missing } = jsonFiles(env, loose)
    return {
      version: 3,
      protection: 'none',
      savedAt,
      about: env.about,
      body: { entries: env.entries, text: env.text ?? null, files },
      fileData,
      missing
    }
  }
  const payload = Buffer.from(String(env.payload ?? ''), 'base64')
  const compressed = unsealPayload(payload, protection, password)
  return unpackBinaryStream(3, protection, savedAt, undefined, compressed)
}

export async function peekBundleArchive(source: string | Buffer, maxBytes: number): Promise<PeekHeader> {
  const archive = await readZipArchive(source, maxBytes)
  const manifestRaw = archive.get('manifest.json')
  if (!manifestRaw) throw new Error('This archive is missing manifest.json.')
  const parsed = JSON.parse(manifestRaw.toString('utf8')) as PortableJsonEnvelope
  if (!isPortableJsonEnvelope(parsed)) throw new Error('Unrecognized bundle manifest format.')
  const protection: ProtectionMode = parsed.protection ?? 'none'
  const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now()
  if (protection === 'none') {
    const fileData = new Map<string, Buffer>()
    const files: PortableFileMeta[] = []
    for (const f of parsed.files ?? []) {
      const rel = f.path ?? bundleAssetPath(f.id, f.name)
      const buf = archive.get(rel) ?? Buffer.alloc(0)
      fileData.set(f.id, buf)
      files.push({ id: f.id, name: f.name, size: buf.length })
    }
    return {
      version: 3,
      protection: 'none',
      savedAt,
      about: parsed.about ?? null,
      locked: false,
      wrongVaultKey: false,
      body: { entries: parsed.entries ?? [], text: parsed.text ?? null, files },
      fileData
    }
  }
  const sealed = archive.get('payload.s7')
  if (!sealed) throw new Error('Locked bundle is missing payload.s7.')
  return tryAutoDecrypt(3, protection, savedAt, undefined, sealed)
}

export async function decodeBundleArchive(source: string | Buffer, maxBytes: number, password?: string): Promise<DecodedPayload> {
  const archive = await readZipArchive(source, maxBytes)
  const manifestRaw = archive.get('manifest.json')
  if (!manifestRaw) throw new Error('This archive is missing manifest.json.')
  const parsed = JSON.parse(manifestRaw.toString('utf8')) as PortableJsonEnvelope
  if (!isPortableJsonEnvelope(parsed)) throw new Error('Unrecognized bundle manifest format.')
  const protection: ProtectionMode = parsed.protection ?? 'none'
  const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now()
  if (protection === 'none') {
    const fileData = new Map<string, Buffer>()
    const files: PortableFileMeta[] = []
    for (const f of parsed.files ?? []) {
      const rel = f.path ?? bundleAssetPath(f.id, f.name)
      const buf = archive.get(rel) ?? Buffer.alloc(0)
      fileData.set(f.id, buf)
      files.push({ id: f.id, name: f.name, size: buf.length })
    }
    return {
      version: 3,
      protection: 'none',
      savedAt,
      about: parsed.about,
      body: { entries: parsed.entries ?? [], text: parsed.text ?? null, files },
      fileData
    }
  }
  const sealed = archive.get('payload.s7')
  if (!sealed) throw new Error('Locked bundle is missing payload.s7.')
  const compressed = unsealPayload(sealed, protection, password)
  return unpackBinaryStream(3, protection, savedAt, undefined, compressed)
}
