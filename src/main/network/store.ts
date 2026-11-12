import { isVaultLocked } from '@shared/sealed'
import { mainSecure } from '../vault'

export function readJson<T>(file: string, fallback: T): T {
  let text: string
  try {
    text = mainSecure.readText(file)
  } catch (err) {
    if (isVaultLocked(err)) throw err
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback
    throw err
  }
  if (!text.trim()) return fallback
  return JSON.parse(text) as T
}

export function writeJson(file: string, value: unknown): void {
  mainSecure.writeText(file, JSON.stringify(value, null, 2))
}
