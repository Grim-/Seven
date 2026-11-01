import crypto, { type KeyObject } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { VAULT_LOCKED, WRONG_PASSPHRASE, errorCode } from './errors'

const FILE_MAGIC = Buffer.from('S7F1')
const CHUNK_MAGIC = Buffer.from('S7C1')
const LINE_PREFIX = '~'
const SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex')
const INFO = Buffer.from('seven-seal-v1')
const CHUNK = 64 * 1024
const TAG = 16
const CHUNK_HEADER = 4 + 32 + 8 + 4 + 8

export class VaultLocked extends Error {
  readonly code = VAULT_LOCKED
  constructor(message = 'The vault is locked. Unlock it to use this.') {
    super(message)
    this.name = 'VaultLocked'
  }
}

export class WrongPassphrase extends Error {
  readonly code = WRONG_PASSPHRASE
  constructor() {
    super('Wrong passphrase. Check it and try again.')
    this.name = 'WrongPassphrase'
  }
}

export function isVaultLocked(err: unknown): boolean {
  return err instanceof VaultLocked || errorCode(err) === VAULT_LOCKED
}

export interface VaultFile {
  version: 1
  kdf: { salt: string; N: number; r: number; p: number }
  publicKey: string
  privateKey: { iv: string; tag: string; data: string }
  createdAt: number
}

export interface VaultKeys {
  publicRaw: Buffer
  publicKey: KeyObject
  privateKey: KeyObject | null
}

function rawPublic(key: KeyObject): Buffer {
  return (key.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32)
}

export function publicFromRaw(raw: Buffer): KeyObject {
  return crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' })
}

export function privateFromDer(der: Buffer): KeyObject {
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
}

export function privateToDer(key: KeyObject): Buffer {
  return key.export({ type: 'pkcs8', format: 'der' }) as Buffer
}

function kek(passphrase: string, kdf: VaultFile['kdf']): Buffer {
  return crypto.scryptSync(passphrase.normalize('NFKC'), Buffer.from(kdf.salt, 'base64'), 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 512 * 1024 * 1024 })
}

export async function createVaultAsync(passphrase: string): Promise<{ file: VaultFile; keys: VaultKeys }> {
  const kdf = { salt: crypto.randomBytes(16).toString('base64'), N: 2 ** 17, r: 8, p: 1 }
  return createWith(kdf, await kekAsync(passphrase, kdf))
}

export function createVault(passphrase: string): { file: VaultFile; keys: VaultKeys } {
  const kdf = { salt: crypto.randomBytes(16).toString('base64'), N: 2 ** 17, r: 8, p: 1 }
  return createWith(kdf, kek(passphrase, kdf))
}

function createWith(kdf: VaultFile['kdf'], key: Buffer): { file: VaultFile; keys: VaultKeys } {
  const pair = crypto.generateKeyPairSync('x25519')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(privateToDer(pair.privateKey)), cipher.final()])
  const publicRaw = rawPublic(pair.publicKey)
  const file: VaultFile = {
    version: 1,
    kdf,
    publicKey: publicRaw.toString('base64'),
    privateKey: { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') },
    createdAt: Date.now()
  }
  return { file, keys: { publicRaw, publicKey: pair.publicKey, privateKey: pair.privateKey } }
}

function kekAsync(passphrase: string, kdf: VaultFile['kdf']): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(passphrase.normalize('NFKC'), Buffer.from(kdf.salt, 'base64'), 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 512 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  )
}

export async function openVaultAsync(file: VaultFile, passphrase: string): Promise<VaultKeys> {
  return openWith(file, await kekAsync(passphrase, file.kdf))
}

export function openVault(file: VaultFile, passphrase: string): VaultKeys {
  return openWith(file, kek(passphrase, file.kdf))
}

function openWith(file: VaultFile, key: Buffer): VaultKeys {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(file.privateKey.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(file.privateKey.tag, 'base64'))
  let der: Buffer
  try {
    der = Buffer.concat([decipher.update(Buffer.from(file.privateKey.data, 'base64')), decipher.final()])
  } catch {
    throw new WrongPassphrase()
  }
  const publicRaw = Buffer.from(file.publicKey, 'base64')
  return { publicRaw, publicKey: publicFromRaw(publicRaw), privateKey: privateFromDer(der) }
}

