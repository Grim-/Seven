import crypto from 'node:crypto'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { DeviceLevelId, NetworkDevice, NetworkSettings } from '@shared/types'
import { dataDir } from '../paths'
import { readJson, writeJson } from './store'
import { hashPassword, passwordMatches, type PasswordHash } from './password'
import { onVaultUnlocked } from '../vault'
import { isVaultLocked } from '@shared/sealed'

export function parseDeviceAuth(req: IncomingMessage): { id: string; key: string } | null {
  const header = req.headers.authorization ?? ''
  if (header.startsWith('Device ')) {
    const [id, key] = header.slice(7).trim().split(':')
    if (id && key) return { id, key }
  }
  const raw = req.headers['sec-websocket-protocol']
  const first = (Array.isArray(raw) ? raw.join(',') : (raw ?? '')).split(',')[0]?.trim() ?? ''
  const parts = first.split('.')
  if (parts.length === 3 && parts[0] === 'seven-device' && parts[1] && parts[2]) return { id: parts[1], key: parts[2] }
  const cookies = req.headers.cookie ?? ''
  const found = /(?:^|;\s*)seven-device=([^;]+)/.exec(cookies)
  if (found) {
    const pieces = decodeURIComponent(found[1]).split('.')
    if (pieces.length === 2 && pieces[0] && pieces[1]) return { id: pieces[0], key: pieces[1] }
  }
  return null
}

interface StoredDevice {
  id: string
  name: string
  key: PasswordHash
  pairedAt: number
  lastSeen: number
  lastAddress: string | null
  failures: number
  lockedUntil: number
  level: DeviceLevelId
}

const FILE = path.join(dataDir, 'devices.json')
const NOT_PAIRED = 'Pair this device with Seven first.'
const LOCKED = "Seven's vault is locked. Unlock Seven on the PC, then reconnect."

export class DeviceTrust {
  private loaded: StoredDevice[] | null = null
  private loadError: string | null = null
  private verified = new Set<string>()

  constructor(private settings: () => NetworkSettings) {
    this.load()
    onVaultUnlocked(() => {
      if (!this.loaded) this.load()
    })
  }

  private load(): void {
    try {
      this.loaded = readJson<(Omit<StoredDevice, 'level'> & { level?: DeviceLevelId })[]>(FILE, []).map((d) => ({ ...d, level: d.level ?? 'chat' }))
      this.loadError = null
    } catch (err) {
      this.loadError = isVaultLocked(err) ? LOCKED : err instanceof Error ? err.message : String(err)
    }
  }

  private get devices(): StoredDevice[] {
    if (!this.loaded) throw new Error(this.loadError ?? NOT_PAIRED)
    return this.loaded
  }

  ready(): boolean {
    return this.loaded !== null
  }

  error(): string | null {
    return this.loadError
  }

  refusal(): string {
    return this.ready() ? NOT_PAIRED : (this.loadError ?? NOT_PAIRED)
  }

  private save(): void {
    writeJson(FILE, this.devices)
  }

  async create(name: string, address: string): Promise<{ id: string; key: string }> {
    const key = crypto.randomBytes(32).toString('base64url')
    const device: StoredDevice = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 64) || 'Device',
      key: await hashPassword(key),
      pairedAt: Date.now(),
      lastSeen: Date.now(),
      lastAddress: address,
      failures: 0,
      lockedUntil: 0,
      level: 'chat'
    }
    this.devices.push(device)
    this.save()
    return { id: device.id, key }
  }

  async verify(id: string, key: string, address: string): Promise<boolean> {
    if (!this.ready()) return false
    const device = this.devices.find((d) => d.id === id)
    if (!device || device.lockedUntil > Date.now()) return false
    const digest = crypto.createHash('sha256').update(`${id}:${key}`).digest('hex')
    const ok = this.verified.has(digest) || (await passwordMatches(key, device.key))
    if (!ok) {
      device.failures++
      const s = this.settings()
      if (device.failures >= s.maxFailures) {
        device.lockedUntil = Date.now() + s.lockMinutes * 60_000
        device.failures = 0
      }
      this.save()
      return false
    }
    this.verified.add(digest)
    device.failures = 0
    device.lastSeen = Date.now()
    device.lastAddress = address
    this.save()
    return true
  }

  levelOf(id: string): DeviceLevelId | null {
    return this.loaded?.find((d) => d.id === id)?.level ?? null
  }

  setLevel(id: string, level: DeviceLevelId): void {
    const device = this.devices.find((d) => d.id === id)
    if (!device) return
    device.level = level
    this.save()
  }

  seen(id: string): void {
    const device = this.loaded?.find((d) => d.id === id)
    if (!device) return
    device.lastSeen = Date.now()
    this.save()
  }

  list(connected: ReadonlySet<string>): NetworkDevice[] {
    return (this.loaded ?? [])
      .map((d) => ({ id: d.id, name: d.name, pairedAt: d.pairedAt, lastSeen: d.lastSeen, address: d.lastAddress, connected: connected.has(d.id), level: d.level }))
      .sort((a, b) => b.lastSeen - a.lastSeen)
  }

  revoke(id: string): void {
    this.loaded = this.devices.filter((d) => d.id !== id)
    this.verified.clear()
    this.save()
  }

  clear(): void {
    this.loaded = []
    this.loadError = null
    this.verified.clear()
    this.save()
  }

  any(): boolean {
    return (this.loaded ?? []).length > 0
  }
}
