import { noteMainFailure } from '../problems'
import fs from 'node:fs'
import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { app, powerMonitor } from 'electron'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DeviceLevelId, NetworkClient, NetworkSettings, NetworkStatus, PairingInfo } from '@shared/types'
import { REMOTE_BYTES, remoteAllows } from '@shared/remote'
import { dataDir } from '../paths'
import { serveAssetBytes } from '../assets'
import { readJson, writeJson } from './store'
import { isVaultLocked } from '@shared/sealed'
import { onVaultUnlocked } from '../vault'
import { localAddresses, makeCertificate, type Certificate } from './certificate'
import { DeviceTrust, parseDeviceAuth } from './devices'
import { Pairing } from './pairing'
import { Uploads } from './uploads'
import { Announcer } from './announce'
import { PASSWORD_MIN, hashPassword, passwordMatches, passwordProblem, type PasswordHash } from './password'

interface Stored {
  on: boolean
  settings: NetworkSettings
  password: PasswordHash | null
  cert: Certificate | null
  announceId: string
}

const FILE = path.join(dataDir, 'network.json')
const DEFAULTS: NetworkSettings = { port: 8443, privateOnly: true, maxFailures: 5, lockMinutes: 15, maxRequestMb: 64, pingSeconds: 30, idleMinutes: 10, maxMessageMb: 8, maxClients: 8, bufferSoftMb: 4, bufferHardMb: 32, reconnectMinSeconds: 1, reconnectMaxSeconds: 30, pairCodeSeconds: 120, pairCodeUses: 1, maxUploadMb: 512, uploadKeepMinutes: 60, uploadFolder: '', announce: true, announceType: 'seven', announceName: '' }
const LOCKED = "Seven's vault is locked. Unlock Seven to change network access."
const ROUTES = new Set(['/v1/models', '/v1/chat/completions', '/v1/completions'])
const MIME: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', json: 'application/json', map: 'application/json', ico: 'image/x-icon', txt: 'text/plain', wasm: 'application/wasm' }

export function plain(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address
}

export function isPrivate(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  const lower = address.toLowerCase()
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
}

function send(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: { message, code: status } }))
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        resolve(null)
        req.destroy()
        return
      }
      parts.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(parts)))
    req.on('error', reject)
  })
}

