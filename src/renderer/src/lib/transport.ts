import { useSyncExternalStore } from 'react'
import type { ConnectionState, Transport, TransportNeed } from '@shared/transport'
import type { EngineRequestName, MainRequestName } from '@shared/protocol'

type TransportOpener = () => Transport | null

const openers: TransportOpener[] = []
let current: Transport | null = null

export function registerTransport(open: TransportOpener): void {
  openers.push(open)
}

export function startTransport(): Transport {
  for (const open of openers) {
    const opened = open()
    if (opened) return (current = opened)
  }
  throw new Error('No way to reach Seven is available')
}

export function transport(): Transport {
  if (!current) throw new Error('Seven was used before its transport started')
  return current
}

export function hasCapability(need: TransportNeed): boolean {
  return Boolean(transport().capabilities[need])
}

export function allowedRequest(kind: 'engine' | 'main', name: EngineRequestName | MainRequestName): boolean {
  return transport().allows(kind, name)
}

export function filePath(file: File): string {
  return transport().capabilities.pathForFile?.(file) ?? ''
}

export function sendFile(file: File): Promise<string> {
  const send = transport().capabilities.sendFile
  return send ? send(file) : Promise.reject(new Error('Files cannot be sent from here.'))
}

export function remoteAssetUrl(id: string, name: string): string | null {
  return transport().capabilities.assetUrl?.(id, name) ?? null
}

export function metaNumber(name: string, fallback: number): number {
  const raw = document.querySelector(`meta[name="${name}"]`)?.getAttribute('content')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const noConnection = () => () => undefined
const noState = () => null

export function useConnection(): ConnectionState | null {
  const connection = transport().connection
  return useSyncExternalStore(connection ? (notify) => connection.onChange(notify) : noConnection, connection ? () => connection.state() : noState)
}
