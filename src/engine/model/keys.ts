import { noteFailure } from '../util/report'
import path from 'node:path'
import { VaultLocked, isVaultLocked } from '@shared/sealed'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'

function keyStore(fileName: string, lockedMessage: string) {
  const file = path.join(dataRoot, fileName)
  const all = (): Record<string, string> => readJson<Record<string, string>>(file, {})
  return {
    get(id: string): string | null {
      try {
        return all()[id] ?? null
      } catch (err) {
        if (isVaultLocked(err)) throw new VaultLocked(lockedMessage)
        throw err
      }
    },
    has(id: string): boolean {
      try {
        return Boolean(all()[id])
      } catch (err) {
        noteFailure(err, 'models', 'Could not read the saved keys')
        return false
      }
    },
    set(id: string, key: string | null): void {
      const next = { ...all() }
      if (key) next[id] = key
      else delete next[id]
      writeJson(file, next)
    }
  }
}

export const remoteKeys = keyStore('remote-keys.json', "The vault is locked, so this remote model's key can't be read. Unlock it first.")

export const serviceKeys = keyStore('service-keys.json', "The vault is locked, so this service's token can't be read. Unlock it first.")