function serviceType(v: unknown): string {
  const cleaned = String(typeof v === 'string' ? v : '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 15)
  return cleaned || DEFAULTS.announceType
}

function whole(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function clean(s: NetworkSettings): NetworkSettings {
  return {
    port: whole(s.port, 1, 65535, DEFAULTS.port),
    privateOnly: s.privateOnly !== false,
    maxFailures: whole(s.maxFailures, 1, 1000, DEFAULTS.maxFailures),
    lockMinutes: whole(s.lockMinutes, 0, 525600, DEFAULTS.lockMinutes),
    maxRequestMb: whole(s.maxRequestMb, 1, 4096, DEFAULTS.maxRequestMb),
    pingSeconds: whole(s.pingSeconds, 5, 3600, DEFAULTS.pingSeconds),
    idleMinutes: whole(s.idleMinutes, 0, 525600, DEFAULTS.idleMinutes),
    maxMessageMb: whole(s.maxMessageMb, 1, 256, DEFAULTS.maxMessageMb),
    maxClients: whole(s.maxClients, 1, 100, DEFAULTS.maxClients),
    bufferSoftMb: whole(s.bufferSoftMb, 1, 256, DEFAULTS.bufferSoftMb),
    bufferHardMb: whole(s.bufferHardMb, 1, 1024, DEFAULTS.bufferHardMb),
    reconnectMinSeconds: whole(s.reconnectMinSeconds, 1, 600, DEFAULTS.reconnectMinSeconds),
    reconnectMaxSeconds: whole(s.reconnectMaxSeconds, 1, 3600, DEFAULTS.reconnectMaxSeconds),
    pairCodeSeconds: whole(s.pairCodeSeconds, 10, 3600, DEFAULTS.pairCodeSeconds),
    pairCodeUses: whole(s.pairCodeUses, 1, 10, DEFAULTS.pairCodeUses),
    maxUploadMb: whole(s.maxUploadMb, 1, 65536, DEFAULTS.maxUploadMb),
    uploadKeepMinutes: whole(s.uploadKeepMinutes, 1, 525600, DEFAULTS.uploadKeepMinutes),
    uploadFolder: typeof s.uploadFolder === 'string' ? s.uploadFolder.trim() : DEFAULTS.uploadFolder,
    announce: s.announce !== false,
    announceType: serviceType(s.announceType),
    announceName: typeof s.announceName === 'string' ? s.announceName.trim().slice(0, 63) : DEFAULTS.announceName
  }
}

export class Gateway extends EventEmitter {
  private stored: Stored
  private server: https.Server | null = null
  private error: string | null = null
  private loadFailed = false
  private clients = new Map<string, NetworkClient>()
  private verified = new Set<string>()
  readonly devices = new DeviceTrust(() => this.stored.settings)
  readonly uploads = new Uploads(() => this.stored.settings)
  private announcer = new Announcer(
    () => this.stored.settings,
    () => this.stored.announceId
  )
  readonly pairing = new Pairing(
    () => this.stored.settings,
    () => {
      this.changed()
    }
  )
  private connectedDevices: () => ReadonlySet<string> = () => new Set()
  private disconnect: (deviceId: string | null) => void = () => {}

  attachBridge(hooks: { connected: () => ReadonlySet<string>; disconnect: (deviceId: string | null) => void }): void {
    this.connectedDevices = hooks.connected
    this.disconnect = hooks.disconnect
  }

  refresh(): NetworkStatus {
    return this.changed()
  }

  constructor(private routes: () => { port: number; secret: string } | null) {
    super()
    this.stored = this.load()
    onVaultUnlocked(() => {
      if (!this.loadFailed) return
      this.stored = this.load()
      if (this.loadFailed) return
      if (this.stored.on) void this.listen()
      this.changed()
    })
    powerMonitor.on('suspend', () => this.announcer.stop())
    powerMonitor.on('resume', () => {
      if (this.server?.listening) this.announcer.start()
    })
  }

  private load(): Stored {
    const fresh: Stored = { on: false, settings: { ...DEFAULTS }, password: null, cert: null, announceId: crypto.randomBytes(4).toString('hex') }
    let saved: Partial<Stored>
    try {
      saved = readJson<Partial<Stored>>(FILE, {})
    } catch (err) {
      this.loadFailed = true
      this.error = isVaultLocked(err) ? LOCKED : err instanceof Error ? err.message : String(err)
      return fresh
    }
    this.loadFailed = false
    this.error = null
    const stored: Stored = { on: saved.on === true, settings: { ...DEFAULTS, ...saved.settings }, password: saved.password ?? null, cert: saved.cert ?? null, announceId: saved.announceId ?? fresh.announceId }
    if (!saved.announceId) {
      try {
        writeJson(FILE, stored)
      } catch (err) {
        noteMainFailure(err, 'network', 'Could not save the network settings')
      }
    }
    return stored
  }

  start(): void {
    if (this.stored.on) void this.listen()
  }

  status(): NetworkStatus {
    const now = Date.now()
    return {
      on: this.stored.on,
      listening: this.server?.listening ?? false,
      announcing: this.announcer.announcing(),
      error: this.error ?? this.devices.error(),
      addresses: localAddresses(),
      hasPassword: this.stored.password !== null,
      passwordMin: PASSWORD_MIN,
      fingerprint: this.stored.cert?.fingerprint ?? null,
      settings: { ...this.stored.settings },
      devices: this.devices.list(this.connectedDevices()),
      pairing: { open: this.pairing.isOpen(), request: this.pairing.request() },
      clients: [...this.clients.values()].map((c) => ({ ...c, lockedUntil: c.lockedUntil > now ? c.lockedUntil : 0 })).sort((a, b) => b.lastAt - a.lastAt)
    }
  }

  settings(): NetworkSettings {
    return { ...this.stored.settings }
  }

  certificate(): string | null {
    return this.stored.cert?.cert ?? null
  }

  private save(): void {
    if (this.loadFailed) throw new Error(this.error ?? LOCKED)
    writeJson(FILE, this.stored)
  }

  private changed(): NetworkStatus {
    const status = this.status()
    this.emit('changed', status)
    return status
  }

  async set(on: boolean | undefined, settings: Partial<NetworkSettings> | undefined): Promise<NetworkStatus> {
    const prior = this.stored.settings
    const portChanged = settings?.port !== undefined && settings.port !== prior.port
    if (settings) this.stored.settings = clean({ ...prior, ...settings })
    if (on !== undefined) this.stored.on = on
    this.save()
    const next = this.stored.settings
    if (!this.stored.on) await this.close()
    else if (!this.server || portChanged) await this.listen()
    else if (this.server.listening && (prior.announce !== next.announce || prior.announceType !== next.announceType || prior.announceName !== next.announceName)) this.announcer.start()
    return this.changed()
  }

  async setPassword(password: string): Promise<NetworkStatus> {
    const problem = passwordProblem(password)
    if (problem) throw new Error(problem)
    this.stored.password = await hashPassword(password)
    this.verified.clear()
    this.save()
    return this.changed()
  }

  async renewCertificate(): Promise<NetworkStatus> {
    this.stored.cert = makeCertificate()
    this.save()
    if (this.server) await this.listen()
    return this.changed()
  }

  pairStart(): PairingInfo {
    if (!this.stored.cert) {
      this.stored.cert = makeCertificate()
      this.save()
    }
    const opened = this.pairing.open()
    return { ...opened, port: this.stored.settings.port, addresses: localAddresses(), fingerprint: this.stored.cert.fingerprint, id: this.stored.announceId }
  }

  pairCancel(): NetworkStatus {
    this.pairing.close()
    return this.status()
  }

  pairAllow(requestId: string): NetworkStatus {
    this.pairing.allow(requestId)
    return this.status()
  }

  pairDeny(requestId: string): NetworkStatus {
    this.pairing.deny(requestId)
    return this.status()
  }

  setDeviceLevel(deviceId: string, level: DeviceLevelId): NetworkStatus {
    this.devices.setLevel(deviceId, level)
    this.disconnect(deviceId)
    return this.changed()
  }

  revoke(deviceId: string): NetworkStatus {
    this.devices.revoke(deviceId)
    this.disconnect(deviceId)
    return this.changed()
  }

  async unpairAll(): Promise<NetworkStatus> {
    this.devices.clear()
    this.stored.cert = makeCertificate()
    this.stored.announceId = crypto.randomBytes(4).toString('hex')
    this.save()
    this.disconnect(null)
    if (this.server) await this.listen()
    return this.changed()
  }

  unlock(address: string): NetworkStatus {
    const client = this.clients.get(address)
    if (client) {
      client.lockedUntil = 0
      client.failures = 0
    }
    return this.changed()
  }

  async close(): Promise<void> {
    this.announcer.stop()
    const server = this.server
    this.server = null
    if (!server) return
    const closed = new Promise<void>((resolve) => server.close(() => resolve()))
    server.closeAllConnections()
    await closed
  }

  private async listen(): Promise<void> {
    await this.close()
    this.error = null
    if (!this.stored.cert) {
      this.stored.cert = makeCertificate()
      this.save()
    }
    this.uploads.cleanup()
    const server = https.createServer({ key: this.stored.cert.key, cert: this.stored.cert.cert }, (req, res) => {
      this.handle(req, res).catch((err) => {
        if (!res.headersSent) send(res, 500, err instanceof Error ? err.message : String(err))
        else res.end()
      })
    })
    server.on('error', (err) => {
      this.error = `Could not open port ${this.stored.settings.port}: ${err.message}`
      if (this.server === server) this.server = null
      this.changed()
    })
    server.on('listening', () => {
      this.announcer.start()
      this.changed()
    })
    this.server = server
    this.emit('server', server)
    server.listen(this.stored.settings.port, '0.0.0.0')
  }


  private punish(client: NetworkClient): void {
    client.failures++
    const { settings } = this.stored
    if (client.failures >= settings.maxFailures) {
      client.lockedUntil = Date.now() + settings.lockMinutes * 60_000
      client.failures = 0
    }
    this.changed()
  }

  private async pair(req: IncomingMessage, res: ServerResponse, client: NetworkClient): Promise<void> {
    if (req.method !== 'POST') return send(res, 405, 'Use POST.')
    const body = await readBody(req, this.stored.settings.maxMessageMb * 1024 * 1024)
    if (!body) return send(res, 413, 'The request is too large.')
    let parsed: { code?: unknown; name?: unknown }
    try {
      parsed = JSON.parse(body.toString('utf8')) as { code?: unknown; name?: unknown }
    } catch {
      return send(res, 400, 'The request is not valid JSON.')
    }
    const code = typeof parsed.code === 'string' ? parsed.code.trim() : ''
    const name = typeof parsed.name === 'string' ? parsed.name : ''
    if (!code) return send(res, 400, 'Send the pairing code.')
    if (!this.devices.ready()) return send(res, 503, this.devices.refusal())
    const claim = this.pairing.claim(code, name, client.address)
    if (!claim) {
      this.punish(client)
      return send(res, 403, 'That pairing code did not work.')
    }
    const outcome = await claim
    if (outcome !== 'allowed') return send(res, 403, outcome === 'denied' ? 'Seven denied this pairing.' : 'The pairing code expired.')
    const granted = await this.devices.create(name, client.address)
    this.changed()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ deviceId: granted.id, deviceKey: granted.key }))
  }

  private pairedDevice(req: IncomingMessage): Promise<boolean> {
    const auth = parseDeviceAuth(req)
    if (!auth) return Promise.resolve(false)
    return this.devices.verify(auth.id, auth.key, plain(req.socket.remoteAddress ?? ''))
  }

  private async serveUi(req: IncomingMessage, route: string, res: ServerResponse): Promise<void> {
    if (!(await this.pairedDevice(req))) return send(res, this.devices.ready() ? 403 : 503, this.devices.refusal())
    const root = path.join(app.getAppPath(), 'out', 'renderer')
    const asked = path.normalize(path.join(root, route === '/' ? 'index.html' : route.slice(1)))
    const inRoot = asked.startsWith(root)
    const file = inRoot && fs.existsSync(asked) && fs.statSync(asked).isFile() ? asked : path.join(root, 'index.html')
    if (!fs.existsSync(file)) return send(res, 404, 'Seven has no built page to serve.')
    const ext = path.extname(file).slice(1).toLowerCase()
    let data = fs.readFileSync(file)
    if (ext === 'html') {
      const s = this.stored.settings
      const meta = `<meta name="seven-reconnect-min" content="${s.reconnectMinSeconds}"><meta name="seven-reconnect-max" content="${s.reconnectMaxSeconds}">`
      data = Buffer.from(data.toString('utf8').replace('<head>', `<head>${meta}`), 'utf8')
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
    res.end(data)
  }

  private async bytes(req: IncomingMessage, res: ServerResponse, route: string, client: NetworkClient): Promise<void> {
    const auth = parseDeviceAuth(req)
    if (!auth || !(await this.devices.verify(auth.id, auth.key, client.address))) return send(res, this.devices.ready() ? 403 : 503, this.devices.refusal())
    const level = this.devices.levelOf(auth.id)
    if (!level) return send(res, 403, this.devices.refusal())
    const { settings } = this.stored
    if (route.startsWith('/assets/')) {
      if (!remoteAllows(level, REMOTE_BYTES.download)) return send(res, 403, 'Not allowed from this device.')
      if (req.method !== 'GET') return send(res, 405, 'Use GET.')
      let parts: string[]
      try {
        parts = route.slice('/assets/'.length).split('/').map((p) => decodeURIComponent(p))
      } catch {
        return send(res, 404, 'Not found.')
      }
      const name = parts.length > 1 ? parts.slice(1).join('/') : null
      return serveAssetBytes(res, parts[0] ?? '', name, req.headers.range ?? null)
    }
    if (!remoteAllows(level, REMOTE_BYTES.upload)) return send(res, 403, 'Not allowed from this device.')
    if (route === '/files') {
      if (req.method !== 'POST') return send(res, 405, 'Use POST.')
      const body = await readBody(req, settings.maxMessageMb * 1024 * 1024)
      if (!body) return send(res, 413, 'The request is too large.')
      let parsed: { name?: unknown; size?: unknown }
      try {
        parsed = JSON.parse(body.toString('utf8')) as { name?: unknown; size?: unknown }
      } catch {
        return send(res, 400, 'The request is not valid JSON.')
      }
      const name = typeof parsed.name === 'string' ? parsed.name : ''
      if (!name) return send(res, 400, 'Send the file name.')
      try {
        const opened = this.uploads.create(name, Number(parsed.size))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(opened))
      } catch (err) {
        send(res, 400, err instanceof Error ? err.message : String(err))
      }
      return
    }
    if (req.method !== 'PUT') return send(res, 405, 'Use PUT.')
    const offset = Number(req.headers['x-seven-offset'] ?? '')
    if (!Number.isInteger(offset) || offset < 0) return send(res, 400, 'Send the x-seven-offset header.')
    const body = await readBody(req, settings.maxMessageMb * 1024 * 1024)
    if (!body) return send(res, 413, `Each part can be up to ${settings.maxMessageMb} MB.`)
    try {
      const result = this.uploads.append(route.slice('/files/'.length), offset, body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err) {
      send(res, 400, err instanceof Error ? err.message : String(err))
    }
  }

  private client(address: string): NetworkClient {
    let client = this.clients.get(address)
    if (!client) {
      client = { address, lastAt: Date.now(), requests: 0, failures: 0, lockedUntil: 0, model: null }
      this.clients.set(address, client)
    }
    return client
  }

  private async allowed(key: string): Promise<boolean> {
    const stored = this.stored.password
    if (!stored) return false
    const digest = crypto.createHash('sha256').update(key).digest('hex')
    if (this.verified.has(digest)) return true
    const ok = await passwordMatches(key, stored)
    if (ok) this.verified.add(digest)
    return ok
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const address = plain(req.socket.remoteAddress ?? '')
    const client = this.client(address)
    client.lastAt = Date.now()
    const { settings } = this.stored
    if (settings.privateOnly && !isPrivate(address)) return send(res, 403, 'Only devices on your local network can connect.')
    if (client.lockedUntil > Date.now()) return send(res, 429, 'Too many wrong passwords from this device. Unlock it in Seven, or wait.')
    const route = new URL(req.url ?? '/', 'https://seven').pathname
    if (route === '/pair') return this.pair(req, res, client)
    if (route === '/files' || route.startsWith('/files/') || route.startsWith('/assets/')) return this.bytes(req, res, route, client)
    if (!route.startsWith('/v1/')) return this.serveUi(req, route, res)
    if (!this.stored.password) return send(res, 403, "Seven's model API is off. Set a password in Seven's Network panel to turn it on.")
    const header = req.headers.authorization ?? ''
    const key = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!key || !(await this.allowed(key))) {
      this.punish(client)
      return send(res, 401, 'Wrong password.')
    }
    client.failures = 0
    if (!ROUTES.has(route)) return send(res, 404, 'Not found.')
    client.requests++
    this.changed()
    const target = this.routes()
    if (!target) return send(res, 503, 'Seven is starting. Try again in a moment.')
    let body: Buffer | null = null
    if (route !== '/v1/models') {
      if (req.method !== 'POST') return send(res, 405, 'Use POST.')
      body = await readBody(req, settings.maxRequestMb * 1024 * 1024)
      if (!body) return send(res, 413, `The request is larger than ${settings.maxRequestMb} MB.`)
    }
    const abort = new AbortController()
    res.on('close', () => abort.abort())
    let upstream: Response
    try {
      upstream = await fetch(`http://127.0.0.1:${target.port}${route}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-seven-secret': target.secret },
        ...(body ? { body: new Uint8Array(body) } : {}),
        signal: abort.signal
      })
    } catch {
      return send(res, 502, 'Seven could not reach its engine. Try again in a moment.')
    }
    const model = upstream.headers.get('x-seven-model')
    if (model) {
      client.model = model
      this.changed()
    }
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-cache' })
    if (upstream.body) for await (const chunk of upstream.body) res.write(chunk)
    res.end()
  }
}
