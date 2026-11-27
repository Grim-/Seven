export interface SaveFolder {
  folder: string | null
  ask: boolean
}

export interface SaveFolderRow {
  target: string
  label: string
  home: string | null
  asks: boolean
  folder: string | null
  ask: boolean
}

export interface SaveFolderAnswer {
  target: string
  label: string
  folder: string
  ask: boolean
}

export const IMPORT_TARGET = 'import'

export function cleanFolderPath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export function cleanSaveFolder(raw: unknown): SaveFolder | null {
  if (typeof raw === 'string') return { folder: cleanFolderPath(raw) || null, ask: false }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = raw as Record<string, unknown>
  return {
    folder: typeof v.folder === 'string' ? cleanFolderPath(v.folder) : null,
    ask: typeof v.ask === 'boolean' ? v.ask : true
  }
}
