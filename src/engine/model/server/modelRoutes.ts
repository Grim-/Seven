import http from 'node:http'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { MODEL_KINDS, type ModelEntry } from '@shared/types'
import type { ModelHost } from '../host'
import type { ModelRegistry } from '../registry'

const ROUTES = new Set(['/v1/models', '/v1/chat/completions', '/v1/completions'])

export interface ModelRoutesInfo {
  port: number
  secret: string
}

function send(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: { message, code: status } }))
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = []
    req.on('data', (chunk: Buffer) => parts.push(chunk))
    req.on('end', () => resolve(Buffer.concat(parts)))
    req.on('error', reject)
  })
}

export class ModelRoutes extends EventEmitter {
  private server: http.Server | null = null
  private readonly secret = crypto.randomBytes(32).toString('base64url')
  private inflight = 0

  constructor(
    private host: ModelHost,
    private models: ModelRegistry,
    private seven: { busy: () => boolean }
  ) {
    super()
  }

  start(): void {
    const server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        if (!res.headersSent) send(res, 500, err instanceof Error ? err.message : String(err))
        else res.end()
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') this.emit('ready', { port: address.port, secret: this.secret } satisfies ModelRoutesInfo)
    })
    this.server = server
  }

  async close(): Promise<void> {
    const server = this.server
    this.server = null
    if (!server) return
    const closed = new Promise<void>((resolve) => server.close(() => resolve()))
    server.closeAllConnections()
    await closed
  }

  private allowed(req: IncomingMessage): boolean {
    const got = req.headers['x-seven-secret']
    if (typeof got !== 'string') return false
    const a = crypto.createHash('sha256').update(got).digest()
    const b = crypto.createHash('sha256').update(this.secret).digest()
    return crypto.timingSafeEqual(a, b)
  }

  private servable(): ModelEntry[] {
    return this.models.list().filter((m) => !this.models.isRemote(m.id) && m.info && MODEL_KINDS[m.info.kind].chats)
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.allowed(req)) return send(res, 403, 'Not allowed.')
    const route = new URL(req.url ?? '/', 'http://seven').pathname
    if (!ROUTES.has(route)) return send(res, 404, 'Not found.')
    if (route === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ object: 'list', data: this.servable().map((m) => ({ id: m.name, object: 'model', owned_by: 'seven' })) }))
      return
    }
    if (req.method !== 'POST') return send(res, 405, 'Use POST.')
    const raw = await readBody(req)
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
    this.inflight++
    try {
      if (this.host.loadedId !== entry.id) {
        if (this.seven.busy() || this.inflight > 1 || (await this.host.processing())) return send(res, 503, 'Seven is busy writing with another model. Try again when it is idle.')
        this.models.assertRunnable(entry.id)
        await this.host.load(entry, this.models.getConfig(entry.id))
      }
      if (this.host.loadedId !== entry.id) return send(res, 503, 'Seven switched to another model. Try again.')
      const target = this.host.serverTarget()
      const abort = new AbortController()
      res.on('close', () => abort.abort())
      const upstream = await fetch(`${String(target.spec.baseUrl).replace(/\/v1$/, '')}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.key}` },
        body: JSON.stringify({ ...body, model: entry.name }),
        signal: abort.signal
      })
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-cache', 'x-seven-model': entry.name })
      if (upstream.body) for await (const chunk of upstream.body) res.write(chunk)
      res.end()
    } finally {
      this.inflight--
    }
  }
}
