import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import path from 'node:path'
import type { VaultStatus } from '@shared/types'
import type { EventMessage } from '@shared/protocol'
import { SecureFs, createVaultAsync, isPlainRel, openVaultAsync, privateToDer, publicKeys, type VaultFile } from '@shared/sealed'
import type { EngineSupervisor } from './engine-supervisor'
import { dataDir } from './paths'

const FILE = path.join(dataDir, 'vault.json')
const MIN_LENGTH = 8
const COPIES = path.join(os.tmpdir(), 'seven-open')

export const mainSecure = new SecureFs(dataDir, isPlainRel)

function readFile(): VaultFile | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as VaultFile
  } catch {
    return null
  }
}

export class Vault {
  private file: VaultFile | null = readFile()
  private key: Buffer | null = null

  constructor(
    private engine: EngineSupervisor,
    private broadcast: (message: EventMessage) => void
  ) {
    mainSecure.keys = this.file ? publicKeys(this.file) : null
    engine.on('event', (message: EventMessage) => {
      if (message.event === 'engine.status' && (message.payload as { state: string }).state === 'ready' && this.key) void this.sendKey()
    })
  }

  status(): VaultStatus {
    return { configured: this.file !== null, unlocked: this.key !== null }
  }

  async check(): Promise<VaultStatus> {
    if (this.key) {
      const engine = await this.engine.request('vault.status', undefined).catch(() => null)
      if (engine && !engine.unlocked) await this.sendKey().catch((err) => console.warn('[vault] could not hand the key to the engine again', err))
    }
    return this.status()
  }

  private changed(): VaultStatus {
    const status = this.status()
    this.broadcast({ event: 'vault.changed', payload: status })
    return status
  }

  private async sendKey(): Promise<void> {
    await this.engine.request('vault.setKey', { key: this.key ? this.key.toString('base64') : null })
  }

  async setup(passphrase: string): Promise<VaultStatus> {
    if (this.file) throw new Error('The vault is already set up')
    if (passphrase.length < MIN_LENGTH) throw new Error(`Use at least ${MIN_LENGTH} characters`)
    const { file, keys } = await createVaultAsync(passphrase)
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(file, null, 2), 'utf8')
    this.file = file
    this.key = privateToDer(keys.privateKey!)
    mainSecure.keys = keys
    await this.sendKey()
    await this.engine.request('vault.migrate', undefined)
    return this.changed()
  }

  async unlock(passphrase: string): Promise<VaultStatus> {
    if (!this.file) throw new Error('The vault is not set up')
    if (this.key) return this.status()
    const keys = await openVaultAsync(this.file, passphrase)
    this.key = privateToDer(keys.privateKey!)
    mainSecure.keys = keys
    try {
      await this.sendKey()
    } catch (err) {
      this.key.fill(0)
      this.key = null
      mainSecure.keys = publicKeys(this.file)
      throw new Error(`The passphrase is right, but the engine did not take the key: ${err instanceof Error ? err.message : String(err)}`)
    }
    return this.changed()
  }

  openableCopy(file: string): string {
    if (!mainSecure.enabled) return file
    const meta = JSON.parse(mainSecure.readText(path.join(path.dirname(file), 'meta.json'))) as { name: string }
    const dir = path.join(COPIES, crypto.randomBytes(6).toString('hex'))
    fs.mkdirSync(dir, { recursive: true })
    const target = path.join(dir, path.basename(meta.name))
    fs.writeFileSync(target, mainSecure.readBytes(file))
    return target
  }

  wipeCopies(): void {
    fs.rmSync(COPIES, { recursive: true, force: true })
  }

  async lock(): Promise<VaultStatus> {
    this.wipeCopies()
    if (!this.file) return this.status()
    this.key?.fill(0)
    this.key = null
    mainSecure.keys = publicKeys(this.file)
    await this.sendKey().catch(() => undefined)
    return this.changed()
  }
}
