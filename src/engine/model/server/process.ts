import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import type { ServerTimings } from '@shared/types'
import { removePath } from '../../util/fs'
import { childEnded, childStarted } from './children'

export const LOG_LINES = 200
const POLL_MS = 250

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => (port ? resolve(port) : reject(new Error('No free port for llama-server'))))
    })
  })
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('Loading was cancelled'))
    }, { once: true })
  })
}

export interface ServerOptions {
  exe: string
  modelPath: string
  args: string[]
  signal: AbortSignal
  onExit: (message: string) => void
}

export class LlamaServer {
  contextSize = 0
  trainContextSize: number | null = null
  device: string | null = null
  offload: { gpu: number; total: number } | null = null
  timings: ServerTimings | null = null
  readonly startedAt = Date.now()
  private tail: string[] = []
  private stopping = false
  private exited: Promise<void>

  private constructor(
    private child: ChildProcess,
    readonly port: number,
    readonly args: string[],
    readonly key: string,
    readonly slotDir: string
  ) {
    this.exited = new Promise((resolve) => child.once('exit', () => resolve()))
    const keep = (data: Buffer) => {
      for (const line of data.toString().replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/)) {
        if (!line.trim()) continue
        const offload = line.match(/offloaded (\d+)\/(\d+) layers to GPU/i)
        if (offload) this.offload = { gpu: Number(offload[1]), total: Number(offload[2]) }
        const device = line.match(/using device (\S+) \(([^)]+)\)/i)
        if (device && !this.device) this.device = `${device[1]} (${device[2]})`
        this.tail.push(line)
        if (this.tail.length > LOG_LINES) this.tail.shift()
      }
    }
    child.stdout?.on('data', keep)
    child.stderr?.on('data', keep)
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}/v1`
  }

  private get root(): string {
    return `http://127.0.0.1:${this.port}`
  }

  lastLines(): string {
    return this.tail.join('\n')
  }

  get pid(): number | null {
    return this.child.pid ?? null
  }

  log(): string[] {
    return [...this.tail]
  }

  async processing(): Promise<boolean> {
    const slots = await this.get<{ is_processing?: boolean }[]>('/slots')
    return Array.isArray(slots) && slots.some((s) => s.is_processing === true)
  }

  static async start(o: ServerOptions): Promise<LlamaServer> {
    const port = await freePort()
    const key = crypto.randomBytes(24).toString('hex')
    const slotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-slots-'))
    const args = ['-m', o.modelPath, '--host', '127.0.0.1', '--port', String(port), '--slot-save-path', slotDir, ...o.args]
    const server = await new Promise<LlamaServer>((resolve, reject) => {
      const child = spawn(o.exe, args, { cwd: path.dirname(o.exe), env: { ...process.env, LLAMA_API_KEY: key }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
      child.once('error', (err) => {
        removePath(slotDir)
        reject(new Error(`llama-server could not start: ${err.message}`))
      })
      child.once('spawn', () => {
        if (child.pid) {
          const pid = child.pid
          childStarted(pid)
          child.once('exit', () => childEnded(pid))
        }
        resolve(new LlamaServer(child, port, o.args, key, slotDir))
      })
    })
    server.child.once('exit', (code) => {
      if (server.stopping) return
      removePath(server.slotDir)
      o.onExit(`llama-server stopped (exit code ${code ?? 'unknown'}).${server.tail.length ? `\n${server.lastLines()}` : ''}`)
    })
    await server.ready(o.signal)
    return server
  }

  private async ready(signal: AbortSignal): Promise<void> {
    for (;;) {
      if (this.child.exitCode !== null) throw new Error(`llama-server stopped while loading the model (exit code ${this.child.exitCode}).${this.tail.length ? `\n${this.lastLines()}` : ''}`)
      try {
        const res = await fetch(`${this.root}/health`, { signal })
        if (res.ok) break
      } catch (err) {
        if (signal.aborted) {
          await this.stop()
          throw new Error('Loading was cancelled')
        }
        void err
      }
      try {
        await wait(POLL_MS, signal)
      } catch (err) {
        await this.stop()
        throw err
      }
    }
    await this.readFacts()
  }

  private async get<T>(route: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.root}${route}`, { headers: { Authorization: `Bearer ${this.key}` } })
      return res.ok ? ((await res.json()) as T) : null
    } catch {
      return null
    }
  }

  private async readFacts(): Promise<void> {
    const props = await this.get<{ default_generation_settings?: { n_ctx?: number } }>('/props')
    const models = await this.get<{ data?: { meta?: { n_ctx_train?: number } }[] }>('/v1/models')
    this.contextSize = props?.default_generation_settings?.n_ctx ?? 0
    this.trainContextSize = models?.data?.[0]?.meta?.n_ctx_train ?? null
  }

  async erase(): Promise<void> {
    await fetch(`${this.root}/slots/0?action=erase`, { method: 'POST', headers: { Authorization: `Bearer ${this.key}` } }).catch(() => undefined)
  }

  async slot(action: 'save' | 'restore', filename: string): Promise<void> {
    const res = await fetch(`${this.root}/slots/0?action=${action}`, { method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ filename }) })
    if (!res.ok) throw new Error(`llama-server could not ${action} the chat state: ${(await res.text().catch(() => '')) || res.status}`)
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill()
    await this.exited
    removePath(this.slotDir)
  }
}
