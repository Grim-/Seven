import fs from 'node:fs'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { SecureFs, isPlainRel, privateFromDer, publicKeys, type VaultFile } from '@shared/sealed'
import { dataRoot } from './paths'

export const secure = new SecureFs(dataRoot, isPlainRel)

export const vaultFile = path.join(dataRoot, 'vault.json')

export function loadVaultFile(): VaultFile | null {
  try {
    return JSON.parse(fs.readFileSync(vaultFile, 'utf8')) as VaultFile
  } catch {
    return null
  }
}

export function initSecure(): void {
  const file = loadVaultFile()
  secure.keys = file ? publicKeys(file) : null
}

export const vaultEvents = new EventEmitter()
vaultEvents.setMaxListeners(30)

export function setPrivateKey(der: Buffer | null): void {
  const file = loadVaultFile()
  if (!file) {
    secure.keys = null
    return
  }
  secure.keys = { ...publicKeys(file), privateKey: der ? privateFromDer(der) : null }
  vaultEvents.emit(der ? 'unlocked' : 'locked')
}

initSecure()
