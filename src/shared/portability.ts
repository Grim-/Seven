import type { CarryAbout, CarryMode, CarrySource } from './carry'

export type PortabilityFormat = 'card' | 'json' | 'bundle'
export type PortabilitySplit = 'single' | 'kind' | 'entry'
export type ProtectionMode = 'none' | 'password' | 'vault'

export interface PortabilityPrefs {
  warnJsonMb: number
  warnCardMb: number
  maxUnpackMb: number
  includeDependenciesByDefault: boolean
}

export const DEFAULT_PORTABILITY_PREFS: PortabilityPrefs = {
  warnJsonMb: 10,
  warnCardMb: 5,
  maxUnpackMb: 250,
  includeDependenciesByDefault: true
}

export function cleanPortabilityPrefs(raw: unknown): PortabilityPrefs {
  const v = raw && typeof raw === 'object' ? (raw as Partial<PortabilityPrefs>) : {}
  const num = (x: unknown, fallback: number, min: number, max: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x * 10) / 10)) : fallback
  return {
    warnJsonMb: num(v.warnJsonMb, DEFAULT_PORTABILITY_PREFS.warnJsonMb, 1, 500),
    warnCardMb: num(v.warnCardMb, DEFAULT_PORTABILITY_PREFS.warnCardMb, 1, 500),
    maxUnpackMb: num(v.maxUnpackMb, DEFAULT_PORTABILITY_PREFS.maxUnpackMb, 10, 4096),
    includeDependenciesByDefault:
      typeof v.includeDependenciesByDefault === 'boolean'
        ? v.includeDependenciesByDefault
        : DEFAULT_PORTABILITY_PREFS.includeDependenciesByDefault
  }
}

export interface PortableExportItemSpec {
  kind: string
  id: string
  options?: Record<string, unknown>
}

export interface KindPortabilityOption {
  id: string
  label: string
  description?: string
  defaultValue: boolean
}

export interface KindPortabilityMeta {
  canExport?: boolean
  canImport?: boolean
  preferBundle?: boolean
  bundleNote?: string
  options?: KindPortabilityOption[]
}

export type PortableSource = CarrySource | { text: string; name?: string }

export interface PortableEntryRecord {
  kind: string
  id: string
  title: string
  value: unknown
  isDependency?: boolean
}

export interface PortableFileMeta {
  id: string
  name: string
  size: number
  path?: string
}

export interface PortableJsonFileRecord extends PortableFileMeta {
  data: string
}

export interface PortableJsonEnvelope {
  seven: 'export'
  version: 3
  protection: ProtectionMode
  savedAt: number
  about: CarryAbout
  entries?: PortableEntryRecord[]
  text?: string | null
  files?: (PortableFileMeta | PortableJsonFileRecord)[]
  payload?: string
}

export interface PortableEstimateItem {
  kind: string
  label: string
  id: string
  title: string
  rawBytes: number
  assetBytes: number
  assetCount: number
  preferBundle: boolean
  bundleNote: string | null
}

export interface PortabilityEstimate {
  rootCount: number
  dependencyCount: number
  totalEntries: number
  assetCount: number
  rawBytes: number
  compressedBytes: number
  items: PortableEstimateItem[]
  dependencies: { kind: string; label: string; id: string; title: string; rawBytes: number }[]
  exceedsJsonWarn: boolean
  exceedsCardWarn: boolean
  bundleRecommendedKinds: string[]
  warnings: string[]
}

export interface PortableExportRequest {
  items: PortableExportItemSpec[]
  text?: string | null
  includeDependencies: boolean
  format: PortabilityFormat
  splitMode: PortabilitySplit
  protection: ProtectionMode
  password?: string
  outputPath: string
  pictureId?: string | null
  framedBase64?: string | null
  framedByKey?: Record<string, string> | null
}

export interface PortableExportResult {
  files: string[]
  entryCount: number
  dependencyCount: number
  assetCount: number
  bytes: number
}

export interface PortablePeekItem {
  index: number
  kind: string | null
  label: string
  id: string
  title: string
  isDependency: boolean
  exists: boolean
  existingId: string | null
  importable: boolean
  missingModule: boolean
  resolution: PortableConflictResolution
}

export type PortableConflictResolution = CarryMode | 'skip'

export interface PortablePeekResult {
  source: PortableSource
  container: 'card' | 'json' | 'bundle' | 'raw-json' | 'text'
  version: 1 | 2 | 3
  protection: ProtectionMode
  locked: boolean
  vaultConfigured: boolean
  vaultUnlocked: boolean
  wrongVaultKey: boolean
  savedAt: number
  about: CarryAbout | null
  hasPicture: boolean
  items: PortablePeekItem[]
  text: string | null
  fileCount: number
  error?: string | null
}

export interface PortableImportResolution {
  index: number
  mode: PortableConflictResolution
}

export interface PortableImportRequest {
  source: PortableSource
  targetKind?: string | null
  password?: string
  resolutions?: PortableImportResolution[]
  defaultMode?: PortableConflictResolution
  keepPicture?: boolean
  keepPictureOnly?: boolean
}

export interface PortableImportEntryResult {
  kind: string
  id: string
  title: string
  mode: CarryMode
}

export interface PortableImportResult {
  imported: PortableImportEntryResult[]
  skipped: { title: string; reason: string }[]
  text: string | null
  pictureAssetId: string | null
}

export function sanitizeFileName(name: string, fallback = 'export'): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}
