import { noteFailure } from '../store/problems'

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch (err) {
    return noteFailure('app', `Could not read the remembered ${key}`, () => fallback)(err)
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    noteFailure('app', `Could not remember ${key}`)(err)
  }
}

export function forgetStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (err) {
    noteFailure('app', `Could not forget ${key}`)(err)
  }
}
