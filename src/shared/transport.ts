import type { EngineRequestName, MainRequestName, SevenApi } from './protocol'

export interface ConnectionState {
  readonly label: string
  readonly up: boolean
  readonly retrying: boolean
}

export const CONNECTED: ConnectionState = { label: 'Connected', up: true, retrying: false }
export const RECONNECTING: ConnectionState = { label: 'Reconnecting', up: false, retrying: true }
export const LOST: ConnectionState = { label: 'Connection lost', up: false, retrying: false }

export interface TransportConnection {
  state(): ConnectionState
  onChange(callback: (state: ConnectionState) => void): () => void
}

export interface TransportCapabilities {
  pathForFile?: (file: File) => string
  sendFile?: (file: File) => Promise<string>
  assetUrl?: (id: string, name: string) => string
  form?: boolean
}

export type TransportNeed = keyof TransportCapabilities

export interface Transport extends Pick<SevenApi, 'engine' | 'main' | 'on'> {
  readonly capabilities: TransportCapabilities
  allows(kind: 'engine' | 'main', name: EngineRequestName | MainRequestName): boolean
  readonly connection?: TransportConnection
}
