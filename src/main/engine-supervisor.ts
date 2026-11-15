import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { app, utilityProcess, type UtilityProcess } from 'electron'
import enginePath from '../engine/index?modulePath'
import {
  LONG_REQUESTS,
  type EngineParams,
  type EngineRequestName,
  type EngineResult,
  type EngineWireMessage,
  type EventMessage
} from '@shared/protocol'
import type { EngineState, EngineStatus } from '@shared/types'
import type { ProblemReport } from '@shared/problems'
import { dataDir } from './paths'

const REQUEST_TIMEOUT_MS = 30000
const MAX_BACKOFF_MS = 5000

function endServers(pids: number[]): void {
  if (process.platform !== 'win32') return
  for (const pid of pids) {
    execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (err, stdout) => {
      if (!err && stdout.toLowerCase().includes('"llama-server.exe"')) execFile('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true }, () => undefined)
    })
  }
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout | null
}

export class EngineSupervisor extends EventEmitter {
  private child: UtilityProcess | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private restarts = 0
  private stopping = false
  private state: EngineState = 'starting'
  private servers: number[] = []
  private routes: { port: number; secret: string } | null = null
  private tail: string[] = []

  constructor(private tailLines: () => number) {
    super()
  }

  status(): EngineStatus {
    return { state: this.state, restarts: this.restarts }
  }

  modelRoutes(): { port: number; secret: string } | null {
    return this.routes
  }

  private setState(state: EngineState): void {
    this.state = state
    const message: EventMessage = { event: 'engine.status', payload: this.status() }
    this.emit('event', message)
  }

  start(): void {
    this.stopping = false
    this.setState('starting')

    const child = utilityProcess.fork(enginePath, [], {
      serviceName: 'seven-engine',
      stdio: 'pipe',
      env: { ...process.env, SEVEN_HOME: dataDir, SEVEN_DEV: app.isPackaged ? '0' : '1', SEVEN_RESOURCES: app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'resources') : path.join(app.getAppPath(), 'resources'), SEVEN_APP: app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(), SEVEN_MACHINE: app.getPath('userData') }
    })
    this.child = child
    this.tail = []
    child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk))
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk)
      this.keepTail(chunk.toString('utf8'))
    })

    child.on('spawn', () => this.setState('ready'))

    child.on('message', (message: EngineWireMessage) => {
      if ('id' in message) {
        const entry = this.pending.get(message.id)
        if (!entry) return
        if (entry.timer) clearTimeout(entry.timer)
        this.pending.delete(message.id)
        if (message.ok) entry.resolve(message.result)
        else entry.reject(Object.assign(new Error(message.error), message.code ? { code: message.code } : {}))
        return
      }
      if (message.event === 'engine.restart') {
        void this.restart()
        return
      }
      if (message.event === 'engine.children') {
        this.servers = (message.payload as { pids: number[] }).pids
        return
      }
      if (message.event === 'engine.problem') {
        this.emit('problem', message.payload as ProblemReport)
        return
      }
      if (message.event === 'engine.modelRoutes') {
        this.routes = message.payload as { port: number; secret: string }
        return
      }
      this.emit('event', message)
    })

    child.on('exit', (code) => {
      endServers(this.servers)
      this.servers = []
      this.routes = null
      if (this.child !== child) return
      this.child = null
      this.rejectAll(new Error(`Engine exited with code ${code}`))
      if (this.stopping) return
      this.restarts += 1
      const problem: ProblemReport = { severity: 'error', area: 'engine', message: `The engine stopped unexpectedly (exit code ${code}). Restarting it now.`, ...(this.tail.length ? { detail: this.tail.join('\n') } : {}) }
      this.emit('problem', problem)
      this.setState('crashed')
      const delay = Math.min(250 * 2 ** (this.restarts - 1), MAX_BACKOFF_MS)
      setTimeout(() => {
        if (!this.stopping && !this.child) this.start()
      }, delay)
    })
  }

  private keepTail(text: string): void {
    const max = this.tailLines()
    if (max <= 0) {
      this.tail = []
      return
    }
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    this.tail = [...this.tail, ...lines].slice(-max)
  }

  request<K extends EngineRequestName>(name: K, params: EngineParams<K>): Promise<EngineResult<K>> {
    return new Promise((resolve, reject) => {
      if (!this.child || this.state !== 'ready') {
        reject(new Error('Engine is not running'))
        return
      }
      const id = this.nextId++
      const timer = LONG_REQUESTS.has(name)
        ? null
        : setTimeout(() => {
            this.pending.delete(id)
            reject(new Error(`Engine request timed out: ${name}`))
          }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      this.child.postMessage({ id, name, params })
    })
  }

  private rejectAll(error: Error): void {
    for (const entry of this.pending.values()) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.reject(error)
    }
    this.pending.clear()
  }

  private async restart(): Promise<void> {
    const child = this.child
    if (!child) return
    this.stopping = true
    this.child = null
    this.rejectAll(new Error('Engine restarting'))
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
      child.kill()
      setTimeout(resolve, 5000)
    })
    this.start()
  }

  stop(): void {
    this.stopping = true
    endServers(this.servers)
    this.routes = null
    this.rejectAll(new Error('Engine stopped'))
    this.child?.kill()
    this.child = null
  }
}