export function publicKeys(file: VaultFile): VaultKeys {
  const publicRaw = Buffer.from(file.publicKey, 'base64')
  return { publicRaw, publicKey: publicFromRaw(publicRaw), privateKey: null }
}

function deriveFor(keys: VaultKeys, ephRaw: Buffer, ephPrivate: KeyObject | null): Buffer {
  const shared = ephPrivate
    ? crypto.diffieHellman({ privateKey: ephPrivate, publicKey: keys.publicKey })
    : crypto.diffieHellman({ privateKey: keys.privateKey!, publicKey: publicFromRaw(ephRaw) })
  return Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.concat([ephRaw, keys.publicRaw]), INFO, 32))
}

function ephemeral(keys: VaultKeys): { raw: Buffer; key: Buffer } {
  const eph = crypto.generateKeyPairSync('x25519')
  const raw = rawPublic(eph.publicKey)
  return { raw, key: deriveFor(keys, raw, eph.privateKey) }
}

export function isSealed(buf: Buffer): boolean {
  return buf.length >= 4 && (buf.subarray(0, 4).equals(FILE_MAGIC) || buf.subarray(0, 4).equals(CHUNK_MAGIC))
}

export function seal(keys: VaultKeys, plain: Buffer): Buffer {
  const { raw, key } = ephemeral(keys)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([FILE_MAGIC, raw, iv, cipher.getAuthTag(), ct])
}

function unsealWhole(keys: VaultKeys, blob: Buffer): Buffer {
  if (!keys.privateKey) throw new VaultLocked()
  const raw = blob.subarray(4, 36)
  const iv = blob.subarray(36, 48)
  const tag = blob.subarray(48, 64)
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveFor(keys, raw, null), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(blob.subarray(64)), decipher.final()])
}

function chunkNonce(base: Buffer, index: number): Buffer {
  const n = Buffer.alloc(12)
  base.copy(n, 0)
  n.writeUInt32BE(index, 8)
  return n
}

interface ChunkHeader {
  key: Buffer
  base: Buffer
  chunk: number
  size: number
}

function chunkHeaderOf(keys: VaultKeys, head: Buffer): ChunkHeader {
  if (!keys.privateKey) throw new VaultLocked()
  const raw = head.subarray(4, 36)
  return { key: deriveFor(keys, raw, null), base: head.subarray(36, 44), chunk: head.readUInt32BE(44), size: Number(head.readBigUInt64BE(48)) }
}

function sealChunk(key: Buffer, base: Buffer, index: number, plain: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, chunkNonce(base, index))
  return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()])
}

function openChunk(h: ChunkHeader, index: number, data: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', h.key, chunkNonce(h.base, index))
  decipher.setAuthTag(data.subarray(data.length - TAG))
  return Buffer.concat([decipher.update(data.subarray(0, data.length - TAG)), decipher.final()])
}

function chunkHeader(keys: VaultKeys, size: number): { head: Buffer; key: Buffer; base: Buffer } {
  const { raw, key } = ephemeral(keys)
  const base = crypto.randomBytes(8)
  const head = Buffer.alloc(CHUNK_HEADER)
  CHUNK_MAGIC.copy(head, 0)
  raw.copy(head, 4)
  base.copy(head, 36)
  head.writeUInt32BE(CHUNK, 44)
  head.writeBigUInt64BE(BigInt(size), 48)
  return { head, key, base }
}

export function sealChunked(keys: VaultKeys, plain: Buffer): Buffer {
  const { head, key, base } = chunkHeader(keys, plain.length)
  const parts = [head]
  const count = Math.max(1, Math.ceil(plain.length / CHUNK))
  for (let i = 0; i < count; i++) parts.push(sealChunk(key, base, i, plain.subarray(i * CHUNK, (i + 1) * CHUNK)))
  return Buffer.concat(parts)
}

export function unseal(keys: VaultKeys, blob: Buffer): Buffer {
  if (blob.subarray(0, 4).equals(FILE_MAGIC)) return unsealWhole(keys, blob)
  const h = chunkHeaderOf(keys, blob.subarray(0, CHUNK_HEADER))
  const parts: Buffer[] = []
  let off = CHUNK_HEADER
  for (let i = 0; off < blob.length; i++) {
    const end = Math.min(blob.length, off + h.chunk + TAG)
    parts.push(openChunk(h, i, blob.subarray(off, end)))
    off = end
  }
  return Buffer.concat(parts)
}

