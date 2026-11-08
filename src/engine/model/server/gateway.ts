import https from 'node:https'
import net from 'node:net'
import path from 'node:path'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { MODEL_KINDS, type ModelEntry, type NetworkClient, type NetworkSettings, type NetworkStatus } from '@shared/types'
import { readJson, writeJson } from '../../util/fs'
import { dataRoot } from '../../util/paths'
import { localAddresses, makeCertificate, type Certificate } from './certificate'
import { PASSWORD_MIN, hashPassword, passwordMatches, passwordProblem, type PasswordHash } from './password'
import type { ModelHost } from '../host'
import type { ModelRegistry } from '../registry'

interface Stored {
  on: boolean
  settings: NetworkSettings
  password: PasswordHash | null
  cert: Certificate | null
}

const FILE = path.join(dataRoot, 'network.json')
const DEFAULTS: NetworkSettings = { port: 8443, privateOnly: true, maxFailures: 5, lockMinutes: 15, maxRequestMb: 64 }
const ROUTES = new Set(['/v1/models', '/v1/chat/completions', '/v1/completions'])

function plain(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address
}

function isPrivate(address: string): boolean {
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
    maxRequestMb: whole(s.maxRequestMb, 1, 4096, DEFAULTS.maxRequestMb)
  }
}

export class Gateway extends EventEmitter {
  private stored: Stored
  private server: https.Server | null = null
  private error: string | null = null
  private clients = new Map<string, NetworkClient>()
  private verified = new Set<string>()
  private inflight = 0

  constructor(
    private host: ModelHost,
    private models: ModelRegistry,
    private seven: { busy: () => boolean }
  ) {
    super()
    this.stored = { on: false, settings: { ...DEFAULTS }, password: null, cert: null }
    try {
      const saved = readJson<Partial<Stored>>(FILE, {})
      this.stored = { on: saved.on === true, settings: { ...DEFAULTS, ...saved.settings }, password: saved.password ?? null, cert: saved.cert ?? null }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err)
    }
  }

  start(): void {
    if (this.stored.on) void this.listen()
  }

  status(): NetworkStatus {
    const now = Date.now()
    return {
      on: this.stored.on,
      listening: this.server?.listening ?? false,
      error: this.error,
      addresses: localAddresses(),
      hasPassword: this.stored.password !== null,
      passwordMin: PASSWORD_MIN,
      fingerprint: this.stored.cert?.fingerprint ?? null,
      settings: { ...this.stored.settings },
      clients: [...this.clients.values()].map((c) => ({ ...c, lockedUntil: c.lockedUntil > now ? c.lockedUntil : 0 })).sort((a, b) => b.lastAt - a.lastAt)
    }
  }

  certificate(): string | null {
    return this.stored.cert?.cert ?? null
  }

  private save(): void {
    writeJson(FILE, this.stored)
  }

  private changed(): NetworkStatus {
    const status = this.status()
    this.emit('changed', status)
    return status
  }

  async set(on: boolean | undefined, settings: Partial<NetworkSettings> | undefined): Promise<NetworkStatus> {
    const portChanged = settings?.port !== undefined && settings.port !== this.stored.settings.port
    if (settings) this.stored.settings = clean({ ...this.stored.settings, ...settings })
    if (on !== undefined) this.stored.on = on
    this.save()
    if (!this.stored.on) await this.close()
    else if (!this.server || portChanged) await this.listen()
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

  unlock(address: string): NetworkStatus {
    const client = this.clients.get(address)
    if (client) {
      client.lockedUntil = 0
      client.failures = 0
    }
    return this.changed()
  }

  async close(): Promise<void> {
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
    if (!this.stored.password) {
      this.error = 'Set a password first.'
      this.changed()
      return
    }
    if (!this.stored.cert) {
      this.stored.cert = makeCertificate()
      this.save()
    }
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
    server.on('listening', () => this.changed())
    this.server = server
    server.listen(this.stored.settings.port, '0.0.0.0')
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

  private servable(): ModelEntry[] {
    return this.models.list().filter((m) => !this.models.isRemote(m.id) && m.info && MODEL_KINDS[m.info.kind].chats)
  }

  private async busy(): Promise<boolean> {
    return this.seven.busy() || this.inflight > 0 || (await this.host.processing())
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const address = plain(req.socket.remoteAddress ?? '')
    const client = this.client(address)
    client.lastAt = Date.now()
    const { settings } = this.stored
    if (settings.privateOnly && !isPrivate(address)) return send(res, 403, 'Only devices on your local network can connect.')
    if (client.lockedUntil > Date.now()) return send(res, 429, 'Too many wrong passwords from this device. Unlock it in Seven, or wait.')
    const header = req.headers.authorization ?? ''
    const key = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!key || !(await this.allowed(key))) {
      client.failures++
      if (client.failures >= settings.maxFailures) {
        client.lockedUntil = Date.now() + settings.lockMinutes * 60_000
        client.failures = 0
      }
      this.changed()
      return send(res, 401, 'Wrong password.')
    }
    client.failures = 0
    const route = new URL(req.url ?? '/', 'https://seven').pathname
    if (!ROUTES.has(route)) return send(res, 404, 'Not found.')
    client.requests++
    this.changed()
    if (route === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ object: 'list', data: this.servable().map((m) => ({ id: m.name, object: 'model', owned_by: 'seven' })) }))
      return
    }
    if (req.method !== 'POST') return send(res, 405, 'Use POST.')
    const raw = await readBody(req, settings.maxRequestMb * 1024 * 1024)
    if (!raw) return send(res, 413, `The request is larger than ${settings.maxRequestMb} MB.`)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>
    } catch {
      return send(res, 400, 'The request is not valid JSON.')
    }
    const asked = typeof body.model === 'string' ? body.model : ''
    const list = this.servable()
    const entry = list.find((m) => m.name === asked) ?? list.find((m) => m.id === asked) ?? (this.host.loadedId ? list.find((m) => m.id === this.host.loadedId) : undefined)
    if (!entry) return send(res, 404, asked ? `No model called ${asked}.` : 'Say which model to use.')
    if (this.host.loadedId !== entry.id) {
      if (await this.busy()) return send(res, 503, 'Seven is busy writing with another model. Try again when it is idle.')
      this.models.assertRunnable(entry.id)
      await this.host.load(entry, this.models.getConfig(entry.id))
    }
    client.model = entry.name
    const target = this.host.serverTarget()
    const abort = new AbortController()
    res.on('close', () => abort.abort())
    this.inflight++
    this.changed()
    try {
      const upstream = await fetch(`${String(target.spec.baseUrl).replace(/\/v1$/, '')}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.key}` },
        body: JSON.stringify({ ...body, model: entry.name }),
        signal: abort.signal
      })
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-cache' })
      if (upstream.body) for await (const chunk of upstream.body) res.write(chunk)
      res.end()
    } finally {
      this.inflight--
      this.changed()
    }
  }
}
