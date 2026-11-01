import { EventEmitter } from 'node:events'
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
import { dataDir } from './paths'

const REQUEST_TIMEOUT_MS = 30000
const MAX_BACKOFF_MS = 5000

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

  status(): EngineStatus {
    return { state: this.state, restarts: this.restarts }
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
      stdio: 'inherit',
      env: { ...process.env, SEVEN_HOME: dataDir, SEVEN_DEV: app.isPackaged ? '0' : '1', SEVEN_RESOURCES: app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked', 'resources') : path.join(app.getAppPath(), 'resources') }
    })
    this.child = child

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
      this.emit('event', message)
    })

    child.on('exit', (code) => {
      if (this.child !== child) return
      this.child = null
      this.rejectAll(new Error(`Engine exited with code ${code}`))
      if (this.stopping) return
      this.restarts += 1
      this.setState('crashed')
      const delay = Math.min(250 * 2 ** (this.restarts - 1), MAX_BACKOFF_MS)
      setTimeout(() => {
        if (!this.stopping && !this.child) this.start()
      }, delay)
    })
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
    this.rejectAll(new Error('Engine stopped'))
    this.child?.kill()
    this.child = null
  }
}