interface Pending {
  complete: boolean
  bytes?: Buffer
  lines?: string[]
}

const PENDING_MAX = 50 * 1024 * 1024

export class SecureFs {
  private _keys: VaultKeys | null = null
  private pending = new Map<string, Pending>()

  get keys(): VaultKeys | null {
    return this._keys
  }

  set keys(value: VaultKeys | null) {
    this._keys = value
    this.pending.clear()
  }

  private get locked(): boolean {
    return !!this._keys && !this._keys.privateKey
  }

  private remember(file: string, entry: Pending): void {
    if (this.locked) this.pending.set(path.resolve(file), entry)
  }

  private pendingFor(file: string): Pending | undefined {
    return this.locked ? this.pending.get(path.resolve(file)) : undefined
  }

  forget(file: string): void {
    const abs = path.resolve(file)
    for (const key of [...this.pending.keys()]) if (key === abs || key.startsWith(abs + path.sep)) this.pending.delete(key)
  }

  constructor(
    readonly root: string,
    private plain: (rel: string) => boolean
  ) {}

  get enabled(): boolean {
    return this.keys !== null
  }

  get unlocked(): boolean {
    return !!this.keys?.privateKey
  }

  shouldSeal(file: string): boolean {
    if (!this.keys) return false
    const rel = path.relative(this.root, path.resolve(file))
    if (rel.startsWith('..') || path.isAbsolute(rel)) return false
    return !this.plain(rel.split(path.sep).join('/'))
  }

