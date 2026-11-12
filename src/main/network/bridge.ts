import type { Server } from 'node:https'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { ERROR_MARKER, type BridgeClientMessage, type BridgeServerMessage, type EventMessage, type EventName } from '@shared/protocol'
import { REMOTE_DENIED } from '@shared/errors'
import { REMOTE_ENGINE, REMOTE_EVENTS, REMOTE_MAIN, REMOTE_PATHS, remoteAllows } from '@shared/remote'
import type { DeviceLevelId } from '@shared/types'
import { coded, type MainDispatch } from '../ipc'
import type { NetworkSettings } from '@shared/types'
import { isPrivate, plain } from './gateway'
import { parseDeviceAuth, type DeviceTrust } from './devices'
import type { Uploads } from './uploads'

interface Connection {
  socket: WebSocket
  deviceId: string
  level: DeviceLevelId
  subscribed: Set<EventName>
  latest: Map<EventName, EventMessage>
  lastSeen: number
  alive: boolean
}

function refuse(socket: Duplex, status: number, reason: string): void {
  try {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`)
  } catch {
    socket.destroy()
    return
  }
  socket.destroy()
}

export class Bridge {
  private wss: WebSocketServer | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private connections = new Set<Connection>()

  constructor(
    private settings: () => NetworkSettings,
    private devices: DeviceTrust,
    private uploads: Uploads,
    private engineRequest: (name: string, params: unknown) => Promise<unknown>,
    private main: MainDispatch,
    private changed: () => void
  ) {}

  connectedDevices(): ReadonlySet<string> {
    return new Set([...this.connections].map((conn) => conn.deviceId))
  }

  disconnectDevice(deviceId: string | null): void {
    for (const conn of this.connections) {
      if (deviceId === null || conn.deviceId === deviceId) conn.socket.terminate()
    }
  }

  attach(server: Server): void {
    this.detach()
    const wss = new WebSocketServer({ noServer: true, maxPayload: this.settings().maxMessageMb * 1024 * 1024, handleProtocols: (protocols) => protocols.values().next().value ?? false })
    this.wss = wss
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      void (async () => {
        if (new URL(req.url ?? '/', 'https://seven').pathname !== '/bridge') return refuse(socket, 404, 'Not Found')
        const address = plain(req.socket.remoteAddress ?? '')
        if (this.settings().privateOnly && !isPrivate(address)) return refuse(socket, 403, 'Forbidden')
        const auth = parseDeviceAuth(req)
        if (!auth || !(await this.devices.verify(auth.id, auth.key, address))) return refuse(socket, 403, 'Forbidden')
        if (this.connections.size >= this.settings().maxClients) return refuse(socket, 503, 'Service Unavailable')
        wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, auth.id))
      })().catch(() => refuse(socket, 500, 'Internal Server Error'))
    })
    this.timer = setInterval(() => this.sweep(), this.settings().pingSeconds * 1000)
  }

  detach(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const conn of this.connections) conn.socket.terminate()
    this.connections.clear()
    this.wss?.close()
    this.wss = null
  }

  private accept(socket: WebSocket, deviceId: string): void {
    const level = this.devices.levelOf(deviceId)
    if (!level) {
      socket.terminate()
      return
    }
    const conn: Connection = { socket, deviceId, level, subscribed: new Set(), latest: new Map(), lastSeen: Date.now(), alive: true }
    this.connections.add(conn)
    this.changed()
    this.send(conn, { hello: { level } })
    socket.on('pong', () => {
      conn.alive = true
      conn.lastSeen = Date.now()
    })
    socket.on('message', (data) => {
      conn.lastSeen = Date.now()
      this.receive(conn, String(data))
    })
    socket.on('close', () => {
      this.connections.delete(conn)
      this.devices.seen(conn.deviceId)
      this.changed()
    })
    socket.on('error', () => socket.terminate())
  }

  private send(conn: Connection, message: BridgeServerMessage): void {
    conn.socket.send(JSON.stringify(message))
  }

  private receive(conn: Connection, raw: string): void {
    let message: BridgeClientMessage
    try {
      message = JSON.parse(raw) as BridgeClientMessage
    } catch {
      conn.socket.terminate()
      return
    }
    if (message.id === undefined) {
      for (const event of message.subscribe ?? []) conn.subscribed.add(event)
      for (const event of message.unsubscribe ?? []) {
        conn.subscribed.delete(event)
        conn.latest.delete(event)
      }
      return
    }
    const { id, kind, name, params } = message
    const settle = (work: Promise<unknown>): void => {
      work
        .then((result) => this.send(conn, { id, result }))
        .catch((err: unknown) => {
          try {
            this.send(conn, { id, result: coded(err) })
          } catch {
            this.send(conn, { id, error: err instanceof Error ? err.message : String(err) })
          }
        })
    }
    const allowed = kind === 'engine' ? remoteAllows(conn.level, REMOTE_ENGINE[name]) : remoteAllows(conn.level, REMOTE_MAIN[name])
    if (!allowed) {
      this.send(conn, { id, result: { [ERROR_MARKER]: { code: REMOTE_DENIED, message: 'Not allowed from this device.' } } })
      return
    }
    if (kind !== 'engine') {
      settle(this.main.call(name, params))
      return
    }
    const paths = REMOTE_PATHS[name]?.(params as never)
    if (!paths?.length) {
      settle(this.engineRequest(name, params))
      return
    }
    if (!paths.every((p) => this.uploads.within(p))) {
      this.send(conn, { id, result: { [ERROR_MARKER]: { code: REMOTE_DENIED, message: 'Only files sent from this device can be used.' } } })
      return
    }
    settle(
      this.engineRequest(name, params).then((result) => {
        this.uploads.consume(paths)
        return result
      })
    )
  }

  feed(message: EventMessage): void {
    const soft = this.settings().bufferSoftMb * 1024 * 1024
    const hard = this.settings().bufferHardMb * 1024 * 1024
    for (const conn of this.connections) {
      if (!conn.subscribed.has(message.event)) continue
      if (!remoteAllows(conn.level, REMOTE_EVENTS[message.event])) continue
      const buffered = conn.socket.bufferedAmount
      if (buffered > hard) {
        conn.socket.terminate()
        continue
      }
      if (buffered > soft) {
        conn.latest.set(message.event, message)
        continue
      }
      this.flush(conn)
      this.send(conn, message)
    }
  }

  private flush(conn: Connection): void {
    if (!conn.latest.size) return
    const queued = [...conn.latest.values()]
    conn.latest.clear()
    for (const message of queued) this.send(conn, message)
  }

  private sweep(): void {
    const idleMs = this.settings().idleMinutes * 60_000
    const soft = this.settings().bufferSoftMb * 1024 * 1024
    const now = Date.now()
    for (const conn of this.connections) {
      if (!conn.alive || (idleMs > 0 && now - conn.lastSeen > idleMs)) {
        conn.socket.terminate()
        continue
      }
      conn.alive = false
      conn.socket.ping()
      if (conn.socket.bufferedAmount <= soft) this.flush(conn)
    }
  }
}
