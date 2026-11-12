import type { BridgeClientMessage, BridgeServerMessage, EngineRequestName, EventName, Events, MainRequestName } from '@shared/protocol'
import { REMOTE_ENGINE, REMOTE_MAIN, remoteAllows } from '@shared/remote'
import type { DeviceLevelId } from '@shared/types'
import { CONNECTED, RECONNECTING, type ConnectionState, type Transport } from '@shared/transport'
import { metaNumber, registerTransport } from '../lib/transport'
import { pickFiles, uploadFile } from '../lib/uploads'
import { nativeDeviceHandlers, type DeviceHandlers } from './device'

const browser: DeviceHandlers = {
  'clipboard.write': async ({ text }) => {
    await navigator.clipboard.writeText(text)
  },
  'dialog.saveText': async ({ name, text }) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return name
  },
  'present.page': async ({ html }) => {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return ''
  },
  'assets.readImage': async ({ id }) => {
    const res = await fetch(`/assets/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') ?? 'application/octet-stream' }
  },
  'asset.saveAs': async ({ id, name }) => {
    const res = await fetch(`/assets/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error('Seven could not send that file.')
    const url = URL.createObjectURL(await res.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return name
  },
  'asset.open': async ({ id }) => {
    const res = await fetch(`/assets/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error('Seven could not send that file.')
    const url = URL.createObjectURL(await res.blob())
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },
  'dialog.openFile': async ({ filters }) => {
    const accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',')
    const picked = await pickFiles(false, accept || undefined)
    return picked.length ? uploadFile(picked[0]) : null
  },
  'dialog.openFiles': async () => {
    const picked = await pickFiles(true)
    const paths: string[] = []
    for (const file of picked) paths.push(await uploadFile(file))
    return paths
  }
}

function createRemote(): Transport {
  document.documentElement.dataset.transport = 'remote'
  const local: DeviceHandlers = { ...browser, ...nativeDeviceHandlers() }
  const minMs = metaNumber('seven-reconnect-min', 1) * 1000
  const maxMs = metaNumber('seven-reconnect-max', 30) * 1000
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>()
  const listeners = new Map<EventName, Set<(payload: never) => void>>()
  const watchers = new Set<(state: ConnectionState) => void>()
  let state: ConnectionState = RECONNECTING
  let level: DeviceLevelId = 'chat'
  let socket: WebSocket | null = null
  let nextId = 1
  let delay = minMs

  const setState = (next: ConnectionState): void => {
    state = next
    for (const watch of watchers) watch(next)
  }

  const post = (message: BridgeClientMessage): void => {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  const handle = (message: BridgeServerMessage): void => {
    if ('hello' in message) {
      level = message.hello.level
      return
    }
    if ('event' in message) {
      const subscribed = listeners.get(message.event)
      if (subscribed) for (const callback of subscribed) callback(message.payload as never)
      return
    }
    const waiting = pending.get(message.id)
    if (!waiting) return
    pending.delete(message.id)
    if (message.error !== undefined) waiting.reject(new Error(message.error))
    else waiting.resolve(message.result)
  }

  const connect = (): void => {
    const ws = new WebSocket(`${window.location.protocol === 'http:' ? 'ws' : 'wss'}://${window.location.host}/bridge`)
    socket = ws
    ws.onopen = () => {
      delay = minMs
      setState(CONNECTED)
      const events = [...listeners.keys()]
      if (events.length) post({ subscribe: events })
    }
    ws.onmessage = (event) => {
      try {
        handle(JSON.parse(String(event.data)) as BridgeServerMessage)
      } catch {
        return
      }
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      if (socket !== ws) return
      socket = null
      const lost = new Error('The connection to Seven was lost.')
      for (const waiting of pending.values()) waiting.reject(lost)
      pending.clear()
      setState(RECONNECTING)
      window.setTimeout(connect, delay)
      delay = Math.min(delay * 2, maxMs)
    }
  }

  const request = (kind: 'engine' | 'main', name: string, params: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return reject(new Error('Not connected to Seven.'))
      const id = nextId++
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, kind, name, params } as BridgeClientMessage))
    })

  connect()

  return {
    engine: ((name: string, params: unknown) => request('engine', name, params)) as Transport['engine'],
    main: ((name: MainRequestName, params: unknown) => {
      const handler = local[name] as ((p: unknown) => Promise<unknown>) | undefined
      return handler ? handler(params) : request('main', name, params)
    }) as Transport['main'],
    on: <K extends EventName>(event: K, callback: (payload: Events[K]) => void): (() => void) => {
      let set = listeners.get(event)
      if (!set) {
        set = new Set()
        listeners.set(event, set)
        post({ subscribe: [event] })
      }
      set.add(callback as (payload: never) => void)
      return () => {
        const current = listeners.get(event)
        if (!current) return
        current.delete(callback as (payload: never) => void)
        if (!current.size) {
          listeners.delete(event)
          post({ unsubscribe: [event] })
        }
      }
    },
    capabilities: {
      sendFile: (file) => uploadFile(file),
      assetUrl: (id, name) => `/assets/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
      form: true
    },
    allows: (kind, name) => {
      if (kind === 'engine') return remoteAllows(level, REMOTE_ENGINE[name as EngineRequestName])
      const needed = REMOTE_MAIN[name as MainRequestName]
      if (needed === 'device') return name in local
      return remoteAllows(level, needed)
    },
    connection: {
      state: () => state,
      onChange: (callback) => {
        watchers.add(callback)
        return () => {
          watchers.delete(callback)
        }
      }
    }
  }
}

registerTransport(() => ('seven' in window ? null : createRemote()))