  private atomic(file: string, data: Buffer | string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 7)}.tmp`
    fs.writeFileSync(tmp, data)
    fs.renameSync(tmp, file)
  }

  decode(buf: Buffer): Buffer {
    if (!isSealed(buf)) return buf
    if (!this.keys?.privateKey) throw new VaultLocked()
    return unseal(this.keys, buf)
  }

  readBytes(file: string): Buffer {
    const p = this.pendingFor(file)
    if (p?.complete) return p.bytes ?? Buffer.from(p.lines!.map((l) => l + '\n').join(''), 'utf8')
    if (p) throw new VaultLocked()
    return this.decode(fs.readFileSync(file))
  }

  readText(file: string): string {
    return this.readBytes(file).toString('utf8')
  }

  writeText(file: string, text: string): void {
    const sealIt = this.shouldSeal(file)
    this.atomic(file, sealIt ? seal(this.keys!, Buffer.from(text, 'utf8')) : text)
    if (sealIt) this.remember(file, { complete: true, bytes: Buffer.from(text, 'utf8') })
  }

  writeBytes(file: string, data: Buffer): void {
    const sealIt = this.shouldSeal(file)
    this.atomic(file, sealIt ? sealChunked(this.keys!, data) : data)
    if (sealIt && data.length <= PENDING_MAX) this.remember(file, { complete: true, bytes: Buffer.from(data) })
  }

  copyIn(source: string, target: string): void {
    if (!this.shouldSeal(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(source, target)
      return
    }
    const size = fs.statSync(source).size
    const { head, key, base } = chunkHeader(this.keys!, size)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const tmp = `${target}.${process.pid}.tmp`
    const out = fs.openSync(tmp, 'w')
    const inp = fs.openSync(source, 'r')
    try {
      fs.writeSync(out, head)
      const buf = Buffer.alloc(CHUNK)
      const count = Math.max(1, Math.ceil(size / CHUNK))
      for (let i = 0; i < count; i++) {
        const n = fs.readSync(inp, buf, 0, CHUNK, i * CHUNK)
        fs.writeSync(out, sealChunk(key, base, i, buf.subarray(0, n)))
      }
    } finally {
      fs.closeSync(inp)
      fs.closeSync(out)
    }
    fs.renameSync(tmp, target)
    if (size <= PENDING_MAX) this.remember(target, { complete: true, bytes: fs.readFileSync(source) })
  }

  encodeLine(value: unknown): string {
    const json = JSON.stringify(value)
    return this.keys ? LINE_PREFIX + seal(this.keys, Buffer.from(json, 'utf8')).toString('base64') : json
  }

  decodeLine(line: string): unknown {
    if (!line.startsWith(LINE_PREFIX)) return JSON.parse(line)
    if (!this.keys?.privateKey) throw new VaultLocked()
    return JSON.parse(unseal(this.keys, Buffer.from(line.slice(1), 'base64')).toString('utf8'))
  }

  appendLine(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const sealIt = this.shouldSeal(file)
    if (sealIt && this.locked) {
      const existing = this.pendingFor(file) ?? { complete: !fs.existsSync(file), lines: [] }
      if (existing.bytes) existing.lines = existing.bytes.toString('utf8').split('\n').filter((l) => l.trim())
      existing.bytes = undefined
      existing.lines = [...(existing.lines ?? []), JSON.stringify(value)]
      this.remember(file, existing)
    }
    fs.appendFileSync(file, (sealIt ? this.encodeLine(value) : JSON.stringify(value)) + '\n', 'utf8')
  }

  readLines<T>(file: string): T[] {
    if (!fs.existsSync(file)) return []
    const p = this.pendingFor(file)
    if (p && !p.complete) throw new VaultLocked()
    const text = p ? (p.lines ? p.lines.join('\n') : p.bytes!.toString('utf8')) : fs.readFileSync(file, 'utf8')
    const out: T[] = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        out.push(this.decodeLine(line) as T)
      } catch (err) {
        if (isVaultLocked(err)) throw err
        continue
      }
    }
    return out
  }

  writeLines(file: string, values: unknown[]): void {
    const sealIt = this.shouldSeal(file)
    this.atomic(file, values.map((v) => (sealIt ? this.encodeLine(v) : JSON.stringify(v))).join('\n') + (values.length ? '\n' : ''))
    if (sealIt) this.remember(file, { complete: true, lines: values.map((v) => JSON.stringify(v)) })
  }

  size(file: string): number {
    const fd = fs.openSync(file, 'r')
    try {
      const head = Buffer.alloc(CHUNK_HEADER)
      const n = fs.readSync(fd, head, 0, CHUNK_HEADER, 0)
      if (n === CHUNK_HEADER && head.subarray(0, 4).equals(CHUNK_MAGIC)) return Number(head.readBigUInt64BE(48))
      if (n >= 4 && head.subarray(0, 4).equals(FILE_MAGIC)) return this.readBytes(file).length
      return fs.fstatSync(fd).size
    } finally {
      fs.closeSync(fd)
    }
  }

  readRange(file: string, start: number, end: number): Buffer {
    const fd = fs.openSync(file, 'r')
    try {
      const head = Buffer.alloc(CHUNK_HEADER)
      const n = fs.readSync(fd, head, 0, CHUNK_HEADER, 0)
      if (!(n === CHUNK_HEADER && head.subarray(0, 4).equals(CHUNK_MAGIC))) {
        const all = n >= 4 && head.subarray(0, 4).equals(FILE_MAGIC) ? this.readBytes(file) : fs.readFileSync(file)
        return all.subarray(start, end + 1)
      }
      if (!this.keys?.privateKey) throw new VaultLocked()
      const h = chunkHeaderOf(this.keys, head)
      const last = Math.min(end, h.size - 1)
      const parts: Buffer[] = []
      for (let i = Math.floor(start / h.chunk); i * h.chunk <= last; i++) {
        const buf = Buffer.alloc(h.chunk + TAG)
        const got = fs.readSync(fd, buf, 0, buf.length, CHUNK_HEADER + i * (h.chunk + TAG))
        const plain = openChunk(h, i, buf.subarray(0, got))
        const from = Math.max(0, start - i * h.chunk)
        const to = Math.min(plain.length, last - i * h.chunk + 1)
        parts.push(plain.subarray(from, to))
      }
      return Buffer.concat(parts)
    } finally {
      fs.closeSync(fd)
    }
  }
}

export const WINDOW_STATE_FILE = 'window-state.json'

export const PLAIN_FILES = new Set(['settings.json', 'vault.json', 'models.json', 'tools-prefs.json', 'tool-trust.json', 'context-prefs.json', 'vault-prefs.json', 'folders.json', 'reminder-times.json', 'toolsets.json', 'tool-settings.json', WINDOW_STATE_FILE])
export const PLAIN_DIRS = ['agents/', 'tools/', 'logs/', 'sandbox/', 'moduledata/python/env/']

export function isPlainRel(rel: string): boolean {
  return PLAIN_FILES.has(rel) || PLAIN_DIRS.some((d) => rel.startsWith(d))
}
